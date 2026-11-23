import { useId, useRef, useState } from "react";
import { useStore } from "zustand";
import { allIds } from "../../model/factory";
import { newId } from "../../model/ids";
import { KNX_FUNCTIONS, MOUNTINGS, TRADES } from "../../model/schema";
import { importSvgSymbol } from "../../model/symbol";
import { refrigerantUnit } from "../../model/devices";
import type {
  DeviceType,
  FurnitureType,
  LineType,
  Mounting,
  Project,
  Trade,
} from "../../model/types";
import {
  addCatalogType,
  copyCatalogType,
  deleteCatalogType,
  MOUNTING_LABELS,
  updateCatalogType,
  type CatalogEntry,
  type CatalogKind,
} from "../../store/catalog";
import type { ProjectStore } from "../../store/history";
import { MmField, NumberField, OptionalNumberField, TextField } from "../fields";
import { KNX_FUNCTION_LABELS, LIGHT_KIND_LABELS, TRADE_LABELS } from "../labels";
import { SymbolView } from "../SymbolView";

const TABS: { kind: CatalogKind; label: string }[] = [
  { kind: "deviceTypes", label: "Geräte" },
  { kind: "lineTypes", label: "Leitungen" },
  { kind: "furnitureTypes", label: "Möbel" },
];

const NEW_SYMBOL =
  "<rect x='20' y='20' width='60' height='60' stroke='currentColor' stroke-width='5' fill='none'/>";

function newEntry(project: Project, kind: CatalogKind): CatalogEntry<CatalogKind> {
  const id = newId(new Set(allIds(project)));
  if (kind === "deviceTypes")
    return {
      id,
      name: "Neuer Gerätetyp",
      trade: "other",
      symbol: NEW_SYMBOL,
      shape3d: { kind: "box", widthMm: 80, heightMm: 80, depthMm: 20 },
      mounting: ["wall"],
      connects: [],
    } satisfies DeviceType;
  if (kind === "lineTypes")
    return {
      id,
      name: "Neuer Leitungstyp",
      trade: "power",
      outerDiameterMm: 10,
      color: "#757575",
    } satisfies LineType;
  return {
    id,
    name: "Neues Möbel",
    widthMm: 1000,
    depthMm: 600,
    heightMm: 800,
    elevationMm: 0,
  } satisfies FurnitureType;
}

/** Katalogfenster: Geräte-, Leitungs- und Möbeltypen anlegen, kopieren, ändern, löschen. */
export function CatalogDialog({ store, onClose }: { store: ProjectStore; onClose(): void }) {
  const project = useStore(store, (s) => s.project);
  const [kind, setKind] = useState<CatalogKind>("deviceTypes");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const list = project.catalog[kind] as CatalogEntry<CatalogKind>[];
  const selected = list.find((t) => t.id === selectedId) ?? null;

  const update = (entry: CatalogEntry<CatalogKind>) => {
    const r = updateCatalogType(project, kind, entry);
    if (r.ok) {
      setError(null);
      store.execute(r.command);
    } else setError(r.error);
  };

  const grouped =
    kind === "deviceTypes"
      ? TRADES.map((trade) => ({
          title: TRADE_LABELS[trade],
          items: (list as DeviceType[]).filter((t) => t.trade === trade),
        })).filter((g) => g.items.length > 0)
      : [{ title: "", items: list }];

  return (
    <div className="dialog-backdrop">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-title"
        className="dialog catalog"
        onKeyDown={(e) => {
          if (e.key === "Escape" && !(e.target instanceof HTMLInputElement)) onClose();
        }}
      >
        <h2 id="catalog-title">Katalog</h2>
        <div role="tablist" aria-label="Katalogart" className="catalog__tabs">
          {TABS.map((t) => (
            <button
              key={t.kind}
              type="button"
              role="tab"
              aria-selected={t.kind === kind}
              onClick={() => {
                setKind(t.kind);
                setSelectedId(null);
                setError(null);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="catalog__body">
          <div className="catalog__list">
            <ul role="listbox" aria-label="Typen">
              {grouped.map((g) => [
                g.title && (
                  <li key={`h-${g.title}`} role="presentation" className="catalog__group">
                    {g.title}
                  </li>
                ),
                ...[...g.items]
                  .sort((a, b) => a.name.localeCompare(b.name, "de"))
                  .map((t) => (
                    <li
                      key={t.id}
                      role="option"
                      aria-selected={t.id === selectedId}
                      tabIndex={0}
                      onClick={() => {
                        setSelectedId(t.id);
                        setError(null);
                      }}
                      onKeyDown={(e) => e.key === "Enter" && setSelectedId(t.id)}
                    >
                      {"symbol" in t && <SymbolView symbol={t.symbol} size={20} />} {t.name}
                    </li>
                  )),
              ])}
            </ul>
            <div className="catalog__actions">
              <button
                type="button"
                onClick={() => {
                  const entry = newEntry(project, kind);
                  store.execute(addCatalogType(kind, entry));
                  setSelectedId(entry.id);
                  setError(null);
                }}
              >
                Neu
              </button>
              <button
                type="button"
                disabled={!selected}
                onClick={() => {
                  const r = selected && copyCatalogType(project, kind, selected.id);
                  if (!r) return;
                  store.execute(r.command);
                  setSelectedId(r.id);
                  setError(null);
                }}
              >
                Kopieren
              </button>
              <button
                type="button"
                disabled={!selected}
                onClick={() => {
                  if (!selected) return;
                  const r = deleteCatalogType(project, kind, selected.id);
                  if (!r.ok) return setError(r.error);
                  store.execute(r.command);
                  setSelectedId(null);
                  setError(null);
                }}
              >
                Löschen
              </button>
            </div>
          </div>
          <div className="catalog__form" aria-label="Eigenschaften des Typs" role="group">
            {error && (
              <p role="alert" className="catalog__error">
                {error}
              </p>
            )}
            {!selected && <p className="placeholder">Typ links auswählen oder neu anlegen.</p>}
            {selected && kind === "deviceTypes" && (
              <DeviceTypeForm
                key={selected.id}
                type={selected as DeviceType}
                onChange={update}
                onError={setError}
              />
            )}
            {selected && kind === "lineTypes" && (
              <LineTypeForm key={selected.id} type={selected as LineType} onChange={update} />
            )}
            {selected && kind === "furnitureTypes" && (
              <FurnitureTypeForm
                key={selected.id}
                type={selected as FurnitureType}
                onChange={update}
              />
            )}
          </div>
        </div>
        <div className="dialog__buttons">
          <button type="button" onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}

function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange(v: T): void;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Checks<T extends string>({
  legend,
  values,
  options,
  onChange,
}: {
  legend: string;
  values: T[];
  options: { value: T; label: string }[];
  onChange(v: T[]): void;
}) {
  return (
    <fieldset className="field field--checks">
      <legend>{legend}</legend>
      {options.map((o) => (
        <label key={o.value}>
          <input
            type="checkbox"
            checked={values.includes(o.value)}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? options.map((x) => x.value).filter((v) => v === o.value || values.includes(v))
                  : values.filter((v) => v !== o.value),
              )
            }
          />{" "}
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}

const tradeOptions = TRADES.map((t) => ({ value: t, label: TRADE_LABELS[t] }));

function DeviceTypeForm({
  type,
  onChange,
  onError,
}: {
  type: DeviceType;
  onChange(t: DeviceType): void;
  onError(message: string | null): void;
}) {
  const set = <K extends keyof DeviceType>(key: K, value: DeviceType[K]) => {
    const next = { ...type, [key]: value };
    if (value === undefined) delete next[key];
    onChange(next);
  };
  const fileInput = useRef<HTMLInputElement>(null);
  const knx = type.knx ?? {};
  return (
    <>
      <TextField label="Name" value={type.name} onCommit={(v) => set("name", v)} />
      <Select<Trade>
        label="Gewerk"
        value={type.trade}
        options={tradeOptions}
        onChange={(v) => set("trade", v)}
      />
      <Checks<Mounting>
        legend="Montagearten"
        values={type.mounting}
        options={MOUNTINGS.map((m) => ({ value: m, label: MOUNTING_LABELS[m] }))}
        onChange={(v) => set("mounting", v)}
      />
      <OptionalNumberField
        label="Standardhöhe über OKFF"
        suffix="mm"
        value={type.defaultHeightMm}
        onCommit={(v) => set("defaultHeightMm", v)}
      />
      <OptionalNumberField
        label="Unterputz-Dosentiefe"
        suffix="mm"
        min={1}
        value={type.flush?.boxDepthMm}
        onCommit={(v) => set("flush", v === undefined ? undefined : { boxDepthMm: v })}
      />
      <OptionalNumberField
        label="Breite im Verteiler"
        suffix="TE"
        decimals={1}
        min={0.5}
        value={type.teWidth}
        onCommit={(v) => set("teWidth", v)}
      />
      <Checks<Trade>
        legend="Anschließbare Gewerke"
        values={type.connects}
        options={tradeOptions}
        onChange={(v) => set("connects", v)}
      />
      <fieldset className="field field--group">
        <legend>3D-Form</legend>
        <Select
          label="Form"
          value={type.shape3d.kind}
          options={[
            { value: "box", label: "Quader" },
            { value: "cylinder", label: "Zylinder" },
          ]}
          onChange={(v) => set("shape3d", { ...type.shape3d, kind: v })}
        />
        <MmField
          label="Breite"
          min={1}
          value={type.shape3d.widthMm}
          onCommit={(v) => set("shape3d", { ...type.shape3d, widthMm: v })}
        />
        <MmField
          label="Höhe"
          min={1}
          value={type.shape3d.heightMm}
          onCommit={(v) => set("shape3d", { ...type.shape3d, heightMm: v })}
        />
        <MmField
          label="Tiefe"
          min={1}
          value={type.shape3d.depthMm}
          onCommit={(v) => set("shape3d", { ...type.shape3d, depthMm: v })}
        />
      </fieldset>
      <fieldset className="field field--group">
        <legend>Symbol</legend>
        <SymbolView symbol={type.symbol} size={64} title={`Symbol ${type.name}`} />
        <button type="button" onClick={() => fileInput.current?.click()}>
          SVG importieren …
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".svg,image/svg+xml"
          aria-label="SVG-Datei für das Symbol"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            const r = importSvgSymbol(await file.text());
            if (!r.ok) return onError(r.error);
            onError(null);
            set("symbol", r.symbol);
          }}
        />
      </fieldset>
      <fieldset className="field field--group">
        <legend>KNX</legend>
        <Select
          label="Verbraucht Kanal"
          value={knx.consumes ?? ""}
          options={[
            { value: "", label: "–" },
            ...KNX_FUNCTIONS.map((f) => ({ value: f, label: KNX_FUNCTION_LABELS[f] })),
          ]}
          onChange={(v) => {
            const next = { ...knx, consumes: v || undefined };
            if (!v) delete next.consumes;
            set("knx", next.consumes || next.provides ? next : undefined);
          }}
        />
        <Select
          label="Stellt Kanäle bereit"
          value={knx.provides?.function ?? ""}
          options={[
            { value: "", label: "–" },
            ...KNX_FUNCTIONS.map((f) => ({ value: f, label: KNX_FUNCTION_LABELS[f] })),
          ]}
          onChange={(v) => {
            const next = {
              ...knx,
              provides: v ? { function: v, channels: knx.provides?.channels ?? 4 } : undefined,
            };
            if (!v) delete next.provides;
            set("knx", next.consumes || next.provides ? next : undefined);
          }}
        />
        {knx.provides && (
          <NumberField
            label="Kanäle"
            min={1}
            value={knx.provides.channels}
            onCommit={(v) => set("knx", { ...knx, provides: { ...knx.provides!, channels: v } })}
          />
        )}
      </fieldset>
      <fieldset className="field field--group">
        <legend>
          <label>
            <input
              type="checkbox"
              checked={!!type.light}
              onChange={(e) =>
                set(
                  "light",
                  e.target.checked ? { kind: "point", lumen: 800, colorTempK: 3000 } : undefined,
                )
              }
            />{" "}
            Licht
          </label>
        </legend>
        {type.light && (
          <>
            <Select
              label="Art"
              value={type.light.kind}
              options={(["spot", "point", "area"] as const).map((k) => ({
                value: k,
                label: LIGHT_KIND_LABELS[k],
              }))}
              onChange={(v) => set("light", { ...type.light!, kind: v })}
            />
            <NumberField
              label="Lichtstrom"
              suffix="lm"
              min={1}
              value={type.light.lumen}
              onCommit={(v) => set("light", { ...type.light!, lumen: v })}
            />
            <OptionalNumberField
              label="Abstrahlwinkel"
              suffix="°"
              decimals={1}
              value={type.light.beamAngleDeg}
              onCommit={(v) => {
                const next = { ...type.light!, beamAngleDeg: v };
                if (v === undefined) delete next.beamAngleDeg;
                set("light", next);
              }}
            />
            <NumberField
              label="Farbtemperatur"
              suffix="K"
              min={1}
              value={type.light.colorTempK}
              onCommit={(v) => set("light", { ...type.light!, colorTempK: v })}
            />
          </>
        )}
      </fieldset>
      <fieldset className="field field--group">
        <legend>
          <label>
            <input
              type="checkbox"
              checked={!!type.refrigerant}
              onChange={(e) =>
                set(
                  "refrigerant",
                  e.target.checked
                    ? {
                        unit: type.connects.includes("condensate") ? "indoor" : "outdoor",
                        minLengthM: 3,
                        maxLengthM: 25,
                        prechargedLengthM: 7,
                      }
                    : undefined,
                )
              }
            />{" "}
            Kältemittel
          </label>
        </legend>
        {type.refrigerant && (
          <Select
            label="Gerät"
            value={refrigerantUnit(type) ?? "outdoor"}
            options={[
              { value: "indoor" as const, label: "Innengerät" },
              { value: "outdoor" as const, label: "Außengerät" },
            ]}
            onChange={(unit) => set("refrigerant", { ...type.refrigerant!, unit })}
          />
        )}
        {type.refrigerant && refrigerantUnit(type) === "outdoor" && (
          <>
            <NumberField
              label="Leitungslänge min."
              suffix="m"
              decimals={1}
              min={0}
              value={type.refrigerant.minLengthM}
              onCommit={(v) => set("refrigerant", { ...type.refrigerant!, minLengthM: v })}
            />
            <NumberField
              label="Leitungslänge max."
              suffix="m"
              decimals={1}
              min={0.1}
              value={type.refrigerant.maxLengthM}
              onCommit={(v) => set("refrigerant", { ...type.refrigerant!, maxLengthM: v })}
            />
            <NumberField
              label="Vorgefüllt bis"
              suffix="m"
              decimals={1}
              min={0}
              value={type.refrigerant.prechargedLengthM}
              onCommit={(v) => set("refrigerant", { ...type.refrigerant!, prechargedLengthM: v })}
            />
          </>
        )}
      </fieldset>
    </>
  );
}

function LineTypeForm({ type, onChange }: { type: LineType; onChange(t: LineType): void }) {
  const id = useId();
  return (
    <>
      <TextField label="Name" value={type.name} onCommit={(v) => onChange({ ...type, name: v })} />
      <Select<Trade>
        label="Gewerk"
        value={type.trade}
        options={tradeOptions}
        onChange={(v) => onChange({ ...type, trade: v })}
      />
      <NumberField
        label="Außendurchmesser"
        suffix="mm"
        decimals={1}
        min={0.1}
        value={type.outerDiameterMm}
        onCommit={(v) => onChange({ ...type, outerDiameterMm: v })}
      />
      <div className="field">
        <label htmlFor={id}>Farbe</label>
        <input
          id={id}
          type="color"
          value={type.color}
          onChange={(e) => onChange({ ...type, color: e.target.value.toLowerCase() })}
        />
      </div>
    </>
  );
}

function FurnitureTypeForm({
  type,
  onChange,
}: {
  type: FurnitureType;
  onChange(t: FurnitureType): void;
}) {
  return (
    <>
      <TextField label="Name" value={type.name} onCommit={(v) => onChange({ ...type, name: v })} />
      <MmField
        label="Breite"
        min={1}
        value={type.widthMm}
        onCommit={(v) => onChange({ ...type, widthMm: v })}
      />
      <MmField
        label="Tiefe"
        min={1}
        value={type.depthMm}
        onCommit={(v) => onChange({ ...type, depthMm: v })}
      />
      <MmField
        label="Höhe"
        min={1}
        value={type.heightMm}
        onCommit={(v) => onChange({ ...type, heightMm: v })}
      />
      <MmField
        label="Höhe über OKFF"
        min={0}
        value={type.elevationMm}
        onCommit={(v) => onChange({ ...type, elevationMm: v })}
      />
    </>
  );
}
