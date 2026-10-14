// Fuente de emisión: el catálogo de la hoja "Fuentes" y las columnas nuevas de
// Combustible, que van después de ID.
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { url } from "./raiz.mjs";

mock.module(url("node_modules/server-only/index.js"), { namedExports: {}, defaultExport: {} });
// El transporte arrastra next/cache; acá solo se arma la fila, no se escribe.
mock.module(url("lib/apps-script.js"), {
  namedExports: { apiGet: async () => ({}), apiPost: async () => ({}), apiPostSoloSdk: async () => ({}), TAGS: {} },
});

const { parseFuentes } = await import(url("lib/domain/fuentes.js"));
const { rowsBySheet } = await import(url("lib/sheets/records.js"));

test("parseFuentes normaliza la clase y descarta filas incompletas", () => {
  const f = parseFuentes([
    ["Nombre", "Clase", "Alcance", "Categoría GHG"],
    ["Camioneta", "Movil", "1", ""],
    ["Bus de acercamiento", "móvil", 3, 7],
    ["Sin clase", "", 1, ""],
    ["Alcance 2 no aplica", "fija", 2, ""],
  ]);
  assert.deepEqual(f, [
    { nombre: "Camioneta", clase: "móvil", alcance: 1, categoria: null },
    { nombre: "Bus de acercamiento", clase: "móvil", alcance: 3, categoria: 7 },
  ]);
});

const rec = {
  type: "combustible", origen: "manual", estado: "activa", date: "2026-03-15",
  cantidad: 120, costo: 0, sucursal: "CD", subcat: "diesel", provider: "Copec",
  fuente: "Camioneta", equipo: "SJGF56", unit: "L",
};

test("fuente, equipo y unidad se escriben después de ID", () => {
  const [fila] = rowsBySheet([rec], true).Combustible;
  assert.equal(fila.length, 14);
  assert.match(fila[10], /^comb_/);
  assert.deepEqual(fila.slice(11), ["Camioneta", "SJGF56", "L"]);
});

test("sin columna ID la fila se corta antes, con las columnas nuevas", () => {
  const [fila] = rowsBySheet([rec], false).Combustible;
  assert.equal(fila.length, 10);
});

test("la columna Tipo distingue gasolina de GLP", async () => {
  const { combSubcatFromLabel } = await import(url("lib/domain/parse.js"));
  assert.equal(combSubcatFromLabel("Gasolina"), "gasolina");
  assert.equal(combSubcatFromLabel("Gas licuado"), "glp");
  assert.equal(combSubcatFromLabel("GLP"), "glp");
  assert.equal(combSubcatFromLabel("Petróleo Diésel"), "diesel");
  assert.equal(combSubcatFromLabel("Fuel Oil"), "fuel-oil");
});
