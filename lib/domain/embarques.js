// Logística: Embarques (transporte de carga comprado) y Rutas precargadas.
// Alcance 3, categoría 4 (transporte aguas arriba). Ver CONTEXT.md.
//
// El dato de actividad es t·km = kg / 1000 × km. Los km salen del embarque o, si
// viene sin ellos, de la Ruta con el mismo origen, destino y medio: así la carga
// masiva en la planilla no obliga a tipear 20.000 km en cada fila.
//
// Isomorfo: lo usan el servidor (lectura) y la pantalla de Logística.

import { CATALOGO_FACTORES } from "./catalogo-factores";
import { parseDate } from "./parse";

/**
 * Medios de transporte: los nombres de flete de insumos del catálogo (3.3
 * "Insumos - …"). El medio de un embarque ES la fila del catálogo que lo emite.
 */
export const MEDIOS = [
  ...new Set(
    CATALOGO_FACTORES.filter((f) => f.codigo === "3.3" && /^Insumos/.test(f.subcategoria)).map((f) => f.nombre),
  ),
];

const txt = (v) => String(v ?? "").trim();
const sinTildes = (s) => txt(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// La hoja muestra números con formato local ("26.600", "0,6").
function numero(v) {
  if (typeof v === "number") return v;
  const s = txt(v).replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** "03-2024", "2024-03", "15-03-24", serial… → fecha ISO a mitad de mes. */
export function fechaEmbarque(v) {
  const s = txt(v);
  let m = s.match(/^(\d{1,2})[-/](\d{4})$/);
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}-15`;
  m = s.match(/^(\d{4})[-/](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-15`;
  const iso = parseDate(s);
  return iso ? iso.slice(0, 7) + "-15" : "";
}

const claveRuta = (origen, destino, medio) => [origen, destino, medio].map(sinTildes).join("|");

/** Filas de "Rutas" (con encabezado) → mapa origen|destino|medio → km. */
export function parseRutas(filas) {
  const out = new Map();
  for (const [origen, destino, medio, km] of (filas || []).slice(1)) {
    const n = numero(km);
    if (txt(origen) && txt(destino) && txt(medio) && n > 0) out.set(claveRuta(origen, destino, medio), n);
  }
  return out;
}

/** Rutas como lista, para los selectores del formulario. */
export function listaRutas(filas) {
  return (filas || [])
    .slice(1)
    .map(([origen, destino, medio, km]) => ({ origen: txt(origen), destino: txt(destino), medio: txt(medio), km: numero(km) }))
    .filter((r) => r.origen && r.destino && r.medio && r.km > 0);
}

/**
 * Filas de "Embarques" (con encabezado) → embarques con su t·km.
 * Columnas: Fecha, Sucursal, Origen, Destino, Medio, Kg, Km, Documento, ID.
 * Una fila sin fecha, sin kg o sin km (ni propios ni de ruta) queda marcada
 * `incompleto` en vez de descartarse: la pantalla tiene que poder mostrarla.
 */
export function parseEmbarques(filas, rutas) {
  return (filas || [])
    .slice(1)
    .map((row, i) => {
      const [fecha, sucursal, origen, destino, medio, kg, km, documento, id] = row;
      if (!txt(fecha) && !txt(kg) && !txt(origen)) return null;
      const kmPropio = numero(km);
      const kmRuta = rutas?.get(claveRuta(origen, destino, medio)) ?? null;
      const kmFinal = kmPropio > 0 ? kmPropio : kmRuta;
      const kgN = numero(kg);
      const date = fechaEmbarque(fecha);
      return {
        id: txt(id) || `emb-${i}`,
        date,
        sucursal: txt(sucursal),
        origen: txt(origen),
        destino: txt(destino),
        medio: txt(medio),
        kg: kgN,
        km: kmFinal,
        kmDeRuta: !(kmPropio > 0) && kmRuta != null,
        documento: txt(documento),
        tkm: kgN > 0 && kmFinal > 0 ? (kgN / 1000) * kmFinal : 0,
        incompleto: !date || !(kgN > 0) || !(kmFinal > 0) || !MEDIOS.includes(txt(medio)),
        _sheetRow: i + 2,
      };
    })
    .filter(Boolean);
}
