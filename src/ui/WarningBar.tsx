import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { computeWarnings } from "../rules";
import { activateWarning } from "./warnings";
import { deleteOpening } from "../store/commands";
import type { ProjectStore } from "../store/history";
import type { ViewStore } from "../store/view";

/** Warnungsleiste am unteren Rand: Anzahl, aufklappbare Liste, Klick wählt das Objekt. */
export function WarningBar({ store, view }: { store: ProjectStore; view: ViewStore }) {
  const project = useStore(store, (s) => s.project);
  const warnings = useMemo(() => computeWarnings(project), [project]);
  const [open, setOpen] = useState(false);
  const count = warnings.length;
  return (
    <footer aria-label="Warnungen" className="warning-bar">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        disabled={count === 0}
      >
        {count === 0 ? "Keine Warnungen" : count === 1 ? "1 Warnung" : `${count} Warnungen`}
      </button>
      {open && count > 0 && (
        <ul aria-label="Warnungsliste" className="warning-bar__list">
          {warnings.map((w) => (
            <li key={w.key}>
              {w.target.kind === "none" ? (
                <span>{w.text}</span>
              ) : (
                <button
                  type="button"
                  className="link"
                  onClick={() => activateWarning(w, store, view)}
                >
                  {w.text}
                </button>
              )}
              {w.deletable && (
                <button
                  type="button"
                  aria-label={`Löschen: ${w.text}`}
                  onClick={() => store.execute(deleteOpening(w.deletable!.id))}
                >
                  Löschen
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </footer>
  );
}
