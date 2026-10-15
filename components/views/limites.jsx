"use client";

// Límites del inventario (DISEÑO-APRO.md, decisiones 9 y 15): por año, el enfoque
// de control, qué categorías se incluyen o excluyen —con justificación, como exige
// la ISO 14064-1— y los datos de cada sucursal que sirven de denominador para la
// intensidad. Más la razón social y el RUT, que no cambian por año.

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { Btn, Input, NumericInput, Select } from "@/components/ui/controls";
import { Card, Chip, Field, SectionHead } from "@/components/ui/layout";
import { useAccion } from "@/components/use-accion";
import { setDatosSucursalAction, setLimiteAction, setOrganizacionAction } from "@/app/actions/config";
import { CATEGORIAS, ENFOQUES, ESTADOS, ISO } from "@/lib/domain/categorias";
import { SCOPES } from "@/lib/domain/emisiones";
import { emisionesPorCategoria } from "@/lib/domain/emisiones-calc";
import { fmtTon } from "@/lib/domain/format";

function Organizacion({ inicial }) {
  const { correr, pending } = useAccion();
  const [o, setO] = useState({ razonSocial: inicial.razonSocial || "", rut: inicial.rut || "" });
  return (
    <Card>
      <div className="prt-h3" style={{ marginBottom: 14 }}>Organización</div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 16, alignItems: "end" }}>
        <Field label="Razón social">
          <Input value={o.razonSocial} onChange={(v) => setO({ ...o, razonSocial: v })} />
        </Field>
        <Field label="RUT">
          <Input value={o.rut} onChange={(v) => setO({ ...o, rut: v })} placeholder="12.345.678-9" />
        </Field>
        <Btn
          kind="primary"
          disabled={pending}
          onClick={() => correr(() => setOrganizacionAction(o), { exito: { title: "Organización guardada" } })}
        >
          Guardar
        </Btn>
      </div>
    </Card>
  );
}

function FilaSucursal({ anio, suc, datos }) {
  const { correr, pending } = useAccion();
  const [d, setD] = useState({ trabajadores: datos?.trabajadores ?? "", m2: datos?.m2 ?? "" });
  return (
    <tr>
      <td>{suc.nombre}</td>
      <td style={{ width: 170 }}>
        <NumericInput value={String(d.trabajadores)} onChange={(v) => setD({ ...d, trabajadores: v })} allowDecimal={false} />
      </td>
      <td style={{ width: 170 }}>
        <NumericInput value={String(d.m2)} onChange={(v) => setD({ ...d, m2: v })} suffix="m²" />
      </td>
      <td style={{ width: 110 }}>
        <Btn
          size="sm"
          disabled={pending}
          onClick={() =>
            correr(() => setDatosSucursalAction(anio, suc.id, d), { exito: { title: "Datos guardados", body: `${suc.nombre} · ${anio}` } })
          }
        >
          Guardar
        </Btn>
      </td>
    </tr>
  );
}

function FilaCategoria({ anio, cat, guardado, tco2e }) {
  const { correr, pending } = useAccion();
  const [estado, setEstado] = useState(guardado?.estado || "");
  const [just, setJust] = useState(guardado?.justificacion || "");
  // Una exclusión no se guarda hasta tener su justificación escrita (ISO 14064-1).
  const faltaJustificacion = estado === "excluida" && !just.trim();
  const sinGuardar = estado !== (guardado?.estado || "") || just !== (guardado?.justificacion || "");

  const guardar = (e = estado) =>
    correr(() => setLimiteAction(anio, { categoria: cat.id, estado: e, justificacion: just }), {
      exito: { title: "Límite guardado", body: `${cat.nombre} · ${anio}` },
    });

  const elegir = (v) => {
    setEstado(v);
    if (v !== "excluida" || just.trim()) guardar(v);
  };

  return (
    <div className="emis-factor-row" style={{ flexWrap: "wrap", rowGap: 8 }}>
      <span className="emis-factor-scope" style={{ background: SCOPES[cat.alcance].bg, color: SCOPES[cat.alcance].color }}>
        {cat.numero ? `3.${cat.numero}` : `A${cat.alcance}`}
      </span>
      <div className="emis-factor-name">
        <div style={{ font: "600 14px/1.2 var(--rl-font-display)", color: "var(--rl-gray-900)" }}>{cat.nombre}</div>
        <div className="prt-hint" style={{ fontSize: 11 }}>ISO 14064-1: {ISO[cat.iso]}</div>
      </div>
      {tco2e > 0 && <Chip size="sm">{fmtTon(tco2e, 2)} tCO₂e</Chip>}
      {tco2e > 0 && estado === "excluida" && <Chip kind="warning" size="sm" icon="warning">Tiene emisiones</Chip>}
      {tco2e > 0 && !estado && <Chip kind="info" size="sm">Con emisiones · sin definir</Chip>}
      <Select style={{ width: 150 }} value={estado} disabled={pending} placeholder="Sin definir" onChange={elegir} options={ESTADOS} />
      {(estado === "excluida" || estado === "no-aplica") && (
        <div className="prt-row" style={{ gap: 8, width: "100%" }}>
          <div style={{ flex: 1 }}>
            <Input
              value={just}
              onChange={(v) => setJust(v.slice(0, 300))}
              placeholder={estado === "excluida" ? "Justificación de la exclusión (obligatoria)" : "Por qué no aplica (opcional)"}
              error={faltaJustificacion}
            />
          </div>
          <Btn size="sm" kind={sinGuardar ? "primary" : undefined} disabled={pending || faltaJustificacion || !sinGuardar} onClick={() => guardar()}>
            Guardar
          </Btn>
        </div>
      )}
    </div>
  );
}

export function Limites({ records, embarques, residuos, sucursales, emissions, inventario, mesActual }) {
  const conFecha = [...records, ...embarques, ...residuos];
  const anios = [...new Set([mesActual.slice(0, 4), ...conFecha.map((r) => String(r.date).slice(0, 4))])]
    .filter((a) => /^\d{4}$/.test(a))
    .sort()
    .reverse();
  const [anio, setAnio] = useState(() => anios.find((a) => conFecha.some((r) => String(r.date).startsWith(a))) || anios[0]);
  const { correr, pending } = useAccion();

  const porCategoria = useMemo(
    () =>
      emisionesPorCategoria(
        { records, embarques, residuos, sucursales, emissions, anchor: mesActual },
        { sucursal: "all", period: `custom:${anio}-01:${anio}-12` },
      ),
    [records, embarques, residuos, sucursales, emissions, mesActual, anio],
  );
  const lim = inventario.limites[anio] || { enfoque: "", categorias: {} };

  return (
    <div>
      <SectionHead
        eyebrow="Impacto Ambiental / Configuración"
        title="Límites del inventario"
        sub="Qué cuenta la huella de cada año: enfoque de control, categorías incluidas o excluidas con su justificación, y los datos de cada sucursal."
        right={
          <Link className="prt-btn" href="/impacto">
            <Icon name="arrow_back" />
            Volver al impacto
          </Link>
        }
      />

      <div className="prt-stack-md">
        <Organizacion inicial={inventario.organizacion} />

        <div className="emis-scope-switch">
          {anios.map((a) => (
            <button key={a} className={"emis-scope-tab" + (a === anio ? " active" : "")} onClick={() => setAnio(a)}>
              <Icon name="calendar_today" size={16} /> {a}
            </button>
          ))}
        </div>

        <Card>
          <div className="prt-spread" style={{ alignItems: "center" }}>
            <div>
              <div className="prt-h3">Enfoque de control {anio}</div>
              <div className="prt-hint">Define qué fuentes son propias (alcance 1) y cuáles de terceros.</div>
            </div>
            <Select
              style={{ width: 240 }}
              value={lim.enfoque || ""}
              disabled={pending}
              placeholder="Sin definir"
              onChange={(v) => correr(() => setLimiteAction(anio, { enfoque: v }), { exito: { title: "Enfoque guardado" } })}
              options={ENFOQUES}
            />
          </div>
        </Card>

        <Card flush>
          <div className="prt-card-head">
            <div>
              <div className="prt-h3">Datos de sucursal {anio}</div>
              <div className="prt-hint">Denominadores de la intensidad (tCO₂e por trabajador y por m²)</div>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="prt-table">
              <thead>
                <tr><th>Sucursal</th><th>Trabajadores</th><th>Superficie</th><th /></tr>
              </thead>
              <tbody>
                {sucursales.map((s) => (
                  <FilaSucursal key={anio + s.id} anio={anio} suc={s} datos={inventario.datosSucursal[anio]?.[s.id]} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {[1, 2, 3].map((alcance) => (
          <Card key={alcance} flush>
            <div className="prt-card-head">
              <div>
                <div className="prt-h3">{SCOPES[alcance].label}</div>
                <div className="prt-hint">{SCOPES[alcance].desc}</div>
              </div>
            </div>
            <div style={{ padding: "6px 22px 14px" }}>
              {CATEGORIAS.filter((c) => c.alcance === alcance).map((c) => (
                <FilaCategoria
                  key={anio + c.id}
                  anio={anio}
                  cat={c}
                  guardado={lim.categorias?.[c.id]}
                  tco2e={porCategoria[c.id]?.tco2e || 0}
                />
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
