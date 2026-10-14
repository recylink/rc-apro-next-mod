"use client";

// Informe de huella anual: lo mismo en pantalla, impreso (window.print) y en
// Excel. Los números vienen armados del servidor por informeHuella().

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { Btn } from "@/components/ui/controls";
import { Card, Chip, SectionHead } from "@/components/ui/layout";
import { useToast } from "@/components/ui/toast";
import { exportInformeExcelAction } from "@/app/actions/informe";
import { descargarBase64 } from "@/lib/descargar";
import { ENFOQUES } from "@/lib/domain/categorias";
import { SCOPES } from "@/lib/domain/emisiones";
import { fmtNum, fmtTon } from "@/lib/domain/format";

const ESTADO = {
  incluida: <Chip kind="success" size="sm">Incluida</Chip>,
  excluida: <Chip kind="warning" size="sm">Excluida</Chip>,
  "no-aplica": <Chip size="sm">No aplica</Chip>,
  "": <Chip size="sm">Sin definir</Chip>,
};
const ORIGEN = { catalogo: "Catálogo", elegido: "Elegido para el año", propio: "Valor propio" };
const p1 = (n) => `${(n || 0).toLocaleString("es-CL", { maximumFractionDigits: 1 })}%`;
const t = (n, d = 2) => fmtTon(n || 0, d);

function Botones({ anio }) {
  const toast = useToast();
  const [generando, setGenerando] = useState(false);
  const excel = async () => {
    setGenerando(true);
    const res = await exportInformeExcelAction(anio);
    setGenerando(false);
    if (!res?.ok) return toast.error("No se pudo exportar", res?.error || "Error inesperado");
    descargarBase64(res.base64, res.filename);
  };
  return (
    <div className="prt-row no-print" style={{ gap: 8 }}>
      <Link className="prt-btn" href="/impacto">
        <Icon name="arrow_back" />
        Impacto
      </Link>
      <Btn icon="table_view" disabled={generando} onClick={excel}>{generando ? "Generando…" : "Excel"}</Btn>
      <Btn kind="primary" icon="picture_as_pdf" onClick={() => window.print()}>Imprimir / PDF</Btn>
    </div>
  );
}

export function InformeHuella({ informe: inf, anios }) {
  const router = useRouter();
  const org = inf.organizacion;
  const enfoque = ENFOQUES.find((e) => e.value === inf.enfoque)?.label || "Sin definir";
  const conEmisionesOEstado = inf.categorias.filter((c) => c.tco2e > 0 || c.estadoDeclarado);
  const sinDefinir = inf.categorias.filter((c) => !c.estadoDeclarado && c.tco2e > 0).length;

  return (
    <div>
      <SectionHead
        eyebrow="Impacto Ambiental"
        title={`Informe de huella de carbono ${inf.anio}`}
        sub={[org.razonSocial, org.rut].filter(Boolean).join(" · ") || "Completa razón social y RUT en Límites"}
        right={<Botones anio={inf.anio} />}
      />

      <div className="emis-scope-switch no-print" style={{ marginBottom: 18 }}>
        {anios.map((a) => (
          <button
            key={a}
            className={"emis-scope-tab" + (a === inf.anio ? " active" : "")}
            onClick={() => router.push(`/impacto/informe?anio=${a}`)}
          >
            <Icon name="calendar_today" size={16} /> {a}
          </button>
        ))}
      </div>

      {(inf.sinFactor > 0 || sinDefinir > 0 || inf.excluidasConEmisiones.length > 0 || !inf.enfoque) && (
        <div className="emis-alert pending no-print" style={{ marginBottom: 18 }}>
          <span className="ico" style={{ background: "var(--rl-warning-100)", color: "var(--rl-warning-700)" }}>
            <Icon name="warning" size={20} />
          </span>
          <div className="prt-grow">
            <div className="ttl">Antes de entregar este informe</div>
            <div className="sub">
              {[
                !inf.enfoque && "falta declarar el enfoque de control",
                sinDefinir > 0 && `${sinDefinir} categoría${sinDefinir === 1 ? "" : "s"} con emisiones sin estado declarado (se cuentan como incluidas)`,
                inf.excluidasConEmisiones.length > 0 && `hay emisiones en categorías excluidas (${inf.excluidasConEmisiones.join(", ")}): no suman al total`,
                inf.sinFactor > 0 && `${inf.sinFactor} registro${inf.sinFactor === 1 ? "" : "s"} sin factor no suman`,
              ].filter(Boolean).join(" · ")}
            </div>
          </div>
          <Link className="prt-btn sm" href="/impacto/limites">Límites</Link>
        </div>
      )}

      <div className="prt-stack-md informe-hoja">
        <Card className="informe-bloque">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            <div>
              <div className="prt-hint">Huella total {inf.anio}</div>
              <div style={{ font: "700 28px/1.1 var(--rl-font-display)" }}>{t(inf.total, 1)}</div>
              <div className="prt-hint">tCO₂e</div>
            </div>
            {inf.alcances.map((a) => (
              <div key={a.alcance}>
                <div className="prt-hint">{SCOPES[a.alcance].label} · {SCOPES[a.alcance].desc}</div>
                <div style={{ font: "700 22px/1.1 var(--rl-font-display)", color: SCOPES[a.alcance].color }}>{t(a.tco2e, 1)}</div>
                <div className="prt-hint">{p1(a.pct)} del total</div>
              </div>
            ))}
          </div>
          <div className="prt-row" style={{ gap: 28, marginTop: 16, flexWrap: "wrap" }}>
            <div><span className="prt-hint">Enfoque: </span>{enfoque}</div>
            <div>
              <span className="prt-hint">Por trabajador: </span>
              {inf.intensidad.porTrabajador != null ? `${t(inf.intensidad.porTrabajador)} tCO₂e (${fmtNum(inf.intensidad.trabajadores)} trab.)` : "sin dato"}
            </div>
            <div>
              <span className="prt-hint">Por m²: </span>
              {inf.intensidad.porM2 != null ? `${t(inf.intensidad.porM2, 4)} tCO₂e (${fmtNum(inf.intensidad.m2)} m²)` : "sin dato"}
            </div>
          </div>
        </Card>

        {[1, 2, 3].map((alcance) => {
          const cats = conEmisionesOEstado.filter((c) => c.alcance === alcance);
          if (!cats.length) return null;
          return (
            <Card key={alcance} flush className="informe-bloque">
              <div className="prt-card-head">
                <div className="prt-h3">{SCOPES[alcance].label} · {SCOPES[alcance].desc}</div>
                <Chip size="sm">{t(inf.alcances[alcance - 1].tco2e, 1)} tCO₂e</Chip>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="prt-table">
                  <thead>
                    <tr>
                      <th>Categoría / fuente</th><th>ISO 14064-1</th><th>Estado</th>
                      <th style={{ textAlign: "right" }}>Dato de actividad</th>
                      <th style={{ textAlign: "right" }}>tCO₂e</th><th style={{ textAlign: "right" }}>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cats.map((c) => [
                      <tr key={c.id} style={{ background: "var(--rl-gray-50)" }}>
                        <td style={{ fontWeight: 700 }}>{c.numero ? `${c.numero}. ` : ""}{c.nombre}</td>
                        <td className="prt-hint">{c.isoNombre}</td>
                        <td>{ESTADO[c.estado]}{c.justificacion ? <div className="prt-hint" style={{ fontSize: 11 }}>{c.justificacion}</div> : null}</td>
                        <td />
                        <td style={{ textAlign: "right", fontWeight: 700 }}>{t(c.tco2e)}</td>
                        <td style={{ textAlign: "right" }}>{c.pct ? p1(c.pct) : "—"}</td>
                      </tr>,
                      ...c.fuentes.map((f) => (
                        <tr key={c.id + f.nombre}>
                          <td style={{ paddingLeft: 28 }}>{f.nombre}</td>
                          <td /><td />
                          <td style={{ textAlign: "right" }}>{fmtNum(Math.round(f.cantidad * 100) / 100)} {f.unidad}</td>
                          <td style={{ textAlign: "right" }}>{t(f.tco2e)}</td>
                          <td />
                        </tr>
                      )),
                    ])}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })}

        {inf.categorias.some((c) => c.estadoDeclarado && c.estado !== "incluida") && (
          <Card flush className="informe-bloque">
            <div className="prt-card-head"><div className="prt-h3">Exclusiones y categorías que no aplican</div></div>
            <div style={{ padding: "6px 22px 14px" }}>
              {inf.categorias
                .filter((c) => c.estadoDeclarado && c.estado !== "incluida")
                .map((c) => (
                  <div key={c.id} className="prt-row" style={{ gap: 10, padding: "6px 0" }}>
                    {ESTADO[c.estado]}
                    <strong>{c.alcance === 3 ? `3.${c.numero} ` : ""}{c.nombre}</strong>
                    <span className="prt-hint">{c.justificacion || "—"}</span>
                  </div>
                ))}
            </div>
          </Card>
        )}

        <Card flush className="informe-bloque">
          <div className="prt-card-head">
            <div>
              <div className="prt-h3">Factores de emisión usados</div>
              <div className="prt-hint">Catálogo HuellaChile + DEFRA · refrigerantes con GWP {inf.refrigerantesGwp}</div>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="prt-table">
              <thead>
                <tr><th>Consumo</th><th style={{ textAlign: "right" }}>Factor</th><th>Fuente</th><th>Origen</th></tr>
              </thead>
              <tbody>
                {inf.factores.map((f) => (
                  <tr key={f.clave}>
                    <td>{f.descripcion}</td>
                    <td style={{ textAlign: "right" }}>
                      {f.factor != null ? `${f.factor.toLocaleString("es-CL", { maximumFractionDigits: 5 })} kgCO₂e/${f.unidad}` : "—"}
                    </td>
                    <td className="prt-hint">{f.fuente}{f.anioFactor && String(f.anioFactor) !== inf.anio ? ` (${f.anioFactor})` : ""}</td>
                    <td className="prt-hint">{ORIGEN[f.origen] || "—"}{f.justificacion ? ` · ${f.justificacion}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="prt-hint informe-bloque" style={{ fontSize: 11 }}>
          Metodología: GHG Protocol Corporate Standard y NCh-ISO 14064-1:2019 según la homologación de HuellaChile.
          Emisiones = dato de actividad × factor de emisión. Residuos se gestionan fuera de esta herramienta.
        </div>
      </div>
    </div>
  );
}
