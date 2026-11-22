import { useState } from "react";
import { useStore } from "zustand";
import { roundDeg } from "../model/rounding";
import type { InstallZones } from "../model/types";
import { setInstallZones, setNorthDeg, setProjectName, setReserves } from "../store/commands";
import { lineParticipantCount } from "../geometry/knx";
import { allIds } from "../model/factory";
import { newId } from "../model/ids";
import { addKnxLine, assignLineParticipants, deleteKnxLine, editKnxLine } from "../store/knx";
import type { ProjectStore } from "../store/history";
import { setLengthAllowance } from "../store/cables";
import { DegField, MmField, NumberField, TextField } from "./fields";

const ZONE_ROWS: { key: keyof InstallZones; label: string }[] = [
  { key: "horizontalTop", label: "Obere Zone unter der Decke" },
  { key: "horizontalBottom", label: "Untere Zone über OKFF" },
  { key: "verticalFromEdge", label: "Senkrechte Zone neben Ecken und Laibungen" },
];

/**
 * Projekteinstellungen: Projektname, Nordrichtung, Installationszonen, Leitungszuschläge, Reserven
 * und KNX-Linien (M4), undo-fähig.
 */
export function ProjectSettings({ store, onClose }: { store: ProjectStore; onClose(): void }) {
  const name = useStore(store, (s) => s.project.name);
  const northDeg = useStore(store, (s) => s.project.settings.northDeg);
  const zones = useStore(store, (s) => s.project.settings.installZones);
  const allowance = useStore(store, (s) => s.project.settings.lengthAllowance);
  const project = useStore(store, (s) => s.project);
  const { teReservePercent, actuatorReservePercent } = project.settings;
  const [lineMessage, setLineMessage] = useState<string | null>(null);
  const commitReserves = (patch: {
    teReservePercent?: number;
    actuatorReservePercent?: number;
  }) => {
    const r = setReserves({ teReservePercent, actuatorReservePercent, ...patch });
    if (r.ok) store.execute(r.command);
    else setResets((n) => n + 1);
  };
  const commitAllowance = (patch: Partial<typeof allowance>) => {
    const r = setLengthAllowance({ ...allowance, ...patch });
    if (r.ok) store.execute(r.command);
  };
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
        <fieldset className="settings__zones">
          <legend>Leitungslängen</legend>
          <MmField
            label="Zuschlag je Geräteendpunkt (mm)"
            min={0}
            value={allowance.perDeviceMm}
            onCommit={(perDeviceMm) => commitAllowance({ perDeviceMm })}
          />
          <MmField
            label="Zuschlag je Verteilerendpunkt (mm)"
            min={0}
            value={allowance.perBoardMm}
            onCommit={(perBoardMm) => commitAllowance({ perBoardMm })}
          />
          <MmField
            label="Verschnitt (%)"
            min={0}
            value={allowance.wastePercent}
            onCommit={(wastePercent) => commitAllowance({ wastePercent })}
          />
        </fieldset>
        <fieldset className="settings__zones">
          <legend>Verteiler</legend>
          <NumberField
            key={`te#${resets}`}
            label="TE-Reserve (%)"
            min={0}
            value={teReservePercent}
            onCommit={(v) => commitReserves({ teReservePercent: v })}
          />
          <NumberField
            key={`akt#${resets}`}
            label="Aktorreserve (%)"
            min={0}
            value={actuatorReservePercent}
            onCommit={(v) => commitReserves({ actuatorReservePercent: v })}
          />
        </fieldset>
        <fieldset className="settings__zones">
          <legend>KNX-Linien</legend>
          {project.knxLines.map((l) => (
            <div key={l.id} role="group" aria-label={`Linie ${l.label}`} className="settings__line">
              <TextField
                label={`Bezeichnung Linie ${l.label}`}
                value={l.label}
                onCommit={(label) => store.execute(editKnxLine(l.id, { label }))}
              />
              <div className="field">
                <label htmlFor={`line-board-${l.id}`}>Verteiler Linie {l.label}</label>
                <select
                  id={`line-board-${l.id}`}
                  value={l.boardId ?? ""}
                  onChange={(e) =>
                    store.execute(editKnxLine(l.id, { boardId: e.target.value || null }))
                  }
                >
                  <option value="">keiner</option>
                  {project.boards.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>
              <span className="field-info" aria-label={`Teilnehmer Linie ${l.label}`}>
                {lineParticipantCount(project, l.id)} Teilnehmer
              </span>
              <button
                type="button"
                onClick={() => {
                  const r = assignLineParticipants(project, l.id);
                  if (!r.ok) return setLineMessage(r.error);
                  setLineMessage(null);
                  store.execute(r.command);
                }}
              >
                Teilnehmer über Busleitungen zuordnen
              </button>
              <button type="button" onClick={() => store.execute(deleteKnxLine(l.id))}>
                Linie löschen
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const n = project.knxLines.length + 1;
              store.execute(addKnxLine({ id: newId(new Set(allIds(project))), label: `1.${n}` }));
            }}
          >
            Linie hinzufügen
          </button>
          {lineMessage && (
            <p role="status" className="field-info">
              {lineMessage}
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
