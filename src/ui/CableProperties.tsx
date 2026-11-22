/** Eigenschaften einer Leitung (design.md M3 „Leitungen“): Typ, Bezeichnung, Status, Länge, Weg. */
import { useId, useState } from "react";
import { useStore } from "zustand";
import {
  cableLength,
  compatibleLineTypes,
  endpointLabel,
  formatCableLength,
} from "../geometry/cables";
import type { Cable, Project, Status } from "../model/types";
import { deleteCables, editCable, setCablePath, suggestCablePath } from "../store/cables";
import { cableCircuit } from "../geometry/circuits";
import type { ProjectStore } from "../store/history";
import type { ViewStore } from "../store/view";
import { TextField } from "./fields";
import { STATUS_LABELS } from "./labels";

export function CableProperties({
  cable,
  project,
  store,
  view,
}: {
  cable: Cable;
  project: Project;
  store: ProjectStore;
  view: ViewStore;
}) {
  const typeId = useId();
  const statusId = useId();
  const [error, setError] = useState<string | null>(null);
  const pathEdit = useStore(view, (s) => s.pathEdit);
  const editing = pathEdit?.cableId === cable.id;
  const types = compatibleLineTypes(project, cable.from, cable.to);
  const current = project.catalog.lineTypes.find((t) => t.id === cable.lineTypeId);
  const shown = current && !types.includes(current) ? [current, ...types] : types;
  const change = (patch: Parameters<typeof editCable>[2]) => {
    const r = editCable(project, cable.id, patch);
    if (!r.ok) return setError(r.error);
    setError(null);
    store.execute(r.command);
  };
  return (
    <>
      <TextField label="Bezeichnung" value={cable.label} onCommit={(l) => change({ label: l })} />
      <div className="field">
        <label htmlFor={typeId}>Leitungstyp</label>
        <select
          id={typeId}
          value={cable.lineTypeId}
          onChange={(e) => change({ lineTypeId: e.target.value })}
        >
          {shown.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={statusId}>Status</label>
        <select
          id={statusId}
          value={cable.status}
          onChange={(e) => change({ status: e.target.value as Status })}
        >
          {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <p className="field-info">
        Von „{endpointLabel(project, cable.from)}“ nach „{endpointLabel(project, cable.to)}“
      </p>
      {(() => {
        const circuit = cableCircuit(project, cable);
        return circuit ? (
          <p className="field-info" aria-label="Stromkreis">
            Stromkreis:{" "}
            <button
              type="button"
              className="link"
              onClick={() => view.select({ kind: "circuit", id: circuit.id })}
            >
              {circuit.label}
            </button>
          </p>
        ) : null;
      })()}
      <p className="field-info" aria-label="Leitungslänge">
        Länge: {formatCableLength(cableLength(project, cable))}
      </p>
      <p className="field-info">{cable.path.length} Segmente im Weg</p>
      {editing ? (
        <>
          <p className="hint">
            Segmente in den Flächenansichten anklicken, um sie hinzuzufügen oder zu entfernen.
          </p>
          <button
            type="button"
            onClick={() => {
              store.execute(setCablePath(project, cable.id, pathEdit!.segmentIds));
              view.setPathEdit(null);
            }}
          >
            Fertig
          </button>
          <button type="button" onClick={() => view.setPathEdit(null)}>
            Abbrechen
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => view.setPathEdit({ cableId: cable.id, segmentIds: [...cable.path] })}
          >
            Weg bearbeiten
          </button>
          <button type="button" onClick={() => store.execute(suggestCablePath(project, cable.id))}>
            Weg vorschlagen
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="plan__message">
          {error}
        </p>
      )}
      <button type="button" onClick={() => store.execute(deleteCables([cable.id]))}>
        Leitung löschen
      </button>
    </>
  );
}
