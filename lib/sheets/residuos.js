import "server-only";
import { apiGet, apiPost, TAGS } from "../apps-script";
import { SHEETS } from "../instance";
import { ENCABEZADOS } from "../google/headers";
import { desdeTrazabilidad, parseResiduos } from "../domain/residuos";
import { nextConsumoId } from "../domain/ids";
import { readSucursales } from "./sucursales";
import { exigirEncabezado } from "./encabezados";

// Residuos. Salen del mismo `read` (y caché) que los registros y los embarques.

async function leer() {
  const data = await apiGet({ action: "read" }, { tag: TAGS.records, revalidate: 15 });
  const filas = data[SHEETS.RESIDUOS] || [];
  exigirEncabezado(SHEETS.RESIDUOS, filas[0], ENCABEZADOS[SHEETS.RESIDUOS]);
  return filas;
}

export async function readResiduos() {
  return parseResiduos(await leer());
}

/**
 * Importa el export de trazabilidad de Recylink (filas crudas, con encabezado).
 * Agrega solo las operaciones que la hoja todavía no tiene: reimportar el mismo
 * archivo, o uno que se solapa, no duplica.
 */
export async function importarTrazabilidad(rows) {
  const { filas, omitidas } = desdeTrazabilidad(rows, await readSucursales());
  // ponytail: dos importaciones simultáneas podrían duplicar; con un solo usuario cargando no pasa.
  const ya = new Set(parseResiduos(await leer()).map((r) => r.operacion).filter(Boolean));
  const nuevas = filas.filter((f) => !ya.has(f[5]));
  if (nuevas.length) {
    await apiPost({ action: "append", sheet: SHEETS.RESIDUOS, values: nuevas.map((f) => [...f, nextConsumoId("res")]) });
  }
  return {
    agregadas: nuevas.length,
    repetidas: filas.length - nuevas.length,
    omitidas,
    kg: nuevas.reduce((s, f) => s + f[4], 0),
  };
}
