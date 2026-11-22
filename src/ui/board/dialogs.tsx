/** Dialoge für Verteiler, Stromkreise und mehrere Leitungen (design.md M4). */
import { useState } from "react";
import { BOARD_DEFAULTS, BOARD_KIND_LABELS } from "../../geometry/boards";
import type { Board, Status } from "../../model/types";
import { MmField } from "../fields";
import { STATUS_LABELS } from "../labels";
import { Dialog } from "../plan/dialogs";

export interface BoardValues {
  kind: Board["kind"];
  label: string;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  mounting: Board["mounting"];
}

/** Verteiler anlegen: Art, Bezeichnung, Maße, Montage mit Standardwerten je Art. */
export function BoardDialog({
  storeyName,
  onSubmit,
  onCancel,
}: {
  storeyName: string;
  onSubmit(values: BoardValues): void;
  onCancel(): void;
}) {
  const initial = (kind: Board["kind"]): BoardValues => {
    const d = BOARD_DEFAULTS[kind];
    return {
      kind,
      label: d.label(storeyName),
      widthMm: d.size[0],
      heightMm: d.size[1],
      depthMm: d.size[2],
      mounting: d.mounting,
    };
  };
  const [v, setV] = useState<BoardValues>(initial("sub-distribution"));
  const [resets, setResets] = useState(0);
  return (
    <Dialog
      title="Verteiler anlegen"
      canSubmit={v.label.trim() !== "" && v.widthMm > 0 && v.heightMm > 0 && v.depthMm > 0}
      onSubmit={() => onSubmit({ ...v, label: v.label.trim() })}
      onCancel={onCancel}
    >
      <div className="field">
        <label htmlFor="board-kind">Art</label>
        <select
          id="board-kind"
          value={v.kind}
          onChange={(e) => {
            setV(initial(e.target.value as Board["kind"]));
            setResets((n) => n + 1);
          }}
        >
          {(Object.keys(BOARD_KIND_LABELS) as Board["kind"][]).map((k) => (
            <option key={k} value={k}>
              {BOARD_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="board-label">Bezeichnung</label>
        <input
          id="board-label"
          value={v.label}
          onChange={(e) => setV({ ...v, label: e.target.value })}
        />
      </div>
      <div key={resets}>
        <MmField
          label="Breite"
          min={1}
          value={v.widthMm}
          onCommit={(widthMm) => setV((x) => ({ ...x, widthMm }))}
        />
        <MmField
          label="Höhe"
          min={1}
          value={v.heightMm}
          onCommit={(heightMm) => setV((x) => ({ ...x, heightMm }))}
        />
        <MmField
          label="Tiefe"
          min={1}
          value={v.depthMm}
          onCommit={(depthMm) => setV((x) => ({ ...x, depthMm }))}
        />
      </div>
      <div className="field">
        <label htmlFor="board-mounting">Montage</label>
        <select
          id="board-mounting"
          value={v.mounting}
          onChange={(e) => setV({ ...v, mounting: e.target.value as Board["mounting"] })}
        >
          <option value="flush">Unterputz</option>
          <option value="surface">Aufputz</option>
        </select>
      </div>
    </Dialog>
  );
}

/** Stromkreis anlegen: Bezeichnung, Schutzgerät, Standard-Leitungstyp. */
export function CircuitDialog({
  defaultLabel,
  protections,
  lineTypes,
  onSubmit,
  onCancel,
}: {
  defaultLabel: string;
  protections: { id: string; label: string }[];
  lineTypes: { id: string; name: string }[];
  onSubmit(v: { label: string; protectionDeviceId?: string; lineTypeId?: string }): void;
  onCancel(): void;
}) {
  const [label, setLabel] = useState(defaultLabel);
  const [protection, setProtection] = useState("");
  const [lineType, setLineType] = useState("");
  return (
    <Dialog
      title="Stromkreis hinzufügen"
      canSubmit={label.trim() !== ""}
      onSubmit={() =>
        onSubmit({
          label: label.trim(),
          ...(protection ? { protectionDeviceId: protection } : {}),
          ...(lineType ? { lineTypeId: lineType } : {}),
        })
      }
      onCancel={onCancel}
    >
      <div className="field">
        <label htmlFor="circuit-label">Bezeichnung</label>
        <input id="circuit-label" value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="circuit-protection">Schutzgerät</label>
        <select
          id="circuit-protection"
          value={protection}
          onChange={(e) => setProtection(e.target.value)}
        >
          <option value="">keines</option>
          {protections.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="circuit-line">Standard-Leitungstyp</label>
        <select id="circuit-line" value={lineType} onChange={(e) => setLineType(e.target.value)}>
          <option value="">keiner</option>
          {lineTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
    </Dialog>
  );
}

/** Leitungen zu Verteiler: Verteiler, Typ, Status (design.md M4 „Mehrere Leitungen gleichzeitig“). */
export function BoardCablesDialog({
  boards,
  typesFor,
  defaultTypeId,
  count,
  onSubmit,
  onCancel,
}: {
  boards: { id: string; label: string }[];
  typesFor(boardId: string): { id: string; name: string }[];
  defaultTypeId?: string;
  count: number;
  onSubmit(v: { boardId: string; lineTypeId: string; status: Status }): void;
  onCancel(): void;
}) {
  const [boardId, setBoard] = useState(boards[0]?.id ?? "");
  const types = boardId ? typesFor(boardId) : [];
  const [chosen, setType] = useState(defaultTypeId ?? "");
  const lineTypeId = types.some((t) => t.id === chosen) ? chosen : (types[0]?.id ?? "");
  const [status, setStatus] = useState<Status>("planned");
  return (
    <Dialog
      title="Leitungen zu Verteiler"
      canSubmit={!!boardId && !!lineTypeId}
      onSubmit={() => onSubmit({ boardId, lineTypeId, status })}
      onCancel={onCancel}
    >
      <p>{count} Geräte ausgewählt</p>
      <div className="field">
        <label htmlFor="cables-board">Verteiler</label>
        <select id="cables-board" value={boardId} onChange={(e) => setBoard(e.target.value)}>
          {boards.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
      </div>
      {types.length === 0 ? (
        <p role="alert" className="settings__error">
          Keine gemeinsame passende Leitung
        </p>
      ) : (
        <div className="field">
          <label htmlFor="cables-type">Leitungstyp</label>
          <select id="cables-type" value={lineTypeId} onChange={(e) => setType(e.target.value)}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="field">
        <label htmlFor="cables-status">Status</label>
        <select
          id="cables-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as Status)}
        >
          {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
    </Dialog>
  );
}
