import "server-only";
import { apiGet, apiPost, TAGS } from "../apps-script";

// Store key/value de la hoja "Config". Los valores se guardan como JSON, así
// que admiten objetos y arreglos. Lo usan los IDs de carpetas de Drive
// (lib/drive-folders.js) y la lista de destinatarios de la cola de fotos.

export async function getConfigValue(key, { revalidate = 60 } = {}) {
  if (!key) return null;
  const data = await apiGet({ action: "getConfig", key }, { tag: TAGS.config, revalidate });
  return data ? data.value : null;
}

export async function setConfigValue(key, value) {
  if (!key) throw new Error("Falta la clave de config");
  await apiPost({ action: "setConfig", key, value });
}

/**
 * Factores elegidos por año de inventario: { [anio]: { [clave]: { id } | { valor, justificacion } } }.
 * Sin elección, el cálculo usa el default del catálogo (lib/domain/factores.js).
 */
export async function readFactoresPorAnio() {
  const v = await getConfigValue("factoresPorAnio");
  return v && typeof v === "object" ? v : {};
}

/**
 * Cambia la elección de UNA clave en UN año (`eleccion` null vuelve al default).
 * Lee fresco y escribe el objeto entero: el resto de los años y claves queda como
 * estaba en la planilla, no como lo tenía la pestaña que guarda.
 */
export async function setEleccionFactor(anio, clave, eleccion) {
  if (!/^\d{4}$/.test(String(anio)) || !clave) throw new Error("Año o clave de factor inválidos");
  if (eleccion) {
    const propio = "valor" in eleccion;
    if (propio && !(Number.isFinite(eleccion.valor) && eleccion.valor >= 0)) {
      throw new Error("El valor propio debe ser un número ≥ 0");
    }
    if (propio && !String(eleccion.justificacion || "").trim()) {
      throw new Error("Un valor propio necesita justificación");
    }
    if (!propio && !eleccion.id) throw new Error("Falta la fila del catálogo");
  }

  const todo = (await getConfigValue("factoresPorAnio", { revalidate: 0 })) || {};
  const delAnio = { ...(todo[anio] || {}) };
  if (eleccion) delAnio[clave] = eleccion;
  else delete delAnio[clave];
  await setConfigValue("factoresPorAnio", { ...todo, [anio]: delAnio });
}

/** Destinatarios del aviso "hay fotos por completar". */
export async function readFotoNotifEmails() {
  const v = await getConfigValue("fotoNotifEmails");
  return Array.isArray(v) ? v.filter((e) => typeof e === "string" && e.includes("@")) : [];
}

export async function writeFotoNotifEmails(emails) {
  const clean = (emails || [])
    .map((e) => String(e || "").trim())
    .filter((e) => e && e.includes("@"));
  await setConfigValue("fotoNotifEmails", clean);
}
