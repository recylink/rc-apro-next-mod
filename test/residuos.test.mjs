// Residuos: import del export de trazabilidad de Recylink, factor por residuo y
// tratamiento, y su emisión en alcance 3 categoría 5.
import { test } from "node:test";
import assert from "node:assert/strict";
import { desdeTrazabilidad, grupoTratamiento, parseResiduos } from "../lib/domain/residuos.js";
import { candidatos, claveFactor, opcionesFactor, resolverFactor } from "../lib/domain/factores.js";
import { emisionesPorCategoria, emisionesPorRegistro } from "../lib/domain/emisiones-calc.js";

// Encabezado real del export (las columnas que se leen y las de relleno entre medio).
const ENC_TRAZ = Array(51).fill("x");
Object.assign(ENC_TRAZ, {
  0: "ID", 2: "Sucursal", 4: "Estado", 7: "Residuo", 12: "Fecha de Operación",
  28: "Tipo de Tratamiento", 29: "Control de Peso (Kg)",
});
const op = (id, residuo, serial, trat, kg, { suc = "APRO - Casa Matriz", estado = "Finalizada" } = {}) => {
  const r = Array(51).fill(null);
  Object.assign(r, { 0: id, 2: suc, 4: estado, 7: residuo, 12: serial, 28: trat, 29: kg });
  return r;
};
const SUCS = [{ id: "s1", nombre: "Casa Matriz", activa: true }];
const RELLENO = "Disposición final de residuos sólidos domiciliarios y asimilables";

test("trazabilidad: toma residuo, fecha, tratamiento y kg; mapea la sucursal", () => {
  const { filas, omitidas } = desdeTrazabilidad(
    [ENC_TRAZ,
     op("316912", "Industrial", 45657.333, RELLENO, 560),
     op("316900", "Cartón", 45300.5, "Reciclaje", 1390),
     op("316901", "Cartón", 45300.5, "Reciclaje", 0),
     op("316902", "Cartón", 45300.5, "Reciclaje", 10, { estado: "Pendiente" })],
    SUCS,
  );
  assert.deepEqual(filas[0], ["2024-12-31", "Casa Matriz", "Industrial", RELLENO, 560, "316912"]);
  assert.equal(filas.length, 2);
  assert.equal(omitidas, 2);
});

test("trazabilidad: otro formato o sucursal desconocida corta la importación", () => {
  assert.throws(() => desdeTrazabilidad([["ID", "Otra"]], SUCS), /Detalle Trazabilidad/);
  assert.throws(() => desdeTrazabilidad([ENC_TRAZ, op("1", "Cartón", 45300, "Reciclaje", 5, { suc: "APRO - Bodega" })], SUCS), /Bodega/);
});

test("tratamiento de Recylink → subcategoría del catálogo", () => {
  assert.equal(grupoTratamiento(RELLENO), "Relleno sanitario");
  assert.equal(grupoTratamiento("Reciclaje"), "Reciclaje");
  assert.equal(grupoTratamiento("Compostaje"), "Compostaje");
  assert.equal(grupoTratamiento("Coprocesamiento"), "");
});

test("factor: default solo si el residuo calza; si no, se elige entre los de su tratamiento", () => {
  const k = (residuo, grupo) => claveFactor({ type: "residuo", residuo, grupo });
  assert.equal(candidatos(k("Industrial", "Relleno sanitario"))[0].nombre, "Residuos comerciales e industriales");
  assert.equal(candidatos(k("Cartón", "Reciclaje"))[0].nombre, "Papel y cartón");
  assert.equal(candidatos(k("Film Stretch", "Reciclaje"))[0].nombre, "Plásticos: LDPE y LLDPE");
  assert.equal(candidatos(k("Plástico PET", "Reciclaje"))[0].nombre, "Plásticos: PET");
  assert.equal(resolverFactor(k("Lodos", "Relleno sanitario"), "2024", {}), null);
  assert.equal(opcionesFactor(k("Lodos", "Relleno sanitario")).length, 2);
});

test("emisión: kg × factor, alcance 3 categoría 5", () => {
  const residuos = parseResiduos([
    ["Fecha", "Sucursal", "Residuo", "Tratamiento", "Kg", "Operación", "ID"],
    ["31-12-2024", "Casa Matriz", "Industrial", RELLENO, 1000, "1", "r1"],
    ["15-03-2024", "Casa Matriz", "Cartón", "Reciclaje", 1000, "2", "r2"],
  ]);
  const ctx = { residuos, sucursales: SUCS, emissions: {}, anchor: "2024-12" };
  const [a, b] = emisionesPorRegistro(ctx);
  assert.equal(a.scope, 3);
  assert.equal(a.categoriaGhg, 5);
  assert.ok(Math.abs(a.tco2e - 0.5203342) < 1e-9);
  assert.ok(Math.abs(b.tco2e - 0.00641061) < 1e-9);
  assert.equal(emisionesPorCategoria(ctx)["3.5"].filas.length, 2);
});
