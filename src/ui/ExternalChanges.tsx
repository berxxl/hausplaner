import { useState } from "react";
import { useStore } from "zustand";
import type { SaveController } from "../store/save";

export interface ExternalChangesProps {
  save: SaveController;
  onReload(): void;
}

/** Hinweis bei Änderungen außerhalb der App; bleibt nach „Später“ als kurze Meldung stehen. */
export function ExternalChanges({ save, onReload }: ExternalChangesProps) {
  const paths = useStore(save, (s) => s.externalChanges);
  const [later, setLater] = useState(false);
  if (paths.length === 0) return null;
  if (later) {
    return (
      <div role="region" aria-label="Externe Änderungen" className="notice notice--compact">
        Externe Änderungen, Autospeichern pausiert.{" "}
        <button type="button" onClick={onReload}>
          Neu laden
        </button>
      </div>
    );
  }
  return (
    <div role="region" aria-label="Externe Änderungen" className="notice">
      <p>Dateien wurden außerhalb der App geändert: {paths.join(", ")}</p>
      <button type="button" onClick={onReload}>
        Neu laden
      </button>
      <button type="button" onClick={() => setLater(true)}>
        Später
      </button>
    </div>
  );
}
