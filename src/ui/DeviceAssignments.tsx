/**
 * M4-Teile der Geräteeigenschaften (design.md M4 „Stromkreise“, „KNX“, „Mehrere Leitungen
 * gleichzeitig“, „Belegungsansicht“): Stromkreis, KNX-Linie, KNX-Kanal, Platz im Verteiler,
 * Kanalliste, „Gleiche im Geschoss auswählen“, „Leitungen zu Verteiler …“.
 */
import { useId, useState } from "react";
import { FIELD_KIND_LABELS, fieldHasRows } from "../geometry/boards";
import { compatibleLineTypes } from "../geometry/cables";
import { isCircuitDevice } from "../geometry/circuits";
import {
  actuatorProvides,
  channelLabel,
  consumerFunction,
  freeChannelsFor,
  isBusParticipant,
} from "../geometry/knx";
import { allIds } from "../model/factory";
import { newId } from "../model/ids";
import type { BoardPlacement, Device, Project } from "../model/types";
import { moveBoardDevice } from "../store/boards";
import { addCablesToBoard } from "../store/cables";
import type { Checked } from "../store/catalog";
import { assignCircuit } from "../store/circuits";
import type { ProjectStore } from "../store/history";
import { assignChannel, assignKnxLine } from "../store/knx";
import type { ViewStore } from "../store/view";
import { BoardCablesDialog } from "./board/dialogs";
import { NumberField } from "./fields";

/** Stromkreis, KNX-Linie und Aktionen für eine oder mehrere Geräte. */
export function DeviceAssignments({
  ids,
  project,
  store,
  view,
}: {
  ids: string[];
  project: Project;
  store: ProjectStore;
  view: ViewStore;
}) {
  const circuitId = useId();
  const lineId = useId();
  const [message, setMessage] = useState<string | null>(null);
  const [cablesOpen, setCablesOpen] = useState(false);
  const devices = project.devices.filter((d) => ids.includes(d.id));
  const circuitDevices = devices.filter((d) => isCircuitDevice(project, d));
  const busDevices = devices.filter((d) => isBusParticipant(project, d));
  const common = <T,>(values: T[]) =>
    values.every((v) => v === values[0]) ? values[0] : undefined;
  const currentCircuit = common(circuitDevices.map((d) => d.circuitId ?? ""));
  const currentLine = common(busDevices.map((d) => d.knxLineId ?? ""));
  const surfaceDevices = devices.filter((d) => d.placement.kind !== "board");
  const first = devices[0];

  const selectSame = () => {
    if (!first) return;
    const same = project.devices
      .filter(
        (d) =>
          d.typeId === first.typeId &&
          d.storeyId === first.storeyId &&
          d.placement.kind !== "board",
      )
      .map((d) => d.id);
    view.select({ kind: "device", id: same[0]!, ...(same.length > 1 ? { ids: same } : {}) });
  };

  const defaultType = (() => {
    const c = common(circuitDevices.map((d) => d.circuitId));
    return project.circuits.find((x) => x.id === c)?.lineTypeId;
  })();

  return (
    <>
      {circuitDevices.length > 0 && (
        <div className="field">
          <label htmlFor={circuitId}>Stromkreis</label>
          <select
            id={circuitId}
            value={currentCircuit ?? "mixed"}
            onChange={(e) =>
              store.execute(
                assignCircuit(project, ids, e.target.value === "" ? null : e.target.value),
              )
            }
          >
            {currentCircuit === undefined && (
              <option value="mixed" disabled>
                verschieden
              </option>
            )}
            <option value="">keiner</option>
            {project.circuits.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} ({project.boards.find((b) => b.id === c.boardId)?.label ?? "?"})
              </option>
            ))}
          </select>
        </div>
      )}
      {circuitDevices.length > 0 && circuitDevices.length < devices.length && (
        <p className="field-info">
          Stromkreis gilt für {circuitDevices.length} von {devices.length} Geräten
        </p>
      )}
      {busDevices.length > 0 && project.knxLines.length > 0 && (
        <div className="field">
          <label htmlFor={lineId}>KNX-Linie</label>
          <select
            id={lineId}
            value={currentLine ?? "mixed"}
            onChange={(e) =>
              store.execute(
                assignKnxLine(project, ids, e.target.value === "" ? null : e.target.value),
              )
            }
          >
            {currentLine === undefined && (
              <option value="mixed" disabled>
                verschieden
              </option>
            )}
            <option value="">keine</option>
            {project.knxLines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      )}
      {first && first.placement.kind !== "board" && (
        <button type="button" onClick={selectSame}>
          Gleiche im Geschoss auswählen
        </button>
      )}
      {surfaceDevices.length > 0 && project.boards.length > 0 && (
        <button type="button" onClick={() => setCablesOpen(true)}>
          Leitungen zu Verteiler …
        </button>
      )}
      {message && (
        <p role="status" aria-label="Meldung" className="field-info">
          {message}
        </p>
      )}
      {cablesOpen && (
        <BoardCablesDialog
          boards={project.boards}
          count={surfaceDevices.length}
          defaultTypeId={defaultType}
          typesFor={(boardId) => {
            const sets = surfaceDevices.map((d) =>
              compatibleLineTypes(project, { deviceId: d.id }, { boardId }).map((t) => t.id),
            );
            return project.catalog.lineTypes.filter((t) => sets.every((s) => s.includes(t.id)));
          }}
          onCancel={() => setCablesOpen(false)}
          onSubmit={({ boardId, lineTypeId, status }) => {
            setCablesOpen(false);
            const taken = new Set(allIds(project));
            const newIds = surfaceDevices.map(() => {
              const id = newId(taken);
              taken.add(id);
              return id;
            });
            const r = addCablesToBoard(
              project,
              surfaceDevices.map((d) => d.id),
              boardId,
              lineTypeId,
              status,
              newIds,
            );
            if (!r.ok) return setMessage(r.error);
            store.execute(r.command);
            setMessage(`${r.added} Leitungen angelegt, ${r.skipped} übersprungen`);
          }}
        />
      )}
    </>
  );
}

/** Feld „KNX-Kanal“ eines Verbrauchers. */
export function ConsumerChannel({
  device,
  project,
  store,
}: {
  device: Device;
  project: Project;
  store: ProjectStore;
}) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  if (!consumerFunction(project, device)) return null;
  const own = project.knxAssignments.find((a) => a.consumerDeviceId === device.id);
  const ownActuator = own ? project.devices.find((d) => d.id === own.actuatorDeviceId) : undefined;
  const options = freeChannelsFor(project, device);
  const value = own ? `${own.actuatorDeviceId}#${own.channel}` : "";
  const run = (r: Checked) => {
    if (!r.ok) return setError(r.error);
    setError(null);
    store.execute(r.command);
  };
  return (
    <>
      <div className="field">
        <label htmlFor={id}>KNX-Kanal</label>
        <select
          id={id}
          value={value}
          onChange={(e) => {
            if (!e.target.value) return run(assignChannel(project, device.id, null));
            const [actuatorDeviceId, ch] = e.target.value.split("#");
            run(
              assignChannel(project, device.id, {
                actuatorDeviceId: actuatorDeviceId!,
                channel: Number(ch),
              }),
            );
          }}
        >
          <option value="">keiner</option>
          {own && (
            <option value={value}>{channelLabel(ownActuator?.label ?? "?", own.channel)}</option>
          )}
          {options.map((o) => (
            <option
              key={`${o.actuatorDeviceId}#${o.channel}`}
              value={`${o.actuatorDeviceId}#${o.channel}`}
            >
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p role="alert" className="settings__error">
          {error}
        </p>
      )}
    </>
  );
}

/** Feld, Reihe und Platz eines Reiheneinbaugeräts; bei Aktoren die Kanalliste. */
export function BoardDeviceFields({
  device,
  project,
  store,
  view,
}: {
  device: Device;
  project: Project;
  store: ProjectStore;
  view: ViewStore;
}) {
  const fieldId = useId();
  const [error, setError] = useState<string | null>(null);
  const p = device.placement as BoardPlacement;
  const board = project.boards.find((b) => b.id === p.boardId);
  const move = (patch: Partial<BoardPlacement>) => {
    const r = moveBoardDevice(project, device.id, {
      fieldId: patch.fieldId ?? p.fieldId,
      row: patch.row ?? p.row,
      slot: patch.slot ?? p.slot,
    });
    if (!r.ok) return setError(r.error);
    setError(null);
    store.execute(r.command);
  };
  const provides = actuatorProvides(project, device);
  return (
    <>
      <p className="field-info">
        Verteiler:{" "}
        {board ? (
          <button type="button" className="link" onClick={() => view.openBoard(board.id)}>
            {board.label}
          </button>
        ) : (
          "–"
        )}
      </p>
      {board && (
        <div className="field">
          <label htmlFor={fieldId}>Feld</label>
          <select
            id={fieldId}
            value={p.fieldId}
            onChange={(e) => move({ fieldId: e.target.value })}
          >
            {board.fields.filter(fieldHasRows).map((f, i) => (
              <option key={f.id} value={f.id}>
                {i + 1}: {FIELD_KIND_LABELS[f.kind]}
              </option>
            ))}
          </select>
        </div>
      )}
      <NumberField label="Reihe" min={1} value={p.row} onCommit={(row) => move({ row })} />
      <NumberField label="Platz" min={1} value={p.slot} onCommit={(slot) => move({ slot })} />
      {error && (
        <p role="alert" className="settings__error">
          {error}
        </p>
      )}
      {provides && (
        <>
          <h3>Kanäle</h3>
          <ul className="board-list" aria-label="Kanäle">
            {Array.from({ length: provides.channels }, (_, i) => {
              const a = project.knxAssignments.find(
                (x) => x.actuatorDeviceId === device.id && x.channel === i + 1,
              );
              const c = a ? project.devices.find((d) => d.id === a.consumerDeviceId) : undefined;
              return (
                <li key={i}>
                  {channelLabel(device.label, i + 1)} → {c ? c.label : "frei"}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
