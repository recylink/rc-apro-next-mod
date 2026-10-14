"use server";

import { revalidateTag } from "next/cache";
import { TAGS } from "@/lib/apps-script";
import { run } from "@/lib/result";
import { appendEmbarque } from "@/lib/sheets/embarques";

/** Un embarque desde el formulario de Logística. La carga masiva va directo en la planilla. */
export async function addEmbarqueAction(embarque) {
  return run(async () => {
    await appendEmbarque(embarque);
    revalidateTag(TAGS.records);
    return {};
  });
}
