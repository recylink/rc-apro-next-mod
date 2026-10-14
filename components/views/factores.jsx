"use client";

// Factores de emisión por año de inventario (DISEÑO-APRO.md, decisiones 6 y 7).
//
// Cada consumo registrado en el año se traduce a una clave (qué se consumió y en
// qué unidad) y la clave toma su factor del catálogo HuellaChile + DEFRA. Acá se
// ve qué factor usa cada clave y se puede cambiar SOLO para ese año: por otra fila
// del catálogo o por un valor propio con justificación. Los otros años no se mueven.
//
// Los refrigerantes (recargas por sucursal) siguen en esta pantalla.

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { Btn, Input, Select } from "@/components/ui/controls";
import { Card, Chip, SectionHead } from "@/components/ui/layout";
import { useAccion } from "@/components/use-accion";
import { useGuardarEmisiones } from "@/components/views/guardar-emisiones";
import { setFactorAnioAction, setWttAction } from "@/app/actions/config";
import { fmtTon } from "@/lib/domain/format";
import { REFRIGERANTES_CATALOG, SCOPES } from "@/lib/domain/emisiones";
import { CAT_META, sistemaDe } from "@/lib/domain/emisiones-calc";
import { candidatos, claveFactor, describirClave, resolverFactor } from "@/lib/domain/factores";
import { nextRefrigId } from "@/lib/domain/ids";

const GWP = Object.fromEntries(REFRIGERANTES_CATALOG.map((r) => [r.id, r.gwp]));

const ORIGEN = {
  catalogo: <Chip size="sm" icon="link">Catálogo</Chip>,
  elegido: <Chip kind="info" size="sm" icon="edit">Elegido para este año</Chip>,
  propio: <Chip kind="info" size="sm" icon="edit">Valor propio</Chip>,
};

function FilaFactorAnio({ clave, anio, n, alcance, factoresPorAnio }) {
  const { correr, pending } = useAccion();
  const [propio, setPropio] = useState(null); // { valor, justificacion } mientras se edita
  const f = resolverFactor(clave, anio, factoresPorAnio);
  const opciones = candidatos(clave, anio);

  const guardar = (eleccion, title) =>
    correr(() => setFactorAnioAction(anio, clave, eleccion), {
      exito: { title, body: `${describirClave(clave)} · ${anio}` },
      onExito: () => setPropio(null),
    });

  const elegir = (id) =>
    // Elegir el default del catálogo es lo mismo que no elegir: se borra la elección.
    guardar(id === opciones[0]?.id ? null : { id }, "Factor actualizado");

  return (
    <div className="emis-factor-row" style={{ flexWrap: "wrap", rowGap: 10 }}>
      <span className="emis-factor-scope" style={{ background: SCOPES[alcance].bg, color: SCOPES[alcance].color }}>
        A{alcance}
      </span>
      <div className="emis-factor-name">
        <div style={{ font: "600 14px/1.2 var(--rl-font-display)", color: "var(--rl-gray-900)" }}>
          {describirClave(clave)}
        </div>
        <div className="prt-hint" style={{ fontSize: 11 }}>
          {f ? f.fuente : "Sin factor en el catálogo para esta unidad"} · {n} registro{n === 1 ? "" : "s"}
          {f?.justificacion ? ` · ${f.justificacion}` : ""}
        </div>
      </div>

      {f && ORIGEN[f.origen]}
      {f?.anioFactor && f.anioFactor !== Number(anio) && (
        <Chip kind="warning" size="sm" icon="info">Factor {f.anioFactor}: último publicado</Chip>
      )}

      <div className="emis-factor-value">
        <span style={{ font: "700 15px/1 var(--rl-font-display)", color: f ? "var(--rl-gray-900)" : "var(--rl-warning-700)" }}>
          {f ? f.factor.toLocaleString("es-CL", { maximumFractionDigits: 5 }) : "—"}
        </span>
        {f && <span className="prt-hint" style={{ fontSize: 11 }}>kgCO₂e/{f.unidad}</span>}
      </div>

      <div className="prt-row" style={{ gap: 8, width: "100%" }}>
        {opciones.length > 1 && (
          <Select
            style={{ flex: 1, minWidth: 0 }}
            value={f?.origen === "propio" ? "" : f?.id || ""}
            onChange={elegir}
            disabled={pending}
            placeholder="Elegir otra fila del catálogo…"
            options={opciones.map((o) => ({
              value: o.id,
              label: `${o.nombre}${o.aux ? " " + o.aux : ""} · ${o.factor.toLocaleString("es-CL", { maximumFractionDigits: 5 })} · ${o.fuente}`,
            }))}
          />
        )}
        {!propio && (
          <Btn size="sm" kind="ghost" icon="edit" disabled={pending} onClick={() => setPropio({ valor: "", justificacion: "" })}>
            Valor propio
          </Btn>
        )}
        {f && f.origen !== "catalogo" && (
          <Btn size="sm" kind="ghost" icon="undo" disabled={pending} onClick={() => guardar(null, "Vuelve al catálogo")}>
            Volver al catálogo
          </Btn>
        )}
      </div>

      {propio && (
        <div className="prt-row" style={{ gap: 8, width: "100%" }}>
          <div className="prt-input-wrap has-suffix" style={{ width: 170 }}>
            <input
              className="prt-input"
              type="number"
              step="0.0001"
              min="0"
              autoFocus
              value={propio.valor}
              onChange={(e) => setPropio({ ...propio, valor: e.target.value })}
              style={{ height: 38 }}
            />
            <span className="prt-suffix" style={{ fontSize: 11 }}>/{String(clave).split("|").pop()}</span>
          </div>
          <div style={{ flex: 1 }}>
            <Input
              value={propio.justificacion}
              onChange={(v) => setPropio({ ...propio, justificacion: v.slice(0, 200) })}
              placeholder="Justificación (obligatoria): de dónde sale el valor"
            />
          </div>
          <Btn
            size="sm"
            kind="primary"
            disabled={pending || propio.valor === "" || !propio.justificacion.trim()}
            onClick={() =>
              guardar({ valor: parseFloat(propio.valor), justificacion: propio.justificacion.trim() }, "Valor propio guardado")
            }
          >
            Guardar
          </Btn>
          <Btn size="sm" kind="ghost" onClick={() => setPropio(null)}>Cancelar</Btn>
        </div>
      )}
    </div>
  );
}

function Refrigerantes({ sucId, lista, onCambiar, onQuitar, onAgregar }) {
  if (!sucId) {
    return (
      <div className="prt-hint" style={{ padding: "14px 0" }}>
        Los refrigerantes se cargan por sucursal. Selecciona una sucursal para gestionar su catálogo.
      </div>
    );
  }

  return (
    <div>
      <div className="prt-stack-sm" style={{ marginBottom: 12 }}>
        {lista.length === 0 && (
          <div className="prt-hint" style={{ padding: "10px 0" }}>
            Sin refrigerantes registrados en esta sucursal.
          </div>
        )}
        {lista.map((rf) => (
          <FilaRefrigerante
            key={rf.uid}
            rf={rf}
            onCambiar={(patch) => onCambiar(rf.uid, patch)}
            onQuitar={() => onQuitar(rf.uid)}
          />
        ))}
      </div>
      <button className="ob-add-btn sm" onClick={onAgregar}>
        <Icon name="add" size={16} />
        <span>Agregar refrigerante</span>
      </button>
    </div>
  );
}

function FilaRefrigerante({ rf, onCambiar, onQuitar }) {
  // Los kilos se editan en local y se guardan al salir del campo: guardar por
  // cada tecla escribiría la hoja completa en cada dígito.
  const [kg, setKg] = useState(String(rf.cargaKg));
  const gwp = GWP[rf.tipo] || 0;
  const tco2e = ((parseFloat(kg) || 0) * gwp) / 1000;

  return (
    <div className="emis-refrig-row">
      <span
        className="prt-kpi-ico"
        style={{ width: 34, height: 34, background: CAT_META.refrigerantes.bg, color: CAT_META.refrigerantes.color }}
      >
        <Icon name="snowflake" size={16} />
      </span>
      <Select
        style={{ width: 130 }}
        value={rf.tipo}
        onChange={(v) => onCambiar({ tipo: v })}
        options={REFRIGERANTES_CATALOG.map((r) => ({ value: r.id, label: r.label }))}
      />
      <span className="emis-gwp-pill">GWP {gwp ? gwp.toLocaleString("es-CL") : "—"}</span>
      <div className="prt-input-wrap has-suffix" style={{ width: 130 }}>
        <input
          className="prt-input"
          type="number"
          step="0.1"
          value={kg}
          style={{ height: 38 }}
          onChange={(e) => setKg(e.target.value)}
          onBlur={() => onCambiar({ cargaKg: parseFloat(kg) || 0 })}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
        <span className="prt-suffix" style={{ fontSize: 11 }}>kg</span>
      </div>
      <span className="prt-hint" style={{ fontSize: 12, marginLeft: "auto" }}>
        = <strong style={{ color: "var(--rl-gray-800)" }}>{fmtTon(tco2e, 2)}</strong> tCO₂e
      </span>
      <button className="ob-icon-btn rc-icon-hover" title="Quitar" onClick={onQuitar}>
        <Icon name="delete" size={15} />
      </button>
    </div>
  );
}

/** Claves de factor usadas por los registros de un año, con su alcance y cuántos registros. */
function clavesDelAnio(records, sucursales, anio, wtt) {
  const porNombre = Object.fromEntries((sucursales || []).map((s) => [s.nombre, s]));
  const out = new Map();
  const sumar = (clave, alcance) => {
    if (!clave) return;
    const prev = out.get(clave);
    out.set(clave, { clave, alcance: prev ? Math.min(prev.alcance, alcance) : alcance, n: (prev?.n || 0) + 1 });
  };
  for (const r of records || []) {
    if (r.estado === "eliminada" || String(r.date).slice(0, 4) !== anio) continue;
    sumar(
      claveFactor({ ...r, sistema: sistemaDe(porNombre[r.sucursal]) }),
      r.type === "electricidad" ? 2 : r.type === "agua" ? 3 : r.alcance || 1,
    );
    if (wtt && r.type === "combustible") sumar(claveFactor({ ...r, type: "wtt" }), 3);
  }
  return [...out.values()].sort((a, b) => a.alcance - b.alcance || a.clave.localeCompare(b.clave));
}

function InterruptorWtt({ activo }) {
  const { correr, pending } = useAccion();
  return (
    <div className="emis-info-banner" style={{ marginBottom: 18, alignItems: "center" }}>
      <Icon name="local_gas_station" size={16} />
      <span className="prt-grow">
        <strong>Upstream de combustibles (WTT)</strong> · alcance 3, categoría 3. Si está incluido, cada
        registro de combustible suma su emisión de extracción y transporte, sin cargar nada aparte.
      </span>
      <Btn
        size="sm"
        kind={activo ? "ghost" : "primary"}
        disabled={pending}
        onClick={() =>
          correr(() => setWttAction(!activo), {
            exito: { title: activo ? "WTT excluido" : "WTT incluido", body: "Se recalcula la huella de todos los años." },
          })
        }
      >
        {activo ? "Excluir" : "Incluir"}
      </Btn>
    </div>
  );
}

export function Factores({ emissions: inicial, sucursales, records, anioActual, mesActual }) {
  const { guardarEmisiones, pending } = useGuardarEmisiones(inicial);
  const [emissions, setEmissions] = useState(inicial);

  const anios = [...new Set([anioActual, ...(records || []).map((r) => String(r.date).slice(0, 4))])]
    .filter((a) => /^\d{4}$/.test(a))
    .sort()
    .reverse();
  const [anio, setAnio] = useState(anios[0]);
  const [sucId, setSucId] = useState(sucursales[0]?.id || null);
  const claves = clavesDelAnio(records, sucursales, anio, inicial.wtt);

  const guardar = (siguiente, exito) => {
    setEmissions(siguiente);
    guardarEmisiones(siguiente, { exito });
  };

  const cambiarRefrig = (uid, patch) => {
    const lista = (emissions.refrigerantesSucursal[sucId] || []).map((r) =>
      r.uid === uid ? { ...r, ...patch } : r,
    );
    guardar({
      ...emissions,
      refrigerantesSucursal: { ...emissions.refrigerantesSucursal, [sucId]: lista },
    });
  };

  const quitarRefrig = (uid) => {
    const lista = (emissions.refrigerantesSucursal[sucId] || []).filter((r) => r.uid !== uid);
    guardar(
      { ...emissions, refrigerantesSucursal: { ...emissions.refrigerantesSucursal, [sucId]: lista } },
      { title: "Refrigerante eliminado" },
    );
  };

  const agregarRefrig = () => {
    const lista = [
      ...(emissions.refrigerantesSucursal[sucId] || []),
      { uid: nextRefrigId(), tipo: "r410a", cargaKg: 1, mes: mesActual },
    ];
    guardar({
      ...emissions,
      refrigerantesSucursal: { ...emissions.refrigerantesSucursal, [sucId]: lista },
    });
  };

  return (
    <div>
      <SectionHead
        eyebrow="Impacto Ambiental / Configuración"
        title="Factores de emisión"
        sub="Cada consumo toma su factor del catálogo HuellaChile + DEFRA según el año. Un cambio vale solo para el año elegido."
        right={
          <Link className="prt-btn" href="/impacto">
            <Icon name="arrow_back" />
            Volver al impacto
          </Link>
        }
      />

      <InterruptorWtt activo={inicial.wtt} />

      <div className="emis-scope-switch" style={{ marginBottom: 18 }}>
        {anios.map((a) => (
          <button key={a} className={"emis-scope-tab" + (a === anio ? " active" : "")} onClick={() => setAnio(a)}>
            <Icon name="calendar_today" size={16} /> {a}
          </button>
        ))}
      </div>

      <div className="prt-stack-md" style={{ marginBottom: 18 }}>
        <Card flush>
          <div className="prt-card-head">
            <div>
              <div className="prt-h3">Factores {anio}</div>
              <div className="prt-hint">Uno por cada consumo distinto registrado en el año</div>
            </div>
            <Chip size="sm">{claves.length} factor{claves.length === 1 ? "" : "es"}</Chip>
          </div>
          <div style={{ padding: "6px 22px 14px" }}>
            {claves.length === 0 && (
              <div className="prt-hint" style={{ padding: "14px 0" }}>
                No hay consumos registrados en {anio}. Los factores aparecen a medida que se registran.
              </div>
            )}
            {claves.map((c) => (
              <FilaFactorAnio
                key={anio + c.clave}
                clave={c.clave}
                anio={anio}
                n={c.n}
                alcance={c.alcance}
                factoresPorAnio={inicial.factoresPorAnio}
              />
            ))}
          </div>
        </Card>

        <Card flush>
          <div className="prt-card-head">
            <div className="prt-row" style={{ gap: 10 }}>
              <span
                className="emis-factor-scope"
                style={{ background: SCOPES[1].bg, color: SCOPES[1].color }}
              >
                A1
              </span>
              <div>
                <div className="prt-h3">Refrigerantes</div>
                <div className="prt-hint">Recargas por sucursal · GWP (Alcance 1, fugitivas)</div>
              </div>
            </div>
            {sucursales.length > 1 && (
              <Select
                style={{ width: 220 }}
                value={sucId || ""}
                onChange={setSucId}
                options={sucursales.map((s) => ({ value: s.id, label: s.nombre }))}
              />
            )}
          </div>
          <div style={{ padding: "16px 22px 18px", opacity: pending ? 0.6 : 1 }}>
            <Refrigerantes
              sucId={sucId}
              lista={sucId ? emissions.refrigerantesSucursal[sucId] || [] : []}
              onCambiar={cambiarRefrig}
              onQuitar={quitarRefrig}
              onAgregar={agregarRefrig}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
