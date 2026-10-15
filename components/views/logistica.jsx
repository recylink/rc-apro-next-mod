"use client";

// Logística: embarques de transporte de carga comprado (alcance 3, categoría 4).
// Lista del año con su emisión, y un formulario para agregar de a uno. La carga
// masiva se hace en la hoja "Embarques" de la planilla; las Rutas, en "Rutas".

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { Btn, Input, MonthPicker, NumericInput, Select } from "@/components/ui/controls";
import { Card, Chip, Field, SectionHead } from "@/components/ui/layout";
import { useAccion } from "@/components/use-accion";
import { addEmbarqueAction } from "@/app/actions/embarques";
import { MEDIOS } from "@/lib/domain/embarques";
import { emisionesPorRegistro } from "@/lib/domain/emisiones-calc";
import { fmtNum, fmtTon } from "@/lib/domain/format";

const VACIO = { mes: "", sucursal: "", ruta: "", origen: "", destino: "", medio: "", kg: "", km: "", documento: "" };

function NuevoEmbarque({ rutas, sucursales, mesActual }) {
  const { correr, pending } = useAccion();
  const [e, setE] = useState({ ...VACIO, sucursal: sucursales[0]?.nombre || "" });
  const set = (patch) => setE((x) => ({ ...x, ...patch }));

  const elegirRuta = (i) => {
    const r = rutas[Number(i)];
    if (r) set({ ruta: i, origen: r.origen, destino: r.destino, medio: r.medio, km: "" });
    else set({ ruta: "" });
  };
  const ruta = e.ruta !== "" ? rutas[Number(e.ruta)] : null;
  const listo = e.mes && e.sucursal && e.origen && e.destino && e.medio && Number(e.kg) > 0 && (ruta || Number(e.km) > 0);

  const guardar = () =>
    correr(
      () =>
        addEmbarqueAction({
          mes: e.mes, sucursal: e.sucursal, origen: e.origen, destino: e.destino, medio: e.medio,
          kg: Number(e.kg),
          // Con ruta, los km quedan vacíos en la hoja y se toman de la ruta.
          km: ruta ? "" : Number(e.km),
          documento: e.documento,
        }),
      {
        exito: { title: "Embarque agregado", body: `${e.origen} → ${e.destino} · ${fmtNum(Number(e.kg))} kg` },
        onExito: () => setE({ ...VACIO, sucursal: e.sucursal, mes: e.mes }),
      },
    );

  return (
    <Card>
      <div className="prt-h3" style={{ marginBottom: 14 }}>Nuevo embarque</div>
      <div className="prt-stack-md">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="Mes de llegada" required>
            <MonthPicker value={e.mes} onChange={(v) => set({ mes: v })} max={mesActual} />
          </Field>
          <Field label="Sucursal que recibe" required>
            <Select
              value={e.sucursal}
              onChange={(v) => set({ sucursal: v })}
              options={sucursales.map((s) => ({ value: s.nombre, label: s.nombre }))}
            />
          </Field>
        </div>

        {rutas.length > 0 && (
          <Field label="Ruta" helper="Las rutas se editan en la hoja Rutas de la planilla">
            <Select
              value={e.ruta}
              onChange={elegirRuta}
              placeholder="Elegir una ruta precargada…"
              options={[
                ...rutas.map((r, i) => ({
                  value: String(i),
                  label: `${r.origen} → ${r.destino} · ${r.medio} · ${fmtNum(r.km)} km`,
                })),
                { value: "", label: "Otra (escribir origen, destino y km)" },
              ]}
            />
          </Field>
        )}

        {!ruta && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <Field label="Origen" required>
              <Input value={e.origen} onChange={(v) => set({ origen: v.toUpperCase() })} placeholder="Ej. CHINA" />
            </Field>
            <Field label="Destino" required>
              <Input value={e.destino} onChange={(v) => set({ destino: v.toUpperCase() })} placeholder="Ej. SAN ANTONIO" />
            </Field>
            <Field label="Km" required>
              <NumericInput value={e.km} onChange={(v) => set({ km: v })} suffix="km" />
            </Field>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <Field label="Medio" required>
            <Select
              value={e.medio}
              onChange={(v) => set({ medio: v })}
              placeholder="Elegir medio…"
              disabled={!!ruta}
              options={MEDIOS.map((m) => ({ value: m, label: m }))}
            />
          </Field>
          <Field label="Peso" required>
            <NumericInput value={e.kg} onChange={(v) => set({ kg: v })} suffix="kg" />
          </Field>
          <Field label="Documento (opcional)" helper="N° de BL, guía o link">
            <Input value={e.documento} onChange={(v) => set({ documento: v.slice(0, 200) })} />
          </Field>
        </div>

        <div className="prt-row" style={{ justifyContent: "flex-end" }}>
          <Btn kind="primary" icon="add" disabled={!listo || pending} onClick={guardar}>
            Agregar embarque
          </Btn>
        </div>
      </div>
    </Card>
  );
}

export function Logistica({ embarques, rutas, sucursales, emissions, mesActual }) {
  const anios = [...new Set([mesActual.slice(0, 4), ...embarques.map((e) => String(e.date).slice(0, 4))])]
    .filter((a) => /^\d{4}$/.test(a))
    .sort()
    .reverse();
  const [anio, setAnio] = useState(() => anios.find((a) => embarques.some((e) => String(e.date).startsWith(a))) || anios[0]);

  const filas = useMemo(
    () =>
      emisionesPorRegistro({ embarques, sucursales, emissions, anchor: mesActual })
        .filter((r) => String(r.date).slice(0, 4) === anio)
        .sort((a, b) => String(b.date).localeCompare(String(a.date))),
    [embarques, sucursales, emissions, mesActual, anio],
  );
  const sinFecha = embarques.filter((e) => !e.date);
  const total = filas.reduce((s, r) => s + r.tco2e, 0);
  const tkm = filas.reduce((s, r) => s + r.tkm, 0);

  return (
    <div>
      <SectionHead
        eyebrow="Registrar"
        title="Logística"
        sub="Transporte de carga comprado: importaciones y fletes. Alcance 3, categoría 4. La carga masiva va en la hoja Embarques de la planilla."
      />

      <NuevoEmbarque rutas={rutas} sucursales={sucursales} mesActual={mesActual} />

      <div className="emis-scope-switch" style={{ margin: "18px 0" }}>
        {anios.map((a) => (
          <button key={a} className={"emis-scope-tab" + (a === anio ? " active" : "")} onClick={() => setAnio(a)}>
            <Icon name="calendar_today" size={16} /> {a}
          </button>
        ))}
      </div>

      {sinFecha.length > 0 && (
        <div className="emis-alert pending" style={{ marginBottom: 18 }}>
          <span className="ico" style={{ background: "var(--rl-warning-100)", color: "var(--rl-warning-700)" }}>
            <Icon name="warning" size={20} />
          </span>
          <div className="prt-grow">
            <div className="ttl">{sinFecha.length} embarque{sinFecha.length === 1 ? "" : "s"} sin fecha en la planilla</div>
            <div className="sub">No se cuentan en ningún año. Filas: {sinFecha.map((e) => e._sheetRow).join(", ")}</div>
          </div>
        </div>
      )}

      <Card flush>
        <div className="prt-card-head">
          <div>
            <div className="prt-h3">Embarques {anio}</div>
            <div className="prt-hint">{fmtNum(Math.round(tkm))} t·km</div>
          </div>
          <Chip size="sm">{fmtTon(total, 1)} tCO₂e</Chip>
        </div>
        {filas.length === 0 ? (
          <div className="prt-hint" style={{ padding: "16px 22px" }}>No hay embarques en {anio}.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="prt-table">
              <thead>
                <tr>
                  <th>Mes</th><th>Sucursal</th><th>Ruta</th><th>Medio</th>
                  <th style={{ textAlign: "right" }}>Kg</th><th style={{ textAlign: "right" }}>Km</th>
                  <th style={{ textAlign: "right" }}>t·km</th><th style={{ textAlign: "right" }}>tCO₂e</th><th>Documento</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((r) => (
                  <tr key={r.id}>
                    <td>{String(r.date).slice(0, 7)}</td>
                    <td>{r.sucursal}</td>
                    <td>{r.origen} → {r.destino}</td>
                    <td>{r.medio}</td>
                    <td style={{ textAlign: "right" }}>{r.kg != null ? fmtNum(r.kg) : "—"}</td>
                    <td style={{ textAlign: "right" }} title={r.kmDeRuta ? "Desde la ruta" : undefined}>
                      {r.km != null ? fmtNum(r.km) : "—"}{r.kmDeRuta ? " ·R" : ""}
                    </td>
                    <td style={{ textAlign: "right" }}>{fmtNum(Math.round(r.tkm))}</td>
                    <td style={{ textAlign: "right" }}>
                      {r.incompleto ? <Chip kind="warning" size="sm">incompleto</Chip> : fmtTon(r.tco2e, 2)}
                    </td>
                    <td className="prt-hint">{r.documento || "—"}</td>
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
