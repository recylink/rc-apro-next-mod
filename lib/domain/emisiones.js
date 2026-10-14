// Catálogo de emisiones GEI y semilla del estado de emisiones.
// Portado de proto/state.jsx (bloque "Emisiones GEI (Huella Chile)").

export const SCOPES = {
  1: { id: 1, label: "Alcance 1", desc: "Emisiones directas", color: "var(--rl-fuel)",        bg: "var(--rl-fuel-bg)" },
  2: { id: 2, label: "Alcance 2", desc: "Energía indirecta",  color: "var(--rl-primary-900)", bg: "var(--rl-primary-50)" },
  3: { id: 3, label: "Alcance 3", desc: "Otras indirectas",   color: "var(--rl-success-700)", bg: "var(--rl-success-50)" },
};

// GWP a 100 años (AR5).
export const REFRIGERANTES_CATALOG = [
  { id: "r22",   label: "R-22",   gwp: 1810 },
  { id: "r410a", label: "R-410A", gwp: 2088 },
  { id: "r134a", label: "R-134a", gwp: 1430 },
  { id: "r404a", label: "R-404A", gwp: 3922 },
  { id: "r507",  label: "R-507",  gwp: 3985 },
  { id: "r32",   label: "R-32",   gwp: 675 },
];

/**
 * Estado inicial de emisiones: solo los factores base de empresa y una meta por
 * defecto. Los overrides y refrigerantes por sucursal se crean en uso.
 *
 * `baseEmissions` son las tCO₂e del inventario del año base; sin ese dato no se
 * calcula reducción real. `baseMode` "auto" usa las emisiones registradas en el
 * sistema para el año base, "manual" usa `baseEmissions`.
 */
export function seedEmissions() {
  return {
    // Los factores ya no viven acá: salen del catálogo, con la elección por año en
    // Config (lib/domain/factores.js).
    factoresPorAnio: {},
    refrigerantesSucursal: {},
    metas: {
      empresa: { absoluta: "", relativa: 30, anioBase: 2023, baseEmissions: "", baseMode: "manual" },
      sucursales: {},
    },
  };
}

/** Aplica lo guardado sobre la semilla. */
export function mergeEmissions(src) {
  const base = seedEmissions();
  if (!src || typeof src !== "object") return base;

  if (src.factoresPorAnio && typeof src.factoresPorAnio === "object") {
    base.factoresPorAnio = src.factoresPorAnio;
  }
  if (src.refrigerantesSucursal && typeof src.refrigerantesSucursal === "object") {
    base.refrigerantesSucursal = src.refrigerantesSucursal;
  }
  if (src.metas && typeof src.metas === "object") {
    base.metas = {
      empresa: { ...base.metas.empresa, ...(src.metas.empresa || {}) },
      sucursales: { ...base.metas.sucursales, ...(src.metas.sucursales || {}) },
    };
  }
  return base;
}
