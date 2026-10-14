import "server-only";
import { loadEmbarques, loadEmissions, loadInventario, loadRecords, loadSucursales } from "./data";
import { mergeEmissions } from "./domain/emisiones";
import { informeHuella } from "./domain/informe";
import { currentMonthKey } from "./domain/periods";

/**
 * Carga todo lo que necesita el informe y lo arma. Lo comparten la página y el
 * export a Excel, para que los dos partan de la misma lectura.
 */
export async function cargarInforme(anio) {
  const [records, embarques, sucursales, emissions, inventario] = await Promise.all([
    loadRecords(),
    loadEmbarques(),
    loadSucursales(),
    loadEmissions(),
    loadInventario(),
  ]);
  const mes = currentMonthKey();
  const anios = [...new Set([mes.slice(0, 4), ...[...records.data, ...embarques.data].map((r) => String(r.date).slice(0, 4))])]
    .filter((a) => /^\d{4}$/.test(a))
    .sort()
    .reverse();
  const elegido = anios.includes(String(anio)) ? String(anio) : anios[0];
  const ctx = {
    records: records.data,
    embarques: embarques.data,
    sucursales: sucursales.data,
    emissions: mergeEmissions(emissions.data),
    anchor: mes,
  };
  return {
    informe: informeHuella(ctx, inventario.data, elegido),
    anios,
    configured: records.configured,
    error: records.error || embarques.error || sucursales.error || emissions.error || inventario.error,
  };
}
