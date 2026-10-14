"use server";

import { run } from "@/lib/result";
import { cargarInforme } from "@/lib/informe-datos";
import { informeWorkbook } from "@/lib/reportes/informe-excel";

/** Informe de huella del año en Excel. Se rearma en el servidor desde la planilla. */
export async function exportInformeExcelAction(anio) {
  return run(async () => informeWorkbook((await cargarInforme(anio)).informe));
}
