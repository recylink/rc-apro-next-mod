"use server";

import * as XLSX from "xlsx";
import { revalidateTag } from "next/cache";
import { TAGS } from "@/lib/apps-script";
import { run } from "@/lib/result";
import { importarTrazabilidad } from "@/lib/sheets/residuos";

const MAX_BYTES = 10 * 1024 * 1024;

/** Sube el export "Detalle Trazabilidad" de Recylink (.xlsx) a la hoja Residuos. */
export async function importarTrazabilidadAction(formData) {
  return run(async () => {
    const file = formData.get("archivo");
    if (!file || typeof file.arrayBuffer !== "function") throw new Error("Falta el archivo");
    if (file.size > MAX_BYTES) throw new Error("El archivo pesa más de 10 MB");
    const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer" });
    const hoja = wb.Sheets.Operaciones || wb.Sheets[wb.SheetNames[0]];
    const res = await importarTrazabilidad(XLSX.utils.sheet_to_json(hoja, { header: 1, raw: true }));
    revalidateTag(TAGS.records);
    return res;
  });
}
