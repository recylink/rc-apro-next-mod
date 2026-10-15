// Residuos: tratamiento y disposición de los residuos generados (alcance 3,
// categoría 5; HuellaChile 3.6). TEMPORAL: los residuos ya existen en el software
// de Recylink; mientras no haya una API que los traiga, se importa el export
// "Detalle Trazabilidad" a la hoja "Residuos". Cuando llegue la API, solo cambia de
// dónde salen las filas: `parseResiduos` y el cálculo quedan igual.
//
// El dato de actividad son los kg (Control de Peso). El factor sale del par
// residuo + tratamiento (lib/domain/factores.js, clave `residuo|…`).
//
// Isomorfo.

import { parseDate } from "./parse";

const txt = (v) => String(v ?? "").trim();
const sinTildes = (s) => txt(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Tipo de tratamiento de Recylink → subcategoría del catálogo 3.6. Sin match queda
 * "" y el factor se elige a mano: mejor eso que un default equivocado.
 */
export function grupoTratamiento(tratamiento) {
  const t = sinTildes(tratamiento);
  if (/compost/.test(t)) return "Compostaje";
  if (/reciclaj|valoriz/.test(t)) return "Reciclaje";
  if (/vertedero/.test(t)) return "Vertedero";
  if (/relleno|disposicion final|eliminacion/.test(t)) return "Relleno sanitario";
  return "";
}

const numero = (v) => {
  if (typeof v === "number") return v;
  const n = parseFloat(txt(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/**
 * Filas de "Residuos" (con encabezado) → residuos.
 * Columnas: Fecha, Sucursal, Residuo, Tratamiento, Kg, Operación, ID.
 * Una fila sin fecha o sin kg queda `incompleto`, no se descarta.
 */
export function parseResiduos(filas) {
  return (filas || [])
    .slice(1)
    .map((row, i) => {
      const [fecha, sucursal, residuo, tratamiento, kg, operacion, id] = row;
      if (!txt(fecha) && !txt(kg) && !txt(residuo)) return null;
      const date = parseDate(fecha);
      const kgN = numero(kg);
      return {
        id: txt(id) || `res-${i}`,
        date,
        sucursal: txt(sucursal),
        residuo: txt(residuo),
        tratamiento: txt(tratamiento),
        grupo: grupoTratamiento(tratamiento),
        kg: kgN,
        operacion: txt(operacion),
        incompleto: !date || !(kgN > 0) || !txt(residuo),
        _sheetRow: i + 2,
      };
    })
    .filter(Boolean);
}

// Columnas del export "Detalle Trazabilidad" de Recylink (hoja Operaciones). Se leen
// por posición y se verifica el encabezado: si Recylink cambia el export, se corta
// en vez de leer otra columna.
const TRAZABILIDAD = [
  [0, "ID"],
  [2, "Sucursal"],
  [4, "Estado"],
  [7, "Residuo"],
  [12, "Fecha de Operación"],
  [28, "Tipo de Tratamiento"],
  [29, "Control de Peso (Kg)"],
];

/** Sucursal de la app cuyo nombre aparece en el de Recylink ("APRO - Casa Matriz" → "Casa Matriz"). */
function sucursalDe(nombreRecylink, sucursales) {
  const n = sinTildes(nombreRecylink);
  const hits = (sucursales || []).filter((s) => s.nombre && n.includes(sinTildes(s.nombre)));
  // Si dos calzan, la de nombre más largo es la más específica.
  return hits.sort((a, b) => b.nombre.length - a.nombre.length)[0] || null;
}

/**
 * Filas crudas del export (con encabezado) → filas para la hoja "Residuos".
 * Solo operaciones finalizadas con fecha y peso. Lanza si el encabezado no es el
 * esperado o si alguna sucursal no existe en la app.
 * @returns {{ filas: any[][], omitidas: number }}
 */
export function desdeTrazabilidad(rows, sucursales) {
  const [enc, ...datos] = rows || [];
  const malas = TRAZABILIDAD.filter(([i, nombre]) => sinTildes(enc?.[i]) !== sinTildes(nombre));
  if (malas.length) {
    throw new Error(
      "El archivo no tiene el formato de Detalle Trazabilidad de Recylink: falta " +
        malas.map(([, n]) => `"${n}"`).join(", ") + " en su columna.",
    );
  }

  const filas = [];
  const sinSucursal = new Set();
  let omitidas = 0;
  for (const r of datos) {
    if (!txt(r[0]) && !txt(r[7])) continue;
    const kg = numero(r[29]);
    const fecha = parseDate(r[12]);
    if (sinTildes(r[4]) !== "finalizada" || !fecha || !(kg > 0)) {
      omitidas++;
      continue;
    }
    const suc = sucursalDe(r[2], sucursales);
    if (!suc) {
      sinSucursal.add(txt(r[2]));
      continue;
    }
    filas.push([fecha, suc.nombre, txt(r[7]), txt(r[28]), kg, txt(r[0])]);
  }
  if (sinSucursal.size) {
    throw new Error(
      `Sucursales de Recylink sin equivalente en la app: ${[...sinSucursal].join(", ")}. ` +
        "Créalas en Configuración (el nombre de la app debe aparecer en el de Recylink).",
    );
  }
  return { filas, omitidas };
}
