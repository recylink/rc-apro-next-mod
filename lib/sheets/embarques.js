import "server-only";
import { apiGet, apiPost, TAGS } from "../apps-script";
import { SHEETS } from "../instance";
import { ENCABEZADOS } from "../google/headers";
import { MEDIOS, listaRutas, parseEmbarques, parseRutas } from "../domain/embarques";
import { nextConsumoId } from "../domain/ids";
import { exigirEncabezado } from "./encabezados";

// Embarques y Rutas. Salen del mismo `read` (y caché) que los registros.

async function leer() {
  const data = await apiGet({ action: "read" }, { tag: TAGS.records, revalidate: 15 });
  const emb = data[SHEETS.EMBARQUES] || [];
  const rut = data[SHEETS.RUTAS] || [];
  exigirEncabezado(SHEETS.EMBARQUES, emb[0], ENCABEZADOS[SHEETS.EMBARQUES]);
  exigirEncabezado(SHEETS.RUTAS, rut[0], ENCABEZADOS[SHEETS.RUTAS]);
  return { emb, rut };
}

export async function readEmbarques() {
  const { emb, rut } = await leer();
  return parseEmbarques(emb, parseRutas(rut));
}

export async function readRutas() {
  return listaRutas((await leer()).rut);
}

/** Agrega un embarque. Valida lo que la hoja no puede validar sola. */
export async function appendEmbarque(e) {
  const kg = Number(e.kg);
  const km = e.km === "" || e.km == null ? "" : Number(e.km);
  if (!/^\d{4}-\d{2}$/.test(String(e.mes || ""))) throw new Error("Indica el mes del embarque");
  if (!e.sucursal) throw new Error("Indica la sucursal");
  if (!e.origen || !e.destino) throw new Error("Indica origen y destino");
  if (!MEDIOS.includes(e.medio)) throw new Error("Medio de transporte desconocido");
  if (!(kg > 0)) throw new Error("Los kg deben ser mayores que 0");
  if (km !== "" && !(km > 0)) throw new Error("Los km deben ser mayores que 0");

  const [anio, mes] = e.mes.split("-");
  const fila = [
    `${mes}-${anio}`, e.sucursal, e.origen.trim(), e.destino.trim(), e.medio, kg, km,
    String(e.documento || "").trim(), nextConsumoId("emb"),
  ];
  await apiPost({ action: "append", sheet: SHEETS.EMBARQUES, values: [fila] });
}
