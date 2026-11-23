/**
 * Leiste „Licht“ der 3D-Ansicht (design.md M6 „Licht in 3D“): Modus, Schatten, alle an/aus,
 * Leuchten je Stromkreis. Ansichtszustand, nicht gespeichert.
 */
import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { lightGroups, MAX_LIGHTS, toggleGroup } from "../../geometry/lighting";
import type { Device, Project } from "../../model/types";
import type { ViewStore } from "../../store/view";

function GroupBox({
  label,
  state,
  onToggle,
}: {
  label: string;
  state: "on" | "off" | "mixed";
  onToggle(): void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === "mixed";
  }, [state]);
  return (
    <label className="light-panel__group">
      <input ref={ref} type="checkbox" checked={state === "on"} onChange={onToggle} /> {label}
    </label>
  );
}

export function LightPanel({
  project,
  view,
  devices,
  shown,
  on,
}: {
  project: Project;
  view: ViewStore;
  /** sichtbare Geräte der Szene */
  devices: readonly Device[];
  /** dargestellte und eingeschaltete Lichtquellen */
  shown: number;
  on: number;
}) {
  const [open, setOpen] = useState(true);
  const mode = useStore(view, (s) => s.lightMode);
  const shadows = useStore(view, (s) => s.shadows);
  const lightsOff = useStore(view, (s) => s.lightsOff);
  const off = new Set(lightsOff);
  const groups = lightGroups(project, devices);
  const all = groups.flatMap((g) => g.deviceIds);
  const label = (id: string) => project.devices.find((d) => d.id === id)?.label ?? id;
  return (
    <aside className="light-panel" aria-label="Licht">
      <button type="button" className="light-panel__toggle" onClick={() => setOpen(!open)}>
        Licht {open ? "▾" : "▸"}
      </button>
      {open && (
        <div className="light-panel__body">
          <fieldset>
            <legend>Beleuchtung</legend>
            <label>
              <input
                type="radio"
                name="light-mode"
                checked={mode === "uniform"}
                onChange={() => view.setLightMode("uniform")}
              />{" "}
              Gleichmäßig
            </label>
            <label>
              <input
                type="radio"
                name="light-mode"
                checked={mode === "lights"}
                onChange={() => view.setLightMode("lights")}
              />{" "}
              Leuchten
            </label>
          </fieldset>
          <label>
            <input
              type="checkbox"
              checked={shadows}
              disabled={mode !== "lights"}
              onChange={(e) => view.setShadows(e.target.checked)}
            />{" "}
            Schatten
          </label>
          <div className="light-panel__buttons">
            <button type="button" onClick={() => view.setLightsOff([])}>
              Alle an
            </button>
            <button type="button" onClick={() => view.setLightsOff(all)}>
              Alle aus
            </button>
          </div>
          {groups.length === 0 && <p className="hint">Keine Leuchten sichtbar.</p>}
          {groups.map((g) => {
            const n = g.deviceIds.filter((id) => !off.has(id)).length;
            const state = n === g.deviceIds.length ? "on" : n === 0 ? "off" : "mixed";
            return (
              <div key={g.circuitId ?? "-"} className="light-panel__circuit">
                <GroupBox
                  label={g.label}
                  state={state}
                  onToggle={() => view.setLightsOff(toggleGroup(off, g.deviceIds))}
                />
                <ul>
                  {g.deviceIds.map((id) => (
                    <li key={id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={!off.has(id)}
                          onChange={() => view.setLightsOff(toggleGroup(off, [id]))}
                        />{" "}
                        {label(id)}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {mode === "lights" && on > shown && (
            <p className="hint" role="status">
              {shown} von {on} Leuchten dargestellt (höchstens {MAX_LIGHTS})
            </p>
          )}
        </div>
      )}
    </aside>
  );
}
