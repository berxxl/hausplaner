/**
 * Stromkreise (design.md M4 „Stromkreise“): Abschnitt in den Verteilereigenschaften und
 * Eigenschaften eines ausgewählten Stromkreises.
 */
import { useId, useState } from "react";
import {
  circuitCables,
  circuitDevices,
  nextCircuitLabel,
  protectionDevices,
} from "../geometry/circuits";
import { allIds } from "../model/factory";
import { newId } from "../model/ids";
import type { Board, Circuit, Project } from "../model/types";
import { addCircuit, deleteCircuit, editCircuit } from "../store/circuits";
import type { Checked } from "../store/catalog";
import type { ProjectStore } from "../store/history";
import type { ViewStore } from "../store/view";
import { CircuitDialog } from "./board/dialogs";
import { TextField } from "./fields";
import { useConfirm } from "./useConfirm";

const powerLineTypes = (project: Project) =>
  project.catalog.lineTypes.filter((t) => t.trade === "power");

export function BoardCircuits({
  board,
  project,
  store,
  view,
}: {
  board: Board;
  project: Project;
  store: ProjectStore;
  view: ViewStore;
}) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const circuits = project.circuits
    .filter((c) => c.boardId === board.id)
    .sort((a, b) => a.label.localeCompare(b.label, "de", { numeric: true }));
  return (
    <>
      <h3>Stromkreise</h3>
      <ul className="board-list" aria-label="Stromkreise">
        {circuits.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => view.select({ kind: "circuit", id: c.id })}>
              {c.label}
            </button>{" "}
            <span className="field-info">{circuitDevices(project, c.id).length} Geräte</span>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => setAdding(true)}>
        Stromkreis hinzufügen
      </button>
      {error && (
        <p role="alert" className="settings__error">
          {error}
        </p>
      )}
      {adding && (
        <CircuitDialog
          defaultLabel={nextCircuitLabel(project)}
          protections={protectionDevices(project, board.id)}
          lineTypes={powerLineTypes(project)}
          onCancel={() => setAdding(false)}
          onSubmit={(v) => {
            setAdding(false);
            const id = newId(new Set(allIds(project)));
            const r = addCircuit(project, { id, boardId: board.id, ...v });
            if (!r.ok) return setError(r.error);
            setError(null);
            store.execute(r.command);
            view.select({ kind: "circuit", id });
          }}
        />
      )}
    </>
  );
}

export function CircuitProperties({
  circuit,
  project,
  store,
  view,
}: {
  circuit: Circuit;
  project: Project;
  store: ProjectStore;
  view: ViewStore;
}) {
  const protectionId = useId();
  const lineId = useId();
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();
  const run = (r: Checked) => {
    if (!r.ok) return setError(r.error);
    setError(null);
    store.execute(r.command);
  };
  const board = project.boards.find((b) => b.id === circuit.boardId);
  const devices = circuitDevices(project, circuit.id);
  const cables = circuitCables(project, circuit.id);
  const remove = async () => {
    if (
      devices.length > 0 &&
      !(await confirm({
        title: "Stromkreis löschen?",
        message: `${devices.length} ${devices.length === 1 ? "Gerät wird" : "Geräte werden"} vom Stromkreis gelöst.`,
        confirmLabel: "Löschen",
      }))
    )
      return;
    store.execute(deleteCircuit(circuit.id));
  };
  return (
    <>
      <TextField
        label="Bezeichnung"
        value={circuit.label}
        onCommit={(label) => run(editCircuit(project, circuit.id, { label }))}
      />
      <p className="field-info">
        Verteiler:{" "}
        {board ? (
          <button
            type="button"
            className="link"
            onClick={() => view.select({ kind: "board", id: board.id })}
          >
            {board.label}
          </button>
        ) : (
          "–"
        )}
      </p>
      <div className="field">
        <label htmlFor={protectionId}>Schutzgerät</label>
        <select
          id={protectionId}
          value={circuit.protectionDeviceId ?? ""}
          onChange={(e) =>
            run(
              editCircuit(project, circuit.id, {
                protectionDeviceId: e.target.value || undefined,
              }),
            )
          }
        >
          <option value="">keines</option>
          {protectionDevices(project, circuit.boardId).map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={lineId}>Standard-Leitungstyp</label>
        <select
          id={lineId}
          value={circuit.lineTypeId ?? ""}
          onChange={(e) =>
            run(editCircuit(project, circuit.id, { lineTypeId: e.target.value || undefined }))
          }
        >
          <option value="">keiner</option>
          {powerLineTypes(project).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p role="alert" className="settings__error">
          {error}
        </p>
      )}
      <h3>Geräte</h3>
      <ul className="board-list" aria-label="Geräte des Stromkreises">
        {devices.map((d) => (
          <li key={d.id}>
            <button type="button" onClick={() => view.select({ kind: "device", id: d.id })}>
              {d.label}
            </button>
          </li>
        ))}
      </ul>
      <p className="field-info" aria-label="Leitungen des Stromkreises">
        {cables.length} {cables.length === 1 ? "Leitung" : "Leitungen"}
      </p>
      <button type="button" className="danger" onClick={() => void remove()}>
        Stromkreis löschen
      </button>
      {dialog}
    </>
  );
}
