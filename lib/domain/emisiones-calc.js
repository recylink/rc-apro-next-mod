// Motor de cálculo de emisiones GEI. Portado de proto/emissions-calc.jsx.
//
// Todas las funciones reciben un mismo objeto de contexto en vez del estado
// global del prototipo:
//   { records, sucursales, emissions, anchor }
// y opcionalmente `filters` = { sucursal, period } con la misma semántica que el
// dashboard.
//
// Las emisiones NO se guardan: se calculan al leer. El factor sale de
// lib/domain/factores.js según el AÑO del registro, así que cambiar el factor de un
// año no mueve los demás (DISEÑO-APRO.md, decisión 7).

import { REFRIGERANTES_CATALOG } from "./emisiones";
import { candidatos, claveFactor, resolverFactor } from "./factores";
import { periodToMonthKeys, monthsWindow } from "./periods";

/** Sistema eléctrico de una sucursal (el de su primera subcategoría eléctrica). */
export function sistemaDe(suc) {
  const sc = (suc?.items?.electricidad?.subcats || []).find((x) => x.sistemaElectrico);
  return sc ? sc.sistemaElectrico : "SEN";
}

/**
 * Sucursales con electricidad en un sistema que el catálogo no cubre. Su consumo
 * eléctrico no se convierte a emisiones y la pantalla lo advierte, en vez de
 * mostrar un cero silencioso.
 */
export function sucursalesSinFactor(sucursales) {
  return (sucursales || [])
    .filter((s) => s.items?.electricidad?.activo)
    .filter((s) => !candidatos(claveFactor({ type: "electricidad", sistema: sistemaDe(s) })).length)
    .map((s) => s.id);
}

const mesesDelFiltro = (filters, anchor) =>
  filters?.period ? new Set(periodToMonthKeys(filters.period, anchor)) : null;

const coincideSucursal = (filtro, nombre) => !filtro || filtro === "all" || filtro === nombre;

/**
 * Cada registro activo con su emisión en tCO₂e, su factor (`factorInfo`: valor,
 * fuente, origen) y su clasificación: alcance y, en alcance 3, categoría GHG.
 * El combustible toma alcance y categoría de su fuente de emisión.
 *
 * Con `emissions.wtt` encendido, cada registro de combustible suma una línea
 * derivada (`type: "wtt"`, `derivadaDe`): el upstream de ese combustible, alcance 3
 * categoría 3, sobre la misma cantidad. No se captura nada aparte.
 */
export function emisionesPorRegistro({ records, embarques, sucursales, emissions, anchor }, filters) {
  const porNombre = {};
  for (const s of sucursales || []) porNombre[s.nombre] = s;
  const meses = mesesDelFiltro(filters, anchor);

  const conFactor = (r, clave, scope, categoriaGhg) => {
    const f = clave ? resolverFactor(clave, String(r.date).slice(0, 4), emissions?.factoresPorAnio) : null;
    return {
      ...r,
      clave,
      factor: f ? f.factor : null,
      factorInfo: f,
      scope,
      categoriaGhg,
      sinFactor: !f,
      tco2e: f ? (r.cantidad * f.factor) / 1000 : 0,
    };
  };

  // Los embarques entran como un registro más: cantidad en t·km, alcance 3 cat. 4.
  const deEmbarques = (embarques || []).map((e) => ({ ...e, type: "embarque", cantidad: e.tkm, unit: "tkm", estado: "activa" }));

  return [...(records || []), ...deEmbarques]
    .filter((r) => r.estado !== "eliminada")
    .filter((r) => coincideSucursal(filters?.sucursal, r.sucursal))
    .filter((r) => !meses || meses.has(String(r.date).slice(0, 7)))
    .flatMap((r) => {
      if (r.type === "embarque") {
        const suc = porNombre[r.sucursal];
        return [conFactor({ ...r, sucId: suc ? suc.id : null }, claveFactor(r), 3, 4)];
      }
      const suc = porNombre[r.sucursal];
      const base = { ...r, sucId: suc ? suc.id : null };
      const scope = r.type === "electricidad" ? 2 : r.type === "agua" ? 3 : r.alcance || 1;
      // Agua potable es un insumo comprado: categoría 1.
      const categoria = r.type === "agua" ? 1 : scope === 3 ? r.categoriaGhg ?? null : null;
      const filas = [conFactor(base, claveFactor({ ...r, sistema: sistemaDe(suc) }), scope, categoria)];

      if (emissions?.wtt && r.type === "combustible") {
        const wtt = { ...base, id: `${r.id}#wtt`, type: "wtt", derivadaDe: r.id };
        filas.push(conFactor(wtt, claveFactor(wtt), 3, 3));
      }
      return filas;
    });
}

/**
 * Refrigerantes: no son consumo, son kilos repuestos que emiten directamente por
 * GWP × kg (alcance 1). Viven en la configuración de emisiones, no en registros.
 */
export function emisionesRefrigerantes({ sucursales, emissions, anchor }, filters) {
  const gwp = {};
  for (const r of REFRIGERANTES_CATALOG) gwp[r.id] = r.gwp;
  const meses = mesesDelFiltro(filters, anchor);
  const filas = [];

  for (const suc of sucursales || []) {
    if (!coincideSucursal(filters?.sucursal, suc.nombre)) continue;
    for (const rf of emissions.refrigerantesSucursal?.[suc.id] || []) {
      if (meses && !meses.has(rf.mes)) continue;
      const g = gwp[rf.tipo] || 0;
      filas.push({
        sucId: suc.id,
        sucursal: suc.nombre,
        tipo: rf.tipo,
        gwp: g,
        cargaKg: rf.cargaKg,
        mes: rf.mes,
        tco2e: (rf.cargaKg * g) / 1000,
      });
    }
  }
  return filas;
}

/** Total, por alcance y por categoría. */
export function agregadoEmisiones(ctx, filters) {
  const recs = emisionesPorRegistro(ctx, filters);
  const refs = emisionesRefrigerantes(ctx, filters);

  const byScope = { 1: 0, 2: 0, 3: 0 };
  const byCat = { electricidad: 0, combustible: 0, agua: 0, refrigerantes: 0, wtt: 0, embarque: 0 };

  for (const r of recs) {
    byScope[r.scope] += r.tco2e;
    byCat[r.type] += r.tco2e;
  }
  for (const r of refs) {
    byScope[1] += r.tco2e;
    byCat.refrigerantes += r.tco2e;
  }

  return { total: byScope[1] + byScope[2] + byScope[3], byScope, byCat, recs, refs };
}

/** Serie mensual de tCO₂e, acotada al período del filtro. */
export function emisionesPorMes(ctx, scopeFilter = "all", filters) {
  const recs = emisionesPorRegistro(ctx, filters);
  const refs = emisionesRefrigerantes(ctx, filters);
  const eje = filters?.period ? periodToMonthKeys(filters.period, ctx.anchor) : monthsWindow(ctx.anchor, 12);
  const incluyeAlcance1 = scopeFilter === "all" || +scopeFilter === 1;

  const data = eje.map((mk) => {
    let v = 0;
    for (const r of recs) {
      if (String(r.date).startsWith(mk) && (scopeFilter === "all" || r.scope === +scopeFilter)) v += r.tco2e;
    }
    if (incluyeAlcance1) {
      for (const r of refs) if (r.mes === mk) v += r.tco2e;
    }
    return v;
  });

  return { months: eje, data };
}

/** tCO₂e por sucursal, marcando las que no tienen factor. */
export function emisionesPorSucursal(ctx, scopeFilter = "all", filters) {
  const recs = emisionesPorRegistro(ctx, filters);
  const refs = emisionesRefrigerantes(ctx, filters);
  const sinFactor = sucursalesSinFactor(ctx.sucursales);
  const incluyeAlcance1 = scopeFilter === "all" || +scopeFilter === 1;

  return (ctx.sucursales || [])
    .filter((suc) => coincideSucursal(filters?.sucursal, suc.nombre))
    .map((suc) => {
      let v = 0;
      for (const r of recs) {
        if (r.sucId === suc.id && (scopeFilter === "all" || r.scope === +scopeFilter)) v += r.tco2e;
      }
      if (incluyeAlcance1) {
        for (const r of refs) if (r.sucId === suc.id) v += r.tco2e;
      }
      return {
        id: suc.id,
        nombre: suc.nombre,
        activa: suc.activa,
        sinFactor: sinFactor.includes(suc.id),
        tco2e: v,
      };
    });
}

/** Emisiones de un año calendario — modo "año base desde los registros". */
export function emisionesDelAnio(ctx, year, sucursalNombre) {
  if (!year) return 0;
  return agregadoEmisiones(ctx, {
    sucursal: sucursalNombre || "all",
    period: `custom:${year}-01:${year}-12`,
  }).total;
}

export function nombresSucursalesSinFactor(sucursales) {
  const byId = {};
  for (const s of sucursales || []) byId[s.id] = s;
  return sucursalesSinFactor(sucursales)
    .map((id) => byId[id])
    .filter((s) => s?.activa)
    .map((s) => s.nombre);
}

export const SCOPE_COLORS = {
  1: { stroke: "var(--rl-fuel)", fill: "var(--rl-fuel-bg)" },
  2: { stroke: "var(--rl-primary-900)", fill: "var(--rl-primary-50)" },
  3: { stroke: "var(--rl-success-700)", fill: "var(--rl-success-50)" },
};

export const CAT_META = {
  electricidad:  { label: "Electricidad",  icon: "bolt",              color: "var(--rl-primary-900)", bg: "var(--rl-primary-50)" },
  combustible:   { label: "Combustibles",  icon: "local_gas_station", color: "var(--rl-fuel)",        bg: "var(--rl-fuel-bg)" },
  agua:          { label: "Agua",          icon: "water_drop",        color: "var(--rl-success-700)", bg: "var(--rl-success-50)" },
  refrigerantes: { label: "Refrigerantes", icon: "snowflake",         color: "#6366F1",               bg: "#EEF0FE" },
  wtt:           { label: "Upstream combustibles (WTT)", icon: "local_gas_station", color: "#B45309", bg: "#FEF3C7" },
  embarque:      { label: "Transporte de carga", icon: "apartment",      color: "#0E7490",               bg: "#CFFAFE" },
};
