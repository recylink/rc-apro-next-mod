// Fuentes de emisión: el catálogo que la empresa edita en la hoja "Fuentes".
// Cada fuente fija su clase y su alcance; quien registra solo elige la fuente.
// Isomorfo: lo usan el servidor (cálculo) y el formulario.

export const CLASES = ["fija", "móvil", "fugitiva", "proceso"];

const sinTildes = (s) =>
  String(s ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Filas de la hoja (con encabezado) → fuentes válidas. Las incompletas se descartan. */
export function parseFuentes(filas) {
  return (filas || [])
    .slice(1)
    .map(([nombre, clase, alcance, categoria]) => ({
      nombre: String(nombre ?? "").trim(),
      clase: CLASES.find((c) => sinTildes(c) === sinTildes(clase)) || null,
      alcance: Number(alcance),
      categoria: Number(categoria) || null,
    }))
    .filter((f) => f.nombre && f.clase && [1, 3].includes(f.alcance));
}
