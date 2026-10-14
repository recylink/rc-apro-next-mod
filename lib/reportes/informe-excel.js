import "server-only";
import * as XLSX from "xlsx";
import { sanearFilas } from "../domain/sanear";

// Informe de huella a Excel: las mismas cifras que la pantalla, desde informeHuella().

const ESTADO = { incluida: "Incluida", excluida: "Excluida", "no-aplica": "No aplica", "": "Sin definir" };
const ORIGEN = { catalogo: "Catálogo", elegido: "Elegido para el año", propio: "Valor propio", "": "—" };
const r2 = (n) => (n == null ? "" : Math.round(n * 1000) / 1000);

function hoja(filas, anchos) {
  const ws = XLSX.utils.aoa_to_sheet(sanearFilas(filas));
  ws["!cols"] = anchos.map((wch) => ({ wch }));
  return ws;
}

/** @returns { base64, filename } */
export function informeWorkbook(inf) {
  const wb = XLSX.utils.book_new();
  const org = inf.organizacion;

  XLSX.utils.book_append_sheet(
    wb,
    hoja(
      [
        [`Huella de carbono ${inf.anio}`],
        ["Razón social", org.razonSocial || ""],
        ["RUT", org.rut || ""],
        ["Enfoque de control", inf.enfoque || "Sin definir"],
        [],
        ["Alcance", "tCO₂e", "% del total"],
        ...inf.alcances.map((a) => [`Alcance ${a.alcance}`, r2(a.tco2e), r2(a.pct)]),
        ["Total", r2(inf.total), 100],
        [],
        ["Intensidad", "Valor", "Denominador"],
        ["tCO₂e por trabajador", r2(inf.intensidad.porTrabajador), inf.intensidad.trabajadores || ""],
        ["tCO₂e por m²", r2(inf.intensidad.porM2), inf.intensidad.m2 || ""],
        [],
        ["Metodología: GHG Protocol y NCh-ISO 14064-1 (homologación HuellaChile). Factores HuellaChile + DEFRA; GWP de refrigerantes AR5."],
      ],
      [28, 16, 16],
    ),
    "Resumen",
  );

  XLSX.utils.book_append_sheet(
    wb,
    hoja(
      [
        ["Alcance", "Categoría GHG", "Categoría", "Categoría ISO 14064-1", "Estado", "Justificación", "tCO₂e", "% del total"],
        ...inf.categorias.map((c) => [
          c.alcance, c.numero || "", c.nombre, c.isoNombre, ESTADO[c.estado] || c.estado, c.justificacion, r2(c.tco2e), r2(c.pct),
        ]),
      ],
      [8, 12, 44, 42, 12, 40, 12, 12],
    ),
    "Categorías",
  );

  XLSX.utils.book_append_sheet(
    wb,
    hoja(
      [
        ["Alcance", "Categoría", "Fuente", "Dato de actividad", "Unidad", "tCO₂e"],
        ...inf.categorias.flatMap((c) =>
          c.fuentes.map((f) => [c.alcance, c.nombre, f.nombre, r2(f.cantidad), f.unidad, r2(f.tco2e)]),
        ),
      ],
      [8, 40, 40, 16, 8, 12],
    ),
    "Fuentes",
  );

  XLSX.utils.book_append_sheet(
    wb,
    hoja(
      [
        ["Consumo", "Factor", "Unidad", "Fuente del factor", "Origen", "Año del factor", "Justificación"],
        ...inf.factores.map((f) => [
          f.descripcion, f.factor ?? "", f.unidad ? `kgCO₂e/${f.unidad}` : "", f.fuente, ORIGEN[f.origen] || f.origen, f.anioFactor || "", f.justificacion,
        ]),
      ],
      [40, 12, 14, 48, 18, 12, 40],
    ),
    "Factores",
  );

  return {
    base64: XLSX.write(wb, { type: "base64", bookType: "xlsx" }),
    filename: `Huella_${String(org.razonSocial || "empresa").replace(/[^\wáéíóúñÁÉÍÓÚÑ-]+/g, "-").slice(0, 40)}_${inf.anio}.xlsx`,
  };
}
