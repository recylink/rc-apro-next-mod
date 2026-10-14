// Categorías de emisión: alcance + categoría GHG Protocol + su equivalente ISO
// 14064-1 según la homologación de HuellaChile ("Alcances 1, 2 y 3 desde la
// perspectiva HuellaChile.md"). Las usan Límites, Impacto y el informe.
//
// Isomorfo.

export const ISO = {
  directas: "Emisiones y remociones directas",
  energia: "Emisiones indirectas por energía importada",
  transporte: "Transporte",
  productos: "Productos que utiliza la organización",
  uso: "Uso de productos de la organización",
};

const c3 = (n, nombre, iso, dir) => ({ id: `3.${n}`, alcance: 3, numero: n, nombre, iso, direccion: dir });

export const CATEGORIAS = [
  { id: "1.fija", alcance: 1, nombre: "Combustión fija", iso: "directas" },
  { id: "1.movil", alcance: 1, nombre: "Combustión móvil", iso: "directas" },
  { id: "1.fugitiva", alcance: 1, nombre: "Emisiones fugitivas", iso: "directas" },
  { id: "1.proceso", alcance: 1, nombre: "Emisiones de proceso", iso: "directas" },
  { id: "2.electricidad", alcance: 2, nombre: "Electricidad", iso: "energia" },
  { id: "2.otras", alcance: 2, nombre: "Vapor, calor y frío", iso: "energia" },
  c3(1, "Bienes y servicios adquiridos", "productos", "arriba"),
  c3(2, "Bienes de capital", "productos", "arriba"),
  c3(3, "Actividades relacionadas con combustible y energía", "productos", "arriba"),
  c3(4, "Transporte de carga aguas arriba", "transporte", "arriba"),
  c3(5, "Tratamiento y/o disposición de residuos", "productos", "arriba"),
  c3(6, "Viajes de negocios", "transporte", "arriba"),
  c3(7, "Movilización de personal", "transporte", "arriba"),
  c3(8, "Activos arrendados aguas arriba", "productos", "arriba"),
  c3(9, "Transporte de carga aguas abajo", "transporte", "abajo"),
  c3(10, "Procesamiento de productos vendidos", "uso", "abajo"),
  c3(11, "Uso de productos vendidos", "uso", "abajo"),
  c3(12, "Fin de vida de productos vendidos", "uso", "abajo"),
  c3(13, "Activos arrendados aguas abajo", "uso", "abajo"),
  c3(14, "Franquicias", "uso", "abajo"),
  c3(15, "Inversiones", "uso", "abajo"),
];

export const POR_ID = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c]));

const CLASE_A_CATEGORIA = { fija: "1.fija", móvil: "1.movil", fugitiva: "1.fugitiva", proceso: "1.proceso" };

/**
 * Categoría de una fila del cálculo (emisionesPorRegistro) o de una recarga de
 * refrigerante (`refrigerante: true`). Null si no se puede clasificar.
 */
export function categoriaDe(r) {
  if (r.refrigerante) return "1.fugitiva";
  if (r.scope === 2) return "2.electricidad";
  if (r.scope === 3) return r.categoriaGhg ? `3.${r.categoriaGhg}` : null;
  if (r.type === "combustible") return CLASE_A_CATEGORIA[r.clase || "fija"] || null;
  return null;
}

export const ESTADOS = [
  { value: "incluida", label: "Incluida" },
  { value: "excluida", label: "Excluida" },
  { value: "no-aplica", label: "No aplica" },
];

export const ENFOQUES = [
  { value: "operacional", label: "Control operacional" },
  { value: "financiero", label: "Control financiero" },
];
