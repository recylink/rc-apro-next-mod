// El catálogo generado: ids únicos y los factores que la huella de APRO usa.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOGO_FACTORES } from "../lib/domain/catalogo-factores.js";

const buscar = (codigo, nombre, unidad, aux = "") =>
  CATALOGO_FACTORES.filter((f) => f.codigo === codigo && nombre.test(f.nombre) && f.unidad === unidad && f.aux === aux);

test("ids únicos y factores numéricos", () => {
  const ids = CATALOGO_FACTORES.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const f of CATALOGO_FACTORES) assert.ok(Number.isFinite(f.factor) && f.factor >= 0, f.id);
});

test("el diésel fijo y el móvil tienen factores distintos", () => {
  const [fijo] = buscar("1.1", /Diésel/, "L");
  const [movil] = buscar("1.2", /Diesel/, "L");
  assert.equal(fijo.factor.toFixed(4), "2.7145");
  assert.equal(movil.factor.toFixed(4), "2.7402");
});

test("factores de WTT, flete marítimo y electricidad por año", () => {
  assert.equal(buscar("3.1", /^Petróleo 2/, "L")[0].factor, 0.62409);
  assert.equal(buscar("3.3", /^Barco - contenedor/, "tkm")[0].factor, 0.01612);
  assert.equal(buscar("2.1", /^Sistema Eléctrico Nacional/, "kWh", "2024").length, 1);
});
