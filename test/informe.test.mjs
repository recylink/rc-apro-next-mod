// Informe de huella: totales por alcance, exclusiones que no suman e intensidad.
import { test } from "node:test";
import assert from "node:assert/strict";
import { informeHuella } from "../lib/domain/informe.js";

const ctx = {
  records: [
    { id: "a", type: "combustible", subcat: "diesel", unit: "L", cantidad: 1000, date: "2024-03-15", sucursal: "CD", estado: "activa", fuente: "Camioneta", clase: "móvil", alcance: 1 },
    { id: "b", type: "combustible", subcat: "diesel", unit: "L", cantidad: 1000, date: "2024-03-15", sucursal: "CD", estado: "activa", fuente: "Bus", clase: "móvil", alcance: 3, categoriaGhg: 7 },
    { id: "c", type: "combustible", subcat: "diesel", unit: "L", cantidad: 1000, date: "2023-03-15", sucursal: "CD", estado: "activa", fuente: "Camioneta", clase: "móvil", alcance: 1 },
  ],
  embarques: [],
  sucursales: [{ id: "s1", nombre: "CD" }],
  emissions: { factoresPorAnio: {}, refrigerantesSucursal: {} },
};

test("suma por alcance solo el año pedido, con porcentajes", () => {
  const inf = informeHuella(ctx, {}, "2024");
  assert.equal(inf.total.toFixed(3), "5.480");
  assert.deepEqual(inf.alcances.map((a) => Math.round(a.pct)), [50, 0, 50]);
  const movil = inf.categorias.find((c) => c.id === "1.movil");
  assert.equal(movil.fuentes[0].nombre, "Camioneta · Petróleo Diésel");
  assert.equal(inf.factores.length, 1); // misma clave para los dos registros
});

test("una categoría excluida no suma, y queda señalada", () => {
  const inventario = {
    limites: { 2024: { enfoque: "operacional", categorias: { "3.7": { estado: "excluida", justificacion: "fuera del control" } } } },
    datosSucursal: { 2024: { s1: { trabajadores: 10, m2: 1000 } } },
  };
  const inf = informeHuella(ctx, inventario, "2024");
  assert.equal(inf.total.toFixed(3), "2.740");
  assert.deepEqual(inf.excluidasConEmisiones, ["3.7"]);
  assert.equal(inf.intensidad.porTrabajador.toFixed(3), "0.274");
});

test("el Excel trae las cuatro hojas con las mismas cifras", async (t) => {
  const { mock } = await import("node:test");
  const { url } = await import("./raiz.mjs");
  mock.module(url("node_modules/server-only/index.js"), { namedExports: {}, defaultExport: {} });
  const { informeWorkbook } = await import(url("lib/reportes/informe-excel.js"));
  const XLSX = (await import("xlsx")).default;

  const inf = informeHuella(ctx, { organizacion: { razonSocial: "APRO =prueba" } }, "2024");
  const { base64, filename } = informeWorkbook(inf);
  const wb = XLSX.read(base64, { type: "base64" });
  assert.deepEqual(wb.SheetNames, ["Resumen", "Categorías", "Fuentes", "Factores"]);
  const resumen = XLSX.utils.sheet_to_json(wb.Sheets.Resumen, { header: 1 });
  assert.equal(resumen.find((r) => r[0] === "Total")[1], 5.48);
  assert.match(filename, /^Huella_APRO-prueba_2024\.xlsx$/);
});
