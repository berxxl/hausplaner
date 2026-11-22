/**
 * Eigenschaften eines Verteilers (design.md M4 „Verteiler platzieren“, „Verteilerhierarchie und
 * Zuleitung“, „Medienverteiler“): Maße, Felder, Hierarchie, Belegung, Stromkreise, KNX.
 */
import { useId, useState } from "react";
import {
  BOARD_KIND_LABELS,
  FIELD_KIND_LABELS,
  boardDescendants,
  patchPorts,
} from "../geometry/boards";
import { boardReserve } from "../geometry/reserve";
import { allIds } from "../model/factory";
import { newId } from "../model/ids";
import type { Board, BoardField, Project } from "../model/types";
import { FIELD_KINDS } from "../model/schema";
import {
  assignParentBoard,
  boardCascade,
  deleteBoards,
  editBoard,
  setBoardFields,
} from "../store/boards";
import type { Checked } from "../store/catalog";
import type { ProjectStore } from "../store/history";
import type { ViewStore } from "../store/view";
import { MmField, NumberField, TextField } from "./fields";
import { cascadeMessage } from "./labels";
import { useConfirm } from "./useConfirm";
import { BoardCircuits } from "./CircuitProperties";
import { BoardKnx } from "./BoardKnx";

export function BoardProperties({
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
  const kindId = useId();
  const mountingId = useId();
  const parentId = useId();
  const feedId = useId();
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();
  const run = (r: Checked) => {
    if (!r.ok) return setError(r.error);
    setError(null);
    store.execute(r.command);
  };
  const edit = (patch: Parameters<typeof editBoard>[1], label?: string) =>
    store.execute(editBoard(board.id, patch, label));
  const fields = (next: BoardField[]) => run(setBoardFields(project, board.id, next));
  const setField = (i: number, patch: Partial<BoardField>) =>
    fields(board.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const moveField = (i: number, by: -1 | 1) => {
    const next = [...board.fields];
    const [f] = next.splice(i, 1);
    next.splice(i + by, 0, f!);
    fields(next);
  };
  const reserve = boardReserve(project, board);
  const descendants = boardDescendants(project, board.id);
  const parents = project.boards.filter((b) => b.id !== board.id && !descendants.has(b.id));
  const feed = project.cables.find((c) => c.id === board.feedCableId);
  const powerTypes = project.catalog.lineTypes.filter((t) => t.trade === "power");
  const feedType =
    feed?.lineTypeId ?? powerTypes.find((t) => t.id === "nym-j-5x10")?.id ?? powerTypes[0]?.id;
  const assign = (parent: string | null, lineTypeId = feedType) =>
    run(assignParentBoard(project, board.id, parent, lineTypeId, newId(new Set(allIds(project)))));

  const remove = async () => {
    const c = boardCascade(project, [board.id]);
    const message = cascadeMessage(c.devices, c.cables, { circuits: c.circuits });
    if (
      message &&
      !(await confirm({ title: "Verteiler löschen?", message, confirmLabel: "Löschen" }))
    )
      return;
    store.execute(deleteBoards([board.id]));
  };

  return (
    <>
      <TextField label="Bezeichnung" value={board.label} onCommit={(label) => edit({ label })} />
      <div className="field">
        <label htmlFor={kindId}>Art</label>
        <select
          id={kindId}
          value={board.kind}
          onChange={(e) => edit({ kind: e.target.value as Board["kind"] })}
        >
          {(Object.keys(BOARD_KIND_LABELS) as Board["kind"][]).map((k) => (
            <option key={k} value={k}>
              {BOARD_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={mountingId}>Montage</label>
        <select
          id={mountingId}
          value={board.mounting}
          onChange={(e) => edit({ mounting: e.target.value as Board["mounting"] })}
        >
          <option value="flush">Unterputz</option>
          <option value="surface">Aufputz</option>
        </select>
      </div>
      <MmField
        label="Breite"
        min={1}
        value={board.widthMm}
        onCommit={(widthMm) => edit({ widthMm })}
      />
      <MmField
        label="Höhe"
        min={1}
        value={board.heightMm}
        onCommit={(heightMm) => edit({ heightMm })}
      />
      <MmField
        label="Tiefe"
        min={1}
        value={board.depthMm}
        onCommit={(depthMm) => edit({ depthMm })}
      />
      <MmField
        label="u (Mitte)"
        value={board.placement.u}
        onCommit={(u) => edit({ placement: { ...board.placement, u } }, "Verteiler verschieben")}
      />
      <MmField
        label="Höhe über OKFF (Mitte)"
        value={board.placement.v}
        onCommit={(v) => edit({ placement: { ...board.placement, v } }, "Verteiler verschieben")}
      />

      <h3>Felder</h3>
      <table className="board-fields" aria-label="Felder">
        <thead>
          <tr>
            <th>Art</th>
            <th>Reihen</th>
            <th>TE je Reihe</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {board.fields.map((f, i) => (
            <tr key={f.id} aria-label={`Feld ${i + 1}`}>
              <td>
                <select
                  aria-label={`Art Feld ${i + 1}`}
                  value={f.kind}
                  onChange={(e) => setField(i, { kind: e.target.value as BoardField["kind"] })}
                >
                  {FIELD_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {FIELD_KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <NumberField
                  label={`Reihen Feld ${i + 1}`}
                  min={0}
                  value={f.rows}
                  onCommit={(rows) => setField(i, { rows })}
                />
              </td>
              <td>
                <NumberField
                  label={`TE je Reihe Feld ${i + 1}`}
                  min={0}
                  value={f.tePerRow}
                  onCommit={(tePerRow) => setField(i, { tePerRow })}
                />
              </td>
              <td className="board-fields__actions">
                <button
                  type="button"
                  aria-label={`Feld ${i + 1} nach links`}
                  disabled={i === 0}
                  onClick={() => moveField(i, -1)}
                >
                  ←
                </button>
                <button
                  type="button"
                  aria-label={`Feld ${i + 1} nach rechts`}
                  disabled={i === board.fields.length - 1}
                  onClick={() => moveField(i, 1)}
                >
                  →
                </button>
                <button
                  type="button"
                  aria-label={`Feld ${i + 1} löschen`}
                  onClick={() => fields(board.fields.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        onClick={() =>
          fields([
            ...board.fields,
            { id: newId(new Set(allIds(project))), kind: "distribution", rows: 1, tePerRow: 12 },
          ])
        }
      >
        Feld hinzufügen
      </button>
      {error && (
        <p role="alert" className="settings__error">
          {error}
        </p>
      )}
      <p className="field-info" aria-label="TE-Belegung">
        {reserve.used} belegt · {reserve.earmarked} vorgemerkt · {reserve.free} frei von{" "}
        {reserve.total} TE
      </p>
      {board.kind === "media" && (
        <p className="field-info" aria-label="Patchfeldports">
          Patchfeldports benötigt: {patchPorts(project, board.id)}
        </p>
      )}
      <button type="button" onClick={() => view.openBoard(board.id)}>
        Belegung öffnen
      </button>

      {board.kind !== "meter-cabinet" && (
        <>
          <h3>Zuleitung</h3>
          <div className="field">
            <label htmlFor={parentId}>Übergeordneter Verteiler</label>
            <select
              id={parentId}
              value={board.parentBoardId ?? ""}
              onChange={(e) => assign(e.target.value || null)}
            >
              <option value="">keiner</option>
              {parents.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          {board.parentBoardId && (
            <div className="field">
              <label htmlFor={feedId}>Zuleitung</label>
              <select
                id={feedId}
                value={feedType ?? ""}
                onChange={(e) => assign(board.parentBoardId!, e.target.value)}
              >
                {powerTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {feed && (
            <button type="button" onClick={() => view.select({ kind: "cable", id: feed.id })}>
              Zuleitung auswählen
            </button>
          )}
        </>
      )}

      <BoardCircuits board={board} project={project} store={store} view={view} />
      <BoardKnx board={board} project={project} store={store} />

      <button type="button" className="danger" onClick={() => void remove()}>
        Verteiler löschen
      </button>
      {dialog}
    </>
  );
}
