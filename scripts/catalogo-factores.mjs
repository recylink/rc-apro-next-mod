// Genera lib/domain/catalogo-factores.js desde la hoja "FE HC" (tabla de factores
// de HuellaChile) de una planilla Excel.
//
//   node scripts/catalogo-factores.mjs "<ruta.xlsx>" "<versión>" ["<DEFRA full set.xlsx>"]
//
// Solo lee factores: nunca fórmulas ni resultados de la planilla del cliente.
// El archivo generado se versiona en el repo; la app no lee Excel en runtime.
//
// Con el set completo de DEFRA se agregan los factores que HuellaChile no trae en
// la unidad que registra un cliente (EXTRAS_DEFRA). Cada extra copia categoría y
// nombre de una fila HuellaChile del mismo combustible, para que se busque igual.

import { readFileSync, writeFileSync } from "node:fs";
import XLSX from "xlsx";

const [, , ruta, version, rutaDefra] = process.argv;

// GLP en toneladas: APRO lo registra así y HuellaChile solo lo trae en L y m³.
const EXTRAS_DEFRA = [
  { hoja: "Fuels", fuel: "LPG", unit: "tonnes", copiaDe: ["1.1", /^Gas licuado/] },
  { hoja: "Fuels", fuel: "LPG", unit: "tonnes", copiaDe: ["1.2", /^Gas licuado/] },
  { hoja: "WTT- fuels", fuel: "LPG", unit: "tonnes", copiaDe: ["3.1", /^Gas licuado/] },
];
const UNIDADES_DEFRA = { tonnes: "t" };
if (!ruta || !version) {
  console.error('uso: node scripts/catalogo-factores.mjs "<ruta.xlsx>" "<versión>"');
  process.exit(1);
}

const UNIDADES = {
  "metros cúbicos": "m³",
  litros: "L",
  toneladas: "t",
  tonelada: "t",
  kilogramos: "kg",
  gramos: "g",
  kWh: "kWh",
  MWh: "MWh",
  GWh: "GWh",
  kilómetros: "km",
  "kilómetros-pasajero": "pkm",
  "tonelada-kilómetro": "tkm",
  "pieza por noche": "noche",
  "jornada de trabajo (8 horas)": "jornada",
};

const slug = (s) =>
  String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const vacio = (v) => v === "" || v === "-" || v == null;

const wb = XLSX.read(readFileSync(ruta));
const hoja = wb.Sheets["FE HC"];
if (!hoja) throw new Error('la planilla no tiene la hoja "FE HC"');

const filas = XLSX.utils.sheet_to_json(hoja, { defval: "" });
const vistos = new Set();

const catalogo = filas.map((f, i) => {
  const fila = i + 2;
  const [, codigo, categoria] = String(f["Categoría"]).trim().match(/^(\d\.\d)\s+(.*)$/) || [];
  if (!codigo) throw new Error(`fila ${fila}: categoría sin código "${f["Categoría"]}"`);

  const unidadTexto = String(f["Unidad del dato de actividad"]).trim();
  const unidad = UNIDADES[unidadTexto];
  if (!unidad) throw new Error(`fila ${fila}: unidad desconocida "${unidadTexto}"`);

  // La app guarda kgCO₂e por unidad: una tabla en otra base se rechaza.
  if (!/^kgCO2e\//.test(String(f["Unidades del factor de emisión"]).trim())) {
    throw new Error(`fila ${fila}: factor no está en kgCO2e ("${f["Unidades del factor de emisión"]}")`);
  }
  const factor = Number(f["Factor de emisión"]);
  if (!Number.isFinite(factor) || factor < 0) throw new Error(`fila ${fila}: factor inválido "${f["Factor de emisión"]}"`);

  const aux = vacio(f["Auxiliar"]) ? "" : String(f["Auxiliar"]).trim();
  const subcategoria = String(f["Subcategoría"]).trim();
  const nombre = String(f["Nombre"]).trim();

  const id = [codigo, slug(subcategoria), slug(nombre), aux, slug(unidad === "m³" ? "m3" : unidad)]
    .filter(Boolean)
    .join("-");
  if (vistos.has(id)) throw new Error(`fila ${fila}: id repetido ${id}`);
  vistos.add(id);

  return {
    id,
    codigo,
    categoria,
    subcategoria,
    nombre,
    aux,
    unidad,
    factor,
    fuente: ["Fuente 1", "Fuente 2", "Fuente 3"].map((k) => f[k]).filter((v) => !vacio(v)).map((v) => String(v).trim()).join(" · "),
  };
});

if (rutaDefra) {
  const defra = XLSX.read(readFileSync(rutaDefra));
  const anio = (String(rutaDefra).match(/20\d\d/) || [""])[0];
  for (const ex of EXTRAS_DEFRA) {
    const filasDefra = XLSX.utils.sheet_to_json(defra.Sheets[ex.hoja], { header: 1, blankrows: false });
    // Columnas: [Activity, Fuel, Unit, kg CO2e, ...]; Activity solo viene en la primera fila del bloque.
    const f = filasDefra.find((r) => String(r[1]).trim() === ex.fuel && String(r[2]).trim() === ex.unit);
    if (!f || !Number.isFinite(Number(f[3]))) throw new Error(`DEFRA ${ex.hoja}: no está ${ex.fuel} en ${ex.unit}`);

    const [codigo, nombre] = ex.copiaDe;
    const base = catalogo.find((c) => c.codigo === codigo && nombre.test(c.nombre));
    if (!base) throw new Error(`no hay fila HuellaChile ${codigo} ${nombre} para copiar`);
    const unidad = UNIDADES_DEFRA[ex.unit];
    const id = [codigo, slug(base.subcategoria), slug(base.nombre), unidad].join("-");
    if (vistos.has(id)) throw new Error(`id repetido ${id}`);
    vistos.add(id);
    catalogo.push({ ...base, id, aux: "", unidad, factor: Number(f[3]), fuente: `DEFRA ${anio}, ${ex.hoja}` });
  }
}

const salida = `// GENERADO por scripts/catalogo-factores.mjs — no editar a mano.
// Fuente: hoja "FE HC" (HuellaChile)${rutaDefra ? " + extras DEFRA" : ""}, ${catalogo.length} factores.
// factor = kgCO₂e por unidad del dato de actividad.

export const CATALOGO_VERSION = ${JSON.stringify(version)};

export const CATALOGO_FACTORES = ${JSON.stringify(catalogo, null, 1)};
`;

writeFileSync(new URL("../lib/domain/catalogo-factores.js", import.meta.url), salida);
console.log(`${catalogo.length} factores → lib/domain/catalogo-factores.js (${version})`);
