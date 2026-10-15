// Factor de emisión por año de inventario (ver DISEÑO-APRO.md, decisiones 6 y 7).
//
// Un registro se traduce a una CLAVE — qué se consumió y en qué unidad — y la clave
// más el año del registro dan el factor:
//
//   1. lo que la empresa eligió para ese año (`elecciones[anio][clave]`): otra fila
//      del catálogo, o un valor propio con su justificación;
//   2. si no eligió nada, el default del catálogo. En electricidad es el factor del
//      sistema para ese año, o el último publicado antes si el año todavía no está.
//
// Como el default sale de un catálogo versionado en el repo, cambiar la elección de
// 2025 no toca 2024. Isomorfo: lo usan el cálculo, Factores y el reporte de Medidores.

import { CATALOGO_FACTORES } from "./catalogo-factores";

const POR_ID = new Map(CATALOGO_FACTORES.map((f) => [f.id, f]));

// Clase de fuente → código de categoría HuellaChile. Solo la combustión tiene factor
// por litro; fugitiva y proceso no se registran como combustible.
const CODIGO_CLASE = { fija: "1.1", móvil: "1.2" };

// Subcategoría de combustible → nombre en el catálogo (igual en 1.1 y 1.2).
const NOMBRE_COMBUSTIBLE = {
  diesel: /^Petróleo 2/,
  gasolina: /^Gasolina/,
  kerosene: /^Kerosene/,
  glp: /^Gas licuado/,
  "gas-natural": /^Gas natural/,
  "fuel-oil": /^Petróleo 6/,
};

// Sistema eléctrico de la sucursal → nombre en el catálogo (2.1).
const NOMBRE_SISTEMA = {
  SEN: /^Sistema Eléctrico Nacional/,
  loslagos: /Los Lagos/,
  aysen: /Aysén/,
  magallanes: /Magallanes/,
};

// Residuo (texto de Recylink) → nombre en el catálogo 3.6. Lo específico primero:
// "Plástico PET" es PET antes que plástico promedio. Sin match no hay default.
const NOMBRE_RESIDUO = [
  [/cart[oó]n|papel/i, /^Papel y cartón/],
  [/film|stretch|ldpe|bolsa/i, /LDPE/],
  [/hdpe/i, /HDPE/],
  [/\bpet\b/i, /: PET/],
  [/\bpp\b|polipropileno/i, /: PP/],
  [/pl[aá]stic/i, /Promedio de plásticos/],
  [/vidrio/i, /^Vidrio/],
  [/madera|pallet/i, /^Madera/],
  [/alumin|lata/i, /aluminio/],
  [/chatarra|metal|fierro|acero/i, /Chatarra/],
  [/neum[aá]tic/i, /^Neumáticos/],
  [/raee|electr[oó]nic/i, /^Equipos electricos/],
  [/bater[ií]a/i, /^Baterías/],
  [/aceite/i, /^Aceite mineral/],
  [/textil/i, /^Textiles/],
  [/escombro|[aá]rido/i, /^Agregados/],
  [/org[aá]nic/i, /orgánicos/],
  [/industrial|comercial|asimilable/i, /comerciales e industriales/],
  [/domicili|municipal/i, /municipales/],
];

const filasResiduo = (grupo) =>
  CATALOGO_FACTORES.filter((f) => f.codigo === "3.6" && f.unidad === "kg" && (!grupo || f.subcategoria === grupo));

/**
 * Clave del factor de un registro. `sistema` es el sistema eléctrico de la sucursal
 * y `clase` la de su fuente de emisión (sin fuente se asume combustión fija).
 */
export function claveFactor({ type, subcat, clase, unit, sistema, medio, residuo, grupo }) {
  if (type === "electricidad") return `electricidad|${sistema || "SEN"}|kWh`;
  // Upstream del combustible (WTT): no depende de cómo se quema, solo de qué y cuánto.
  if (type === "wtt") return `wtt|${subcat || ""}|${unit || ""}`;
  // Embarque: el medio es el nombre de la fila de flete del catálogo.
  if (type === "embarque") return medio ? `flete|${medio}|tkm` : null;
  if (type === "agua") return "agua|m³";
  // Residuo: qué es y cómo se trata (grupo = subcategoría 3.6). Siempre en kg.
  if (type === "residuo") return residuo ? `residuo|${residuo}|${grupo || ""}|kg` : null;
  if (type === "combustible") return `combustible|${subcat || ""}|${clase || "fija"}|${unit || ""}`;
  return null;
}

/** Texto legible de una clave, para la pantalla de Factores. */
export function describirClave(clave) {
  const [type, a, b, c] = String(clave).split("|");
  if (type === "electricidad") return `Electricidad · ${a}`;
  if (type === "agua") return "Agua potable";
  if (type === "wtt") return `${a || "combustible"} · upstream (WTT) · ${b}`;
  if (type === "flete") return `Flete · ${a}`;
  if (type === "residuo") return `Residuo · ${a} · ${b || "tratamiento sin identificar"}`;
  return `${a || "combustible"} · combustión ${b} · ${c}`;
}

/** Filas del catálogo que pueden servir para la clave, la de default primero. */
export function candidatos(clave, anio) {
  const [type, a, b, c] = String(clave).split("|");

  if (type === "electricidad") {
    const re = NOMBRE_SISTEMA[a];
    if (!re) return [];
    const filas = CATALOGO_FACTORES.filter((f) => f.codigo === "2.1" && f.unidad === "kWh" && re.test(f.nombre));
    // Del año pedido hacia atrás; los años posteriores al final.
    const n = Number(anio);
    return filas.sort((x, y) => {
      const dx = Number(x.aux) <= n ? n - Number(x.aux) : 1000 + Number(x.aux);
      const dy = Number(y.aux) <= n ? n - Number(y.aux) : 1000 + Number(y.aux);
      return dx - dy;
    });
  }
  if (type === "residuo") {
    // Solo hay default si el nombre del residuo calza con una fila de su tratamiento.
    const filas = filasResiduo(b);
    for (const [reRes, reCat] of NOMBRE_RESIDUO) {
      if (!reRes.test(a)) continue;
      const fila = filas.find((f) => reCat.test(f.nombre));
      if (fila) return [fila, ...filas.filter((f) => f !== fila)];
    }
    return [];
  }
  if (type === "agua") {
    return CATALOGO_FACTORES.filter((f) => f.codigo === "3.1" && /^Agua potable/.test(f.nombre) && f.unidad === "m³");
  }
  if (type === "flete") {
    // La fila del medio primero; después las otras del mismo modo (terrestre, marítimo…).
    const fletes = CATALOGO_FACTORES.filter((f) => f.codigo === "3.3" && /^Insumos/.test(f.subcategoria) && f.unidad === "tkm");
    const propia = fletes.find((f) => f.nombre === a);
    if (!propia) return [];
    return [propia, ...fletes.filter((f) => f !== propia && f.subcategoria === propia.subcategoria)];
  }
  if (type === "wtt") {
    // HuellaChile publica el WTT de combustibles dentro de 3.1 (fuente DEFRA, WTT-fuels).
    const re = NOMBRE_COMBUSTIBLE[a];
    if (!re) return [];
    return CATALOGO_FACTORES.filter((f) => f.codigo === "3.1" && re.test(f.nombre) && f.unidad === b && /WTT/.test(f.fuente));
  }
  if (type === "combustible") {
    const codigo = CODIGO_CLASE[b];
    const re = NOMBRE_COMBUSTIBLE[a];
    if (!codigo || !re) return [];
    return CATALOGO_FACTORES.filter((f) => f.codigo === codigo && re.test(f.nombre) && f.unidad === c);
  }
  return [];
}

/**
 * Filas que se pueden ELEGIR para la clave: los candidatos, o, en un residuo sin
 * default, todas las de su tratamiento (o de 3.6 completo si no se identificó).
 */
export function opcionesFactor(clave, anio) {
  const c = candidatos(clave, anio);
  const [type, , b] = String(clave).split("|");
  return c.length || type !== "residuo" ? c : filasResiduo(b).length ? filasResiduo(b) : filasResiduo("");
}

/**
 * Factor de una clave en un año:
 *   { factor, unidad, fuente, id, origen: "catalogo" | "elegido" | "propio",
 *     anioFactor, justificacion }
 * o null si no hay ninguno. `anioFactor` distinto de `anio` avisa que se usó el
 * último publicado.
 */
export function resolverFactor(clave, anio, elecciones) {
  const eleccion = elecciones?.[anio]?.[clave];

  if (eleccion && typeof eleccion.valor === "number") {
    return {
      factor: eleccion.valor,
      unidad: String(clave).split("|").pop(),
      fuente: "Valor propio",
      id: null,
      origen: "propio",
      anioFactor: null,
      justificacion: eleccion.justificacion || "",
    };
  }

  const elegida = eleccion?.id ? POR_ID.get(eleccion.id) : null;
  const fila = elegida || candidatos(clave, anio)[0];
  if (!fila) return null;
  return {
    factor: fila.factor,
    unidad: fila.unidad,
    fuente: fila.fuente,
    id: fila.id,
    origen: elegida ? "elegido" : "catalogo",
    anioFactor: fila.codigo === "2.1" ? Number(fila.aux) : null,
    justificacion: "",
  };
}
