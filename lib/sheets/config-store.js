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
 * Lee la clave FRESCA, la transforma y la escribe entera. Para objetos que editan
 * varias pantallas o pestañas: lo que no toca `fn` queda como está en la planilla,
 * no como lo tenía quien guarda.
 */
async function actualizarConfig(key, fn) {
  const actual = await getConfigValue(key, { revalidate: 0 });
  await setConfigValue(key, fn(actual && typeof actual === "object" ? actual : {}));
}

// ----- Inventario: organización, datos de sucursal por año, límites por año -----

const anioValido = (anio) => {
  if (!/^\d{4}$/.test(String(anio))) throw new Error("Año inválido");
};

/** { organizacion: {razonSocial, rut}, datosSucursal: {[anio]: {[sucId]: {trabajadores, m2}}}, limites: {[anio]: {enfoque, categorias}} } */
export async function readInventario() {
  const [organizacion, datosSucursal, limites] = await Promise.all([
    getConfigValue("organizacion"),
    getConfigValue("datosSucursal"),
    getConfigValue("limites"),
  ]);
  const obj = (v) => (v && typeof v === "object" ? v : {});
  return { organizacion: obj(organizacion), datosSucursal: obj(datosSucursal), limites: obj(limites) };
}

export async function setOrganizacion({ razonSocial, rut }) {
  await setConfigValue("organizacion", { razonSocial: String(razonSocial || "").trim(), rut: String(rut || "").trim() });
}

export async function setDatosSucursal(anio, sucId, { trabajadores, m2 }) {
  anioValido(anio);
  if (!sucId) throw new Error("Falta la sucursal");
  const num = (v, que) => {
    if (v === "" || v == null) return null;
    const n = Number(v);
    if (!(Number.isFinite(n) && n >= 0)) throw new Error(`${que} debe ser un número ≥ 0`);
    return n;
  };
  const datos = { trabajadores: num(trabajadores, "Trabajadores"), m2: num(m2, "m²") };
  await actualizarConfig("datosSucursal", (todo) => ({ ...todo, [anio]: { ...(todo[anio] || {}), [sucId]: datos } }));
}

/** `cambio` = { enfoque } o { categoria, estado, justificacion }. */
export async function setLimite(anio, cambio) {
  anioValido(anio);
  await actualizarConfig("limites", (todo) => {
    const lim = { enfoque: "", categorias: {}, ...(todo[anio] || {}) };
    if ("enfoque" in cambio) {
      if (!["operacional", "financiero", ""].includes(cambio.enfoque)) throw new Error("Enfoque de control inválido");
      lim.enfoque = cambio.enfoque;
    } else {
      const { categoria, estado, justificacion = "" } = cambio;
      if (!categoria) throw new Error("Falta la categoría");
      if (!["incluida", "excluida", "no-aplica", ""].includes(estado)) throw new Error("Estado inválido");
      // La ISO 14064-1 exige justificar por escrito cada exclusión.
      if (estado === "excluida" && !String(justificacion).trim()) throw new Error("Una exclusión necesita justificación");
      lim.categorias = { ...lim.categorias, [categoria]: { estado, justificacion: String(justificacion).trim() } };
    }
    return { ...todo, [anio]: lim };
  });
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
