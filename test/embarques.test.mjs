// Embarques: t·km, km desde la ruta, y su emisión en alcance 3 categoría 4.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fechaEmbarque, parseEmbarques, parseRutas } from "../lib/domain/embarques.js";
import { emisionesPorRegistro } from "../lib/domain/emisiones-calc.js";

const ENC = ["Fecha", "Sucursal", "Origen", "Destino", "Medio", "Kg", "Km", "Documento", "ID"];
const rutas = parseRutas([
  ["Origen", "Destino", "Medio", "Km"],
  ["CHINA", "SAN ANTONIO", "Barco - contenedor", 20000],
]);

test("fecha: mes/año en varios formatos, a mitad de mes", () => {
  assert.equal(fechaEmbarque("03-2024"), "2024-03-15");
  assert.equal(fechaEmbarque("2024-03"), "2024-03-15");
  assert.equal(fechaEmbarque("20-03-2024"), "2024-03-15");
  assert.equal(fechaEmbarque(45371), "2024-03-15"); // serial de Sheets = 2024-03-20
});

test("sin km, los toma de la ruta; con km propios, mandan los propios", () => {
  const [a, b] = parseEmbarques(
    [ENC, ["03-2024", "CD", "China", "San Antonio", "Barco - contenedor", 26600, "", "", "e1"],
          ["03-2024", "CD", "CHINA", "SAN ANTONIO", "Barco - contenedor", 1000, 100, "", "e2"]],
    rutas,
  );
  assert.equal(a.km, 20000);
  assert.equal(a.kmDeRuta, true);
  assert.equal(a.tkm, 532000);
  assert.equal(b.km, 100);
  assert.equal(b.kmDeRuta, false);
});

test("medio desconocido o sin km queda incompleto, no desaparece", () => {
  const filas = parseEmbarques(
    [ENC, ["03-2024", "CD", "PERU", "SAN ANTONIO", "Barco - contenedor", 500, "", "", ""],
          ["03-2024", "CD", "CHINA", "SAN ANTONIO", "Bote", 500, 100, "", ""]],
    rutas,
  );
  assert.deepEqual(filas.map((f) => f.incompleto), [true, true]);
});

test("el embarque emite en alcance 3, categoría 4, con el factor de su medio", () => {
  const embarques = parseEmbarques([ENC, ["03-2024", "CD", "CHINA", "SAN ANTONIO", "Barco - contenedor", 26600, "", "", "e1"]], rutas);
  const [r] = emisionesPorRegistro({ records: [], embarques, sucursales: [{ id: "s1", nombre: "CD" }], emissions: {} });
  assert.equal(r.scope, 3);
  assert.equal(r.categoriaGhg, 4);
  assert.equal(r.tco2e.toFixed(3), (532000 * 0.01612 / 1000).toFixed(3));
});
