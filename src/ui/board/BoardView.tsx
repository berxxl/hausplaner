/**
 * Belegungsansicht eines Verteilers (design.md M4 „Belegungsansicht“): Felder als Spalten, Reihen
 * als Streifen aus TE, Reiheneinbaugeräte als Kästen; Einsetzen aus der Palette und Umsetzen per
 * Zeiger (keine HTML5-Drag-Ereignisse), Entf löscht.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useStore } from "zustand";
import {
  FIELD_KIND_LABELS,
  boardDevices,
  deviceTeWidth,
  fieldHasRows,
  placeableBoardTypes,
  typeOf,
  type Placement,
} from "../../geometry/boards";
import { channelLabel } from "../../geometry/knx";
import { boardReserve } from "../../geometry/reserve";
import { allIds } from "../../model/factory";
import { newId } from "../../model/ids";
import type { BoardPlacement } from "../../model/types";
import { insertBoardDevice, moveBoardDevice } from "../../store/boards";
import { deleteDevices } from "../../store/devices";
import type { ProjectStore } from "../../store/history";
import type { ViewStore } from "../../store/view";
import { isTextTarget } from "../shortcuts";
import { BOARD_LAYOUT, boardLayout, deviceCaption, slotAt, slotPosition } from "./layout";
import { STATUS_COLORS } from "../labels";

type Drag =
  | { kind: "new"; typeId: string }
  | { kind: "move"; deviceId: string; from: Placement; moved: boolean };

export function BoardView({ store, view }: { store: ProjectStore; view: ViewStore }) {
  const project = useStore(store, (s) => s.project);
  const boardId = useStore(view, (s) => s.boardId);
  const selection = useStore(view, (s) => s.selection);
  const board = project.boards.find((b) => b.id === boardId);
  const [message, setMessage] = useState<string | null>(null);
  const [hover, setHover] = useState<Placement | null>(null);
  const drag = useRef<Drag | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(t);
  }, [message]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTextTarget(e.target) || !board) return;
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const ids = view
        .selectedDevices()
        .filter((id) => boardDevices(store.getState().project, board.id).some((d) => d.id === id));
      if (ids.length === 0) return;
      e.preventDefault();
      store.execute(deleteDevices(ids));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store, view, board]);

  if (!board) {
    return (
      <div className="board-view board-view--empty">
        <p className="placeholder">Kein Verteiler gewählt</p>
        <ul aria-label="Verteiler" className="board-list">
          {project.boards.map((b) => (
            <li key={b.id}>
              <button type="button" onClick={() => view.openBoard(b.id)}>
                {b.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const L = BOARD_LAYOUT;
  const layout = boardLayout(board);
  const palette = placeableBoardTypes(project, board);
  const devices = boardDevices(project, board.id);
  const reserve = boardReserve(project, board);
  const selectedIds = new Set(
    selection?.kind === "device" ? (selection.ids ?? [selection.id]) : [],
  );
  const circuit =
    selection?.kind === "circuit" ? project.circuits.find((c) => c.id === selection.id) : undefined;

  const local = (e: { clientX: number; clientY: number }) => {
    const r = svg.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };
  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const p = local(e);
    const at = slotAt(board, p.x, p.y);
    setHover(at);
    if (d.kind === "move" && at && JSON.stringify(at) !== JSON.stringify(d.from)) d.moved = true;
  };
  const onUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    drag.current = null;
    setHover(null);
    if (!d) return;
    const p = local(e);
    const at = slotAt(board, p.x, p.y);
    if (d.kind === "move" && !d.moved) return;
    if (!at) return setMessage("Kein Platz an dieser Stelle");
    const r =
      d.kind === "new"
        ? insertBoardDevice(project, board.id, d.typeId, at, newId(new Set(allIds(project))))
        : moveBoardDevice(project, d.deviceId, at);
    if (!r.ok) return setMessage(r.error);
    setMessage(null);
    store.execute(r.command);
  };
  const assignmentsOf = (id: string) =>
    project.knxAssignments
      .filter((a) => a.actuatorDeviceId === id)
      .sort((a, b) => a.channel - b.channel);

  return (
    <div className="board-view">
      <div className="board-view__head">
        <h2 aria-label="Belegung von">{board.label}</h2>
        <p aria-label="Zusammenfassung" className="field-info">
          {reserve.used} belegt · {reserve.earmarked} vorgemerkt · {reserve.free} frei von{" "}
          {reserve.total} TE
        </p>
        {message && (
          <span role="status" aria-label="Meldung" className="plan__message">
            {message}
          </span>
        )}
      </div>
      <div className="board-view__body">
        <ul className="board-view__palette" aria-label="Palette">
          {palette.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                aria-label={`${t.name} einsetzen`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  drag.current = { kind: "new", typeId: t.id };
                }}
              >
                {t.name} <span className="field-info">{deviceTeWidth(t)} TE</span>
              </button>
            </li>
          ))}
        </ul>
        <svg
          ref={svg}
          role="img"
          aria-label="Belegung"
          className="board-view__svg"
          width={layout.width}
          height={layout.height}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={() => setHover(null)}
        >
          {board.fields.map((f) => {
            const box = layout.fields.find((b) => b.fieldId === f.id)!;
            return (
              <g key={f.id} data-field={f.id} aria-label={FIELD_KIND_LABELS[f.kind]}>
                <rect
                  className="board-view__field"
                  x={box.x}
                  y={L.pad}
                  width={box.width}
                  height={layout.height - 2 * L.pad}
                />
                <text x={box.x + L.pad} y={L.pad + 18} className="board-view__title">
                  {FIELD_KIND_LABELS[f.kind]}
                  {fieldHasRows(f) ? ` · ${f.rows} × ${f.tePerRow} TE` : ""}
                </text>
                {Array.from({ length: fieldHasRows(f) ? f.rows : 0 }, (_, i) => (
                  <g key={i} data-row={i + 1}>
                    {Array.from({ length: f.tePerRow }, (_, j) => (
                      <rect
                        key={j}
                        className={`board-view__slot${hover && hover.fieldId === f.id && hover.row === i + 1 && hover.slot === j + 1 ? " board-view__slot--hover" : ""}`}
                        x={box.x + L.pad + j * L.te}
                        y={L.head + L.pad + i * L.row}
                        width={L.te}
                        height={L.row - 8}
                      />
                    ))}
                  </g>
                ))}
              </g>
            );
          })}
          {devices.map((d) => {
            const p = d.placement as BoardPlacement;
            const pos = slotPosition(board, p);
            if (!pos) return null;
            const type = typeOf(project, d);
            const w = deviceTeWidth(type) * L.te;
            const selected = selectedIds.has(d.id);
            const highlighted = circuit?.protectionDeviceId === d.id;
            const channels = assignmentsOf(d.id);
            // Beschriftung (7.2): schmale Geräte senkrecht, Kurzname bzw. Kürzel statt Typname
            const { shown, typeName, narrow, protects } = deviceCaption(project, d);
            return (
              <g
                key={d.id}
                data-board-device={d.id}
                data-slot={`${p.row}:${p.slot}`}
                className={`board-view__device${selected ? " board-view__device--selected" : ""}${highlighted ? " board-view__device--highlighted" : ""}`}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (e.shiftKey) view.toggleDevice(d.id);
                  else view.select({ kind: "device", id: d.id });
                  drag.current = { kind: "move", deviceId: d.id, from: p, moved: false };
                }}
              >
                <rect
                  x={pos.x + 1}
                  y={pos.y + 1}
                  width={w - 2}
                  height={L.row - 10}
                  fill={STATUS_COLORS[d.status]}
                  fillOpacity={0.18}
                  stroke={STATUS_COLORS[d.status]}
                />
                <clipPath id={`board-clip-${d.id}`}>
                  <rect x={pos.x + 1} y={pos.y + 1} width={w - 2} height={L.row - 10} />
                </clipPath>
                <g clipPath={`url(#board-clip-${d.id})`}>
                  {narrow ? (
                    <text
                      data-board-label={d.id}
                      transform={`translate(${pos.x + w / 2 + 4} ${pos.y + L.row - 14}) rotate(-90)`}
                    >
                      {shown}
                    </text>
                  ) : (
                    <>
                      <text data-board-label={d.id} x={pos.x + 4} y={pos.y + 16}>
                        {shown}
                      </text>
                      {typeName !== shown && (
                        <text x={pos.x + 4} y={pos.y + 32} className="board-view__type">
                          {typeName}
                        </text>
                      )}
                    </>
                  )}
                </g>
                <title>
                  {[
                    d.label,
                    typeName !== d.label ? typeName : null,
                    protects ? protects.label : null,
                    ...channels.map((a) => {
                      const c = project.devices.find((x) => x.id === a.consumerDeviceId);
                      return `${channelLabel(d.label, a.channel)} → ${c?.label ?? "?"}`;
                    }),
                  ]
                    .filter(Boolean)
                    .join("\n")}
                </title>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
