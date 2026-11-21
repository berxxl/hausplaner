import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { isSuppressible, type ProjectWarning } from "../rules";
import { deleteOpening } from "../store/commands";
import { deleteDevices } from "../store/devices";
import { deleteFurniture } from "../store/furniture";
import type { Command, ProjectStore } from "../store/history";
import type { ViewStore } from "../store/view";
import { reactivateWarning, suppressWarning } from "../store/warnings";
import { warningsOf } from "./derived";
import { activateWarning, warningInfos, type WarningInfo } from "./warnings";

function deleteCommand(target: NonNullable<ProjectWarning["deletable"]>): Command {
  if (target.kind === "device") return deleteDevices([target.id]);
  if (target.kind === "furniture") return deleteFurniture([target.id]);
  return deleteOpening(target.id);
}

const countLabel = (n: number) =>
  n === 0 ? "Keine Warnungen" : n === 1 ? "1 Warnung" : `${n} Warnungen`;

/**
 * Warnungsübersicht am unteren Rand (design.md M2 „Warnungen“): offene Warnungen mit Regel, Element
 * und Ort; Klick führt zur Ursache; Übergehen, Wieder aktivieren und Löschen sind Befehle.
 */
export function WarningBar({ store, view }: { store: ProjectStore; view: ViewStore }) {
  const project = useStore(store, (s) => s.project);
  const [open, setOpen] = useState(false);
  const [showSuppressed, setShowSuppressed] = useState(false);
  const { active, suppressed } = useMemo(() => {
    const keys = new Set(project.suppressedWarnings);
    const infos = warningInfos(project, warningsOf(project));
    return {
      active: infos.filter((i) => !keys.has(i.warning.key)),
      suppressed: infos.filter((i) => keys.has(i.warning.key)),
    };
  }, [project]);
  const count = active.length;

  const row = (info: WarningInfo, mode: "active" | "suppressed") => {
    const w = info.warning;
    return (
      <tr key={w.key} data-warning={w.key}>
        <td>
          {w.target.kind === "none" ? (
            <span>{w.text}</span>
          ) : (
            <button type="button" className="link" onClick={() => activateWarning(w, store, view)}>
              {w.text}
            </button>
          )}
        </td>
        <td>{info.element}</td>
        <td>{info.location}</td>
        <td className="warning-bar__actions">
          {mode === "active" && isSuppressible(w) && (
            <button
              type="button"
              aria-label={`Übergehen: ${w.text}`}
              onClick={() => store.execute(suppressWarning(w.key))}
            >
              Übergehen
            </button>
          )}
          {mode === "suppressed" && (
            <button
              type="button"
              aria-label={`Wieder aktivieren: ${w.text}`}
              onClick={() => store.execute(reactivateWarning(w.key))}
            >
              Wieder aktivieren
            </button>
          )}
          {w.deletable && (
            <button
              type="button"
              aria-label={`Löschen: ${w.text}`}
              onClick={() => store.execute(deleteCommand(w.deletable!))}
            >
              Löschen
            </button>
          )}
        </td>
      </tr>
    );
  };

  const table = (label: string, infos: WarningInfo[], mode: "active" | "suppressed") => (
    <table aria-label={label} className="warning-bar__table">
      <thead>
        <tr>
          <th scope="col">Regel</th>
          <th scope="col">Element</th>
          <th scope="col">Ort</th>
          <th scope="col">
            <span className="visually-hidden">Aktionen</span>
          </th>
        </tr>
      </thead>
      <tbody>{infos.map((i) => row(i, mode))}</tbody>
    </table>
  );

  return (
    <footer aria-label="Warnungen" className="warning-bar">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        disabled={count === 0 && suppressed.length === 0}
      >
        {countLabel(count)}
        {suppressed.length > 0 && ` · ${suppressed.length} übergangen`}
      </button>
      {open && (count > 0 || suppressed.length > 0) && (
        <div className="warning-bar__panel">
          {count > 0 && table("Warnungsliste", active, "active")}
          {suppressed.length > 0 && (
            <>
              <button
                type="button"
                className="link"
                aria-expanded={showSuppressed}
                onClick={() => setShowSuppressed(!showSuppressed)}
              >
                übergangen ({suppressed.length})
              </button>
              {showSuppressed && table("Übergangene Warnungen", suppressed, "suppressed")}
            </>
          )}
        </div>
      )}
    </footer>
  );
}
