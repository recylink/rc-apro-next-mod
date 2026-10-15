"use client";

// Residuos (alcance 3, categoría 5). TEMPORAL hasta que la huella lea los residuos
// del software de Recylink por API: se sube el export "Detalle Trazabilidad" y queda
// en la hoja Residuos. Acá se ve el año agrupado por residuo y tratamiento, como en
// la ficha de huella del cliente. El factor de cada par se elige en Factores.

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { Btn } from "@/components/ui/controls";
import { Card, Chip, SectionHead } from "@/components/ui/layout";
import { useToast } from "@/components/ui/toast";
import { useAccion } from "@/components/use-accion";
import { importarTrazabilidadAction } from "@/app/actions/residuos";
import { emisionesPorRegistro } from "@/lib/domain/emisiones-calc";
import { fmtNum, fmtTon } from "@/lib/domain/format";

function Importar() {
  const { correr, pending } = useAccion();
  const toast = useToast();
  const input = useRef(null);

  const subir = (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("archivo", file);
    correr(() => importarTrazabilidadAction(fd), {
      onExito: (r) =>
        toast.success(
          r.agregadas ? `${r.agregadas} operaciones importadas` : "Nada nuevo que importar",
          [
            r.agregadas && `${fmtNum(r.kg)} kg`,
            r.repetidas && `${r.repetidas} ya estaban`,
            r.omitidas && `${r.omitidas} sin finalizar, sin fecha o sin peso`,
          ].filter(Boolean).join(" · "),
        ),
    });
    input.current.value = "";
  };

  return (
    <Card>
      <div className="prt-row" style={{ gap: 16, alignItems: "center" }}>
        <div className="prt-grow">
          <div className="prt-h3">Importar desde Recylink</div>
          <div className="prt-hint">
            Export "Detalle Trazabilidad" (.xlsx). Se toman residuo, fecha de operación, tipo de tratamiento y
            control de peso. Las operaciones ya importadas no se repiten.
          </div>
        </div>
        <input
          ref={input}
          type="file"
          accept=".xlsx,.xls"
          hidden
          onChange={(e) => subir(e.target.files?.[0])}
        />
        <Btn kind="primary" icon="cloud_upload" disabled={pending} onClick={() => input.current?.click()}>
          {pending ? "Importando…" : "Subir archivo"}
        </Btn>
      </div>
    </Card>
  );
}

export function Residuos({ residuos, sucursales, emissions, mesActual }) {
  const anios = [...new Set([mesActual.slice(0, 4), ...residuos.map((r) => String(r.date).slice(0, 4))])]
    .filter((a) => /^\d{4}$/.test(a))
    .sort()
    .reverse();
  const [anio, setAnio] = useState(() => anios.find((a) => residuos.some((r) => String(r.date).startsWith(a))) || anios[0]);

  // Un renglón por residuo + tratamiento, como la ficha del cliente.
  const grupos = useMemo(() => {
    const out = new Map();
    for (const r of emisionesPorRegistro({ residuos, sucursales, emissions, anchor: mesActual })) {
      if (String(r.date).slice(0, 4) !== anio) continue;
      const g = out.get(r.clave) || { ...r, n: 0, kg: 0, tco2e: 0, incompletos: 0 };
      g.n++;
      g.kg += r.kg || 0;
      g.tco2e += r.tco2e;
      if (r.incompleto) g.incompletos++;
      out.set(r.clave, g);
    }
    return [...out.values()].sort((a, b) => b.tco2e - a.tco2e || b.kg - a.kg);
  }, [residuos, sucursales, emissions, mesActual, anio]);

  const total = grupos.reduce((s, g) => s + g.tco2e, 0);
  const kg = grupos.reduce((s, g) => s + g.kg, 0);
  const sinFactor = grupos.filter((g) => g.sinFactor);

  return (
    <div>
      <SectionHead
        eyebrow="Registrar"
        title="Residuos"
        sub="Tratamiento y disposición de residuos generados. Alcance 3, categoría 5. Temporal: a futuro se leerán directo de Recylink."
        right={
          <Link className="prt-btn" href="/impacto/factores">
            <Icon name="edit" />
            Factores
          </Link>
        }
      />

      <Importar />

      <div className="emis-scope-switch" style={{ margin: "18px 0" }}>
        {anios.map((a) => (
          <button key={a} className={"emis-scope-tab" + (a === anio ? " active" : "")} onClick={() => setAnio(a)}>
            <Icon name="calendar_today" size={16} /> {a}
          </button>
        ))}
      </div>

      {sinFactor.length > 0 && (
        <div className="emis-alert pending" style={{ marginBottom: 18 }}>
          <span className="ico" style={{ background: "var(--rl-warning-100)", color: "var(--rl-warning-700)" }}>
            <Icon name="warning" size={20} />
          </span>
          <div className="prt-grow">
            <div className="ttl">
              {sinFactor.length} residuo{sinFactor.length === 1 ? "" : "s"} sin factor: no suman a la huella
            </div>
            <div className="sub">
              {sinFactor.map((g) => g.residuo).join(", ")}. Elige su factor en{" "}
              <Link href="/impacto/factores">Factores</Link>.
            </div>
          </div>
        </div>
      )}

      <Card flush>
        <div className="prt-card-head">
          <div>
            <div className="prt-h3">Residuos {anio}</div>
            <div className="prt-hint">{fmtNum(Math.round(kg))} kg</div>
          </div>
          <Chip size="sm">{fmtTon(total, 2)} tCO₂e</Chip>
        </div>
        {grupos.length === 0 ? (
          <div className="prt-hint" style={{ padding: "16px 22px" }}>No hay residuos en {anio}.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="prt-table">
              <thead>
                <tr>
                  <th>Tratamiento</th><th>Residuo</th><th style={{ textAlign: "right" }}>Operaciones</th>
                  <th style={{ textAlign: "right" }}>Kg</th><th>Factor</th><th style={{ textAlign: "right" }}>tCO₂e</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map((g) => (
                  <tr key={g.clave}>
                    <td>{g.grupo || <Chip kind="warning" size="sm">{g.tratamiento || "sin tratamiento"}</Chip>}</td>
                    <td>{g.residuo}</td>
                    <td style={{ textAlign: "right" }}>
                      {g.n}{g.incompletos ? <span className="prt-hint"> ({g.incompletos} incompl.)</span> : null}
                    </td>
                    <td style={{ textAlign: "right" }}>{fmtNum(g.kg)}</td>
                    <td className="prt-hint">
                      {g.factorInfo
                        ? `${g.factor.toLocaleString("es-CL", { maximumFractionDigits: 5 })} kgCO₂e/kg · ${g.factorInfo.origen === "propio" ? "valor propio" : g.factorInfo.fuente}`
                        : "—"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {g.sinFactor ? <Chip kind="warning" size="sm">sin factor</Chip> : fmtTon(g.tco2e, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
