import { useState } from "react";
import { newStorey, suggestNextStorey } from "../model/factory";
import { slugify } from "../model/slug";
import type { Project, Storey } from "../model/types";
import { MmField } from "./fields";

export interface AddStoreyDialogProps {
  project: Project;
  onAdd(storey: Storey): void;
  onClose(): void;
}

/** Neues Geschoss: Name zuerst, weil daraus einmalig der Dateiname entsteht; Höhen vorgeschlagen aus dem höchsten Geschoss. */
export function AddStoreyDialog({ project, onAdd, onClose }: AddStoreyDialogProps) {
  const [suggestion] = useState(() => suggestNextStorey(project));
  const [name, setName] = useState("");
  const [elevationMm, setElevation] = useState(suggestion.elevationMm);
  const [rawHeightMm, setRawHeight] = useState(suggestion.rawHeightMm);
  const trimmed = name.trim();
  return (
    <div className="dialog-backdrop">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-storey-title"
        className="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (!trimmed) return;
          onAdd(newStorey(project, trimmed, { ...suggestion, elevationMm, rawHeightMm }));
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !(e.target instanceof HTMLInputElement)) onClose();
        }}
      >
        <h2 id="add-storey-title">Geschoss hinzufügen</h2>
        <div className="field">
          <label htmlFor="add-storey-name">Name</label>
          <input
            id="add-storey-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        {trimmed && (
          <p className="hint">
            Datei: geschosse/{slugify(trimmed)}.yaml (bleibt beim Umbenennen gleich)
          </p>
        )}
        <MmField label="Höhenlage Rohfußboden" value={elevationMm} onCommit={setElevation} />
        <MmField label="Rohbauhöhe" value={rawHeightMm} min={1} onCommit={setRawHeight} />
        <p className="hint">
          Fußbodenaufbau {suggestion.defaults.floorBuildupMm} mm, Putz{" "}
          {suggestion.defaults.plasterMm} mm, Abhängung {suggestion.defaults.suspendedMm} mm wie im
          höchsten Geschoss; später änderbar.
        </p>
        <div className="dialog__buttons">
          <button type="button" onClick={onClose}>
            Abbrechen
          </button>
          <button type="submit" disabled={!trimmed}>
            Hinzufügen
          </button>
        </div>
      </form>
    </div>
  );
}
