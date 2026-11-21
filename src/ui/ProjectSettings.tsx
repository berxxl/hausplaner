import { useState } from "react";
import { useStore } from "zustand";
import { roundDeg } from "../model/rounding";
import type { InstallZones } from "../model/types";
import { setInstallZones, setNorthDeg, setProjectName } from "../store/commands";
import type { ProjectStore } from "../store/history";
import { DegField, MmField, TextField } from "./fields";

const ZONE_ROWS: { key: keyof InstallZones; label: string }[] = [
  { key: "horizontalTop", label: "Obere Zone unter der Decke" },
  { key: "horizontalBottom", label: "Untere Zone über OKFF" },
  { key: "verticalFromEdge", label: "Senkrechte Zone neben Ecken und Laibungen" },
];

/** Projekteinstellungen: Projektname, Nordrichtung und Installationszonen, undo-fähig. */
export function ProjectSettings({ store, onClose }: { store: ProjectStore; onClose(): void }) {
  const name = useStore(store, (s) => s.project.name);
  const northDeg = useStore(store, (s) => s.project.settings.northDeg);
  const zones = useStore(store, (s) => s.project.settings.installZones);
  const [zoneError, setZoneError] = useState<string | null>(null);
  // abgelehnte Eingabe: Felder neu aufbauen, damit sie den gespeicherten Wert zeigen
  const [resets, setResets] = useState(0);
  const commitZone = (key: keyof InstallZones, index: 0 | 1, value: number) => {
    const range: [number, number] = [...zones[key]];
    range[index] = value;
    const r = setInstallZones({ ...zones, [key]: range });
    if (!r.ok) {
      setResets((n) => n + 1);
      return setZoneError(r.error);
    }
    setZoneError(null);
    store.execute(r.command);
  };
  return (
    <div className="dialog-backdrop">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="dialog"
        onKeyDown={(e) => {
          if (e.key === "Escape" && !(e.target instanceof HTMLInputElement)) onClose();
        }}
      >
        <h2 id="settings-title">Projekteinstellungen</h2>
        <TextField
          label="Projektname"
          value={name}
          onCommit={(v) => store.execute(setProjectName(v))}
        />
        <DegField
          label="Nordrichtung (0° = oben im Grundriss, im Uhrzeigersinn)"
          value={northDeg}
          onCommit={(v) => store.execute(setNorthDeg(roundDeg(((v % 360) + 360) % 360)))}
        />
        <fieldset className="settings__zones">
          <legend>Installationszonen (mm)</legend>
          {ZONE_ROWS.map(({ key, label }) => (
            <div
              key={`${key}#${resets}`}
              role="group"
              aria-label={label}
              className="settings__zone"
            >
              <span>{label}</span>
              <MmField
                label={`${label} von`}
                min={0}
                value={zones[key][0]}
                onCommit={(v) => commitZone(key, 0, v)}
              />
              <MmField
                label={`${label} bis`}
                min={0}
                value={zones[key][1]}
                onCommit={(v) => commitZone(key, 1, v)}
              />
            </div>
          ))}
          {zoneError && (
            <p role="alert" className="settings__error">
              {zoneError}
            </p>
          )}
        </fieldset>
        <div className="dialog__buttons">
          <button type="button" onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
