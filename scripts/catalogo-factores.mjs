// Genera lib/domain/catalogo-factores.js desde la hoja "FE HC" (tabla de factores
// de HuellaChile) de una planilla Excel.
//
//   node scripts/catalogo-factores.mjs "<ruta.xlsx>" "<nombre de la versión>"
//
// Solo lee factores: nunca fórmulas ni resultados de la planilla del cliente.
// El archivo generado se versiona en el repo; la app no lee Excel en runtime.

import { readFileSync, writeFileSync } from "node:fs";
import XLSX from "xlsx";

const [, , ruta, version] = process.argv;
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

const salida = `// GENERADO por scripts/catalogo-factores.mjs — no editar a mano.
// Fuente: hoja "FE HC" (HuellaChile), ${catalogo.length} factores.
// factor = kgCO₂e por unidad del dato de actividad.

export const CATALOGO_VERSION = ${JSON.stringify(version)};

export const CATALOGO_FACTORES = ${JSON.stringify(catalogo, null, 1)};
`;

writeFileSync(new URL("../lib/domain/catalogo-factores.js", import.meta.url), salida);
console.log(`${catalogo.length} factores → lib/domain/catalogo-factores.js (${version})`);
