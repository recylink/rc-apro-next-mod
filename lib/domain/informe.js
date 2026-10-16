// Informe de huella anual (DISEÑO-APRO.md, decisión 14). UNA función arma los
// números y la usan las tres salidas —pantalla, impresión y Excel—, así nunca
// muestran cifras distintas.
//
// Isomorfo.

import { subcatLabel } from "./catalog";
import { CATEGORIAS, ISO } from "./categorias";
import { emisionesPorCategoria } from "./emisiones-calc";
import { describirClave } from "./factores";

/** Etiqueta de la fuente dentro de su categoría: qué emitió, en palabras. */
function etiquetaFuente(r) {
  if (r.refrigerante) return `Refrigerante ${String(r.tipo || "").toUpperCase()}`;
  if (r.type === "embarque") return `Flete · ${r.medio}`;
  if (r.type === "residuo") return `${r.residuo} · ${r.grupo || r.tratamiento || "sin tratamiento"}`;
  if (r.type === "electricidad") return `Electricidad · ${r.sucursal}`;
  if (r.type === "agua") return `Agua · ${r.sucursal}`;
  const combustible = subcatLabel("combustible", r.subcat) || "Combustible";
  if (r.type === "wtt") return `${combustible} (upstream)`;
  return `${r.fuente || "Sin fuente"} · ${combustible}`;
}

const pct = (parte, total) => (total > 0 ? (parte / total) * 100 : 0);
// Las categorías excluidas no suman: el total es el del inventario declarado.
const cuenta = (c) => c.estado !== "excluida" && c.estado !== "no-aplica";

/**
 * @param ctx         { records, embarques, residuos, sucursales, emissions, anchor }
 * @param inventario  { organizacion, datosSucursal, limites } (hoja Config)
 * @param anio        "2024"
 */
export function informeHuella(ctx, inventario, anio) {
  const porCat = emisionesPorCategoria(ctx, { sucursal: "all", period: `custom:${anio}-01:${anio}-12` });
  const lim = inventario?.limites?.[anio] || { enfoque: "", categorias: {} };

  const categorias = CATEGORIAS.map((c) => {
    const datos = porCat[c.id] || { tco2e: 0, filas: [] };
    const fuentes = new Map();
    for (const f of datos.filas) {
      const k = etiquetaFuente(f);
      const prev = fuentes.get(k) || { nombre: k, tco2e: 0, cantidad: 0, unidad: f.unit || (f.refrigerante ? "kg" : "") };
      prev.tco2e += f.tco2e;
      prev.cantidad += f.refrigerante ? f.cargaKg : f.cantidad || 0;
      fuentes.set(k, prev);
    }
    const limite = lim.categorias?.[c.id] || {};
    return {
      ...c,
      isoNombre: ISO[c.iso],
      tco2e: datos.tco2e,
      estado: limite.estado || (datos.tco2e > 0 ? "incluida" : ""),
      estadoDeclarado: !!limite.estado,
      justificacion: limite.justificacion || "",
      fuentes: [...fuentes.values()].sort((a, b) => b.tco2e - a.tco2e),
      sinFactor: datos.filas.filter((f) => f.sinFactor).length,
    };
  });

  const alcances = [1, 2, 3].map((a) => ({
    alcance: a,
    tco2e: categorias.filter((c) => c.alcance === a && cuenta(c)).reduce((s, c) => s + c.tco2e, 0),
  }));
  const total = alcances.reduce((s, a) => s + a.tco2e, 0);
  for (const a of alcances) a.pct = pct(a.tco2e, total);
  for (const c of categorias) c.pct = cuenta(c) ? pct(c.tco2e, total) : 0;

  // Intensidad sobre la suma de las sucursales que declararon el dato ese año.
  const datosAnio = Object.values(inventario?.datosSucursal?.[anio] || {});
  const trabajadores = datosAnio.reduce((s, d) => s + (d?.trabajadores || 0), 0);
  const m2 = datosAnio.reduce((s, d) => s + (d?.m2 || 0), 0);

  // Factores usados: uno por clave, con su fuente y origen.
  const factores = new Map();
  for (const [id, datos] of Object.entries(porCat)) {
    for (const f of datos.filas) {
      if (f.refrigerante || !f.clave || factores.has(f.clave)) continue;
      factores.set(f.clave, {
        clave: f.clave,
        descripcion: describirClave(f.clave),
        categoria: id,
        factor: f.factorInfo?.factor ?? null,
        unidad: f.factorInfo?.unidad || "",
        fuente: f.factorInfo?.fuente || "Sin factor",
        origen: f.factorInfo?.origen || "",
        anioFactor: f.factorInfo?.anioFactor || null,
        justificacion: f.factorInfo?.justificacion || "",
      });
    }
  }

  return {
    anio,
    organizacion: inventario?.organizacion || {},
    enfoque: lim.enfoque || "",
    total,
    alcances,
    categorias,
    intensidad: {
      trabajadores,
      m2,
      porTrabajador: trabajadores > 0 ? total / trabajadores : null,
      porM2: m2 > 0 ? total / m2 : null,
    },
    factores: [...factores.values()].sort((a, b) => a.categoria.localeCompare(b.categoria)),
    refrigerantesGwp: "AR5",
    sinFactor: categorias.reduce((s, c) => s + c.sinFactor, 0),
    sinCategoria: porCat["sin-categoria"]?.filas.length || 0,
    excluidasConEmisiones: categorias.filter((c) => c.estado === "excluida" && c.tco2e > 0).map((c) => c.id),
  };
}

/**
 * Los años con huella lado a lado. Cada año sale de informeHuella con sus
 * propios límites: una categoría excluida ese año no suma (valor null).
 * Variación: % contra el año anterior de la lista; null si no hay base.
 */
export function comparacionAnual(ctx, inventario, anios) {
  const informes = [...anios].sort().map((a) => informeHuella(ctx, inventario, a)).filter((i) => i.total > 0);
  const fila = (etiqueta, nivel, valores, decimales = 1) => ({
    etiqueta,
    nivel,
    decimales,
    valores,
    variacion: valores.map((v, i) => (i > 0 && v != null && valores[i - 1] > 0 ? ((v - valores[i - 1]) / valores[i - 1]) * 100 : null)),
  });
  const valorCat = (inf, id) => {
    const c = inf.categorias.find((x) => x.id === id);
    return cuenta(c) ? c.tco2e : null;
  };
  const categorias = CATEGORIAS.filter((c) => informes.some((i) => valorCat(i, c.id) > 0));

  return {
    anios: informes.map((i) => i.anio),
    filas: [
      fila("Huella total", "total", informes.map((i) => i.total)),
      ...[1, 2, 3].flatMap((a) => [
        fila(`Alcance ${a}`, "alcance", informes.map((i) => i.alcances[a - 1].tco2e)),
        ...categorias
          .filter((c) => c.alcance === a)
          .map((c) => fila(`${c.numero ? `${c.numero}. ` : ""}${c.nombre}`, "categoria", informes.map((i) => valorCat(i, c.id)))),
      ]),
      fila("tCO₂e por trabajador", "intensidad", informes.map((i) => i.intensidad.porTrabajador), 2),
      fila("tCO₂e por m²", "intensidad", informes.map((i) => i.intensidad.porM2), 4),
    ],
  };
}
