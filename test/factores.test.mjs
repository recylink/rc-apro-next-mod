// Factor por año: default del catálogo, elección por año y valor propio.
import { test } from "node:test";
import assert from "node:assert/strict";
import { claveFactor, resolverFactor } from "../lib/domain/factores.js";
import { emisionesPorRegistro } from "../lib/domain/emisiones-calc.js";

const dieselMovil = claveFactor({ type: "combustible", subcat: "diesel", clase: "móvil", unit: "L" });
const sen = claveFactor({ type: "electricidad", sistema: "SEN" });

test("la clase de la fuente elige el factor del combustible", () => {
  const fija = claveFactor({ type: "combustible", subcat: "diesel", clase: "fija", unit: "L" });
  assert.equal(resolverFactor(fija, "2024").factor.toFixed(4), "2.7145");
  assert.equal(resolverFactor(dieselMovil, "2024").factor.toFixed(4), "2.7402");
});

test("electricidad: factor del año, o el último publicado", () => {
  const f2024 = resolverFactor(sen, "2024");
  assert.equal(f2024.anioFactor, 2024);
  const f2026 = resolverFactor(sen, "2026");
  assert.equal(f2026.anioFactor, 2024);
  assert.equal(f2026.factor, f2024.factor);
  assert.equal(resolverFactor(sen, "2019").anioFactor, 2019);
});

test("la elección de un año no toca los otros", () => {
  const elecciones = { 2025: { [dieselMovil]: { valor: 2.5, justificacion: "ficha del proveedor" } } };
  assert.equal(resolverFactor(dieselMovil, "2025", elecciones).origen, "propio");
  assert.equal(resolverFactor(dieselMovil, "2025", elecciones).factor, 2.5);
  assert.equal(resolverFactor(dieselMovil, "2024", elecciones).origen, "catalogo");
});

test("elegir otra fila del catálogo", () => {
  const sen2020 = resolverFactor(sen, "2020").id;
  const r = resolverFactor(sen, "2025", { 2025: { [sen]: { id: sen2020 } } });
  assert.equal(r.origen, "elegido");
  assert.equal(r.anioFactor, 2020);
});

test("el bus de acercamiento emite en alcance 3, categoría 7, con factor de combustión móvil", () => {
  const [r] = emisionesPorRegistro({
    records: [{
      type: "combustible", subcat: "diesel", unit: "L", cantidad: 1000, date: "2024-03-15",
      sucursal: "CD", estado: "activa", clase: "móvil", alcance: 3, categoriaGhg: 7,
    }],
    sucursales: [{ id: "s1", nombre: "CD" }],
    emissions: { factoresPorAnio: {} },
  });
  assert.equal(r.scope, 3);
  assert.equal(r.categoriaGhg, 7);
  assert.equal(r.tco2e.toFixed(3), "2.740");
});

test("sin factor en esa unidad no inventa uno", () => {
  const gal = claveFactor({ type: "combustible", subcat: "diesel", clase: "fija", unit: "gal" });
  assert.equal(resolverFactor(gal, "2024"), null);
});
