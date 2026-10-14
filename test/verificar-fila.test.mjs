// Filas sin ID: antes de escribir por posición se confirma que la fila sigue siendo
// el registro que la pantalla cree editar.
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { url } from "./raiz.mjs";

let hoja = [];
let lecturas = 0;
mock.module(url("node_modules/server-only/index.js"), { namedExports: {}, defaultExport: {} });
mock.module(url("lib/apps-script.js"), {
  namedExports: { apiGet: async () => ({}), apiPost: async () => ({}), apiPostSoloSdk: async () => ({}), TAGS: {} },
});
mock.module(url("lib/google/sheets-api.js"), {
  namedExports: { leerHoja: async () => (lecturas++, hoja) },
});

const { verificarFila } = await import(url("lib/sheets/records.js"));

const ENC = ["Link", "Fecha", "Consumo", "Costo", "Empresa", "Sucursal", "Tipo", "Proveedor", "Estado", "Origen", "ID"];
const fila = (fecha, consumo) => ["", fecha, consumo, "", "APRO", "CD", "Petróleo Diesel", "Copec", "Cargado", "Manual", ""];
const esperado = { date: "2024-03-31", sucursal: "CD", cantidad: 100, subcat: "diesel" };

test("misma fila: deja escribir", async () => {
  hoja = [ENC, fila("31-03-24", "100"), fila("30-04-24", "200")];
  await verificarFila("comb-0", esperado, "costo");
});

test("alguien ordenó la planilla: no deja escribir", async () => {
  hoja = [ENC, fila("30-04-24", "200"), fila("31-03-24", "100")];
  await assert.rejects(verificarFila("comb-0", esperado, "costo"), /La planilla cambió/);
});

test("el campo que se edita no cuenta como diferencia", async () => {
  hoja = [ENC, fila("31-03-24", "150"), fila("30-04-24", "200")];
  await verificarFila("comb-0", esperado, "cantidad");
});

test("con ID real no lee la planilla", async () => {
  const antes = lecturas;
  await verificarFila("comb_abc_1", undefined, "costo");
  assert.equal(lecturas, antes);
});
