import { useStore } from "zustand";
import { roundDeg } from "../model/rounding";
import { setNorthDeg, setProjectName } from "../store/commands";
import type { ProjectStore } from "../store/history";
import { DegField, TextField } from "./fields";

/** Projekteinstellungen: Projektname und Nordrichtung, undo-fähig. */
export function ProjectSettings({ store, onClose }: { store: ProjectStore; onClose(): void }) {
  const name = useStore(store, (s) => s.project.name);
  const northDeg = useStore(store, (s) => s.project.settings.northDeg);
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
        <div className="dialog__buttons">
          <button type="button" onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
