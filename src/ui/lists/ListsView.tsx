/**
 * Editor „Listen“ (design.md M5 „Listen in der App“): Listenauswahl, Filter, sortierbare Tabelle,
 * Summen; ein Zeilenklick wählt das Objekt aus.
 */
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { TRADES } from "../../model/schema";
import type { Status, Trade } from "../../model/types";
import type { ProjectStore } from "../../store/history";
import type { ViewStore } from "../../store/view";
import { filterRows, sortRows, type Column, type Row, type RowFilter } from "../../reports/filter";
import { LISTS, type ListKind } from "../../reports/lists";
import { materialList } from "../../reports/material";
import {
  CABLE_COLUMNS,
  cableRows,
  cableTotals,
  cableTotalText,
  CIRCUIT_COLUMNS,
  circuitRows,
  DEVICE_COLUMNS,
  deviceRows,
  KNX_COLUMNS,
  knxRows,
  knxSummary,
  PENETRATION_COLUMNS,
  penetrationRows,
  type CableRow,
  type CircuitRow,
  type DeviceRow,
  type KnxRow,
  type PenetrationRow,
} from "../../reports/rows";
import { PENETRATION_LABELS, STATUS_LABELS, TRADE_LABELS } from "../labels";

const STATUSES: Status[] = ["planned", "installed", "verified"];

/** Welche gemeinsamen Filter eine Liste hat (design.md M5 „Filter“). */
const FILTERS: Record<ListKind, { room: boolean; trade: boolean; status: boolean }> = {
  devices: { room: true, trade: true, status: true },
  circuits: { room: false, trade: false, status: false },
  knx: { room: false, trade: false, status: true },
  cables: { room: true, trade: true, status: true },
  penetrations: { room: true, trade: false, status: true },
  material: { room: true, trade: true, status: true },
};

export function ListsView({ store, view }: { store: ProjectStore; view: ViewStore }) {
  const project = useStore(store, (s) => s.project);
  const selection = useStore(view, (s) => s.selection);
  const [list, setList] = useState<ListKind>("devices");
  const [storeyId, setStoreyId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [trades, setTrades] = useState<Trade[]>([...TRADES]);
  const [statuses, setStatuses] = useState<Status[]>([...STATUSES]);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [method, setMethod] = useState<string | null>(null);
  const [unconnected, setUnconnected] = useState(false);
  const [sort, setSort] = useState<{ key: string; desc: boolean } | null>(null);

  const has = FILTERS[list];
  const filter: RowFilter = {
    storeyId,
    roomId: has.room ? roomId : null,
    trades: has.trade ? trades : undefined,
    statuses: has.status ? statuses : undefined,
  };
  const storeys = [...project.storeys].sort((a, b) => a.elevationMm - b.elevationMm);
  const rooms = project.rooms
    .filter((r) => r.storeyId === storeyId)
    .sort((a, b) => a.name.localeCompare(b.name, "de"));

  const table = useMemo((): { columns: Column[]; rows: Row[]; summary: string[] } | null => {
    const f = filter;
    switch (list) {
      case "devices": {
        let rows: DeviceRow[] = filterRows(deviceRows(project), f);
        if (unconnected) rows = rows.filter((r) => !r.connected);
        return { columns: DEVICE_COLUMNS, rows, summary: [] };
      }
      case "circuits": {
        let rows: CircuitRow[] = filterRows(circuitRows(project), f);
        if (boardId) rows = rows.filter((r) => r.boardId === boardId);
        return { columns: CIRCUIT_COLUMNS, rows, summary: [] };
      }
      case "knx": {
        let rows: KnxRow[] = filterRows(knxRows(project), f);
        if (boardId) rows = rows.filter((r) => r.boardId === boardId);
        return { columns: KNX_COLUMNS, rows, summary: rows.length > 0 ? [knxSummary(rows)] : [] };
      }
      case "cables": {
        const rows: CableRow[] = filterRows(cableRows(project), f);
        return {
          columns: CABLE_COLUMNS,
          rows,
          summary: cableTotals(project, rows).map(cableTotalText),
        };
      }
      case "penetrations": {
        let rows: PenetrationRow[] = filterRows(penetrationRows(project), f);
        if (method) rows = rows.filter((r) => r.method === method);
        return { columns: PENETRATION_COLUMNS, rows, summary: [] };
      }
      default:
        return null;
    }
    // filter ist pro Render neu; die Einzelwerte stehen in den Abhängigkeiten
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, list, storeyId, roomId, trades, statuses, boardId, method, unconnected]);

  const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);
  const label = LISTS.find((l) => l.kind === list)!.label;
  const shown = table && sort ? sortRows(table.rows, sort.key, sort.desc) : table?.rows;
  const selectedId = selection?.id;

  return (
    <div className="lists">
      <div className="lists__bar" role="group" aria-label="Listenfilter">
        <label>
          Liste{" "}
          <select
            aria-label="Liste"
            value={list}
            onChange={(e) => {
              setList(e.target.value as ListKind);
              setSort(null);
            }}
          >
            {LISTS.map((l) => (
              <option key={l.kind} value={l.kind}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Geschoss{" "}
          <select
            aria-label="Geschoss"
            value={storeyId ?? ""}
            onChange={(e) => {
              setStoreyId(e.target.value || null);
              setRoomId(null);
            }}
          >
            <option value="">alle</option>
            {storeys.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {has.room && (
          <label>
            Raum{" "}
            <select
              aria-label="Raum"
              value={roomId ?? ""}
              disabled={!storeyId}
              onChange={(e) => setRoomId(e.target.value || null)}
            >
              <option value="">alle</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {(list === "circuits" || list === "knx") && (
          <label>
            Verteiler{" "}
            <select
              aria-label="Verteiler"
              value={boardId ?? ""}
              onChange={(e) => setBoardId(e.target.value || null)}
            >
              <option value="">alle</option>
              {[...project.boards]
                .sort((a, b) => a.label.localeCompare(b.label, "de", { numeric: true }))
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
            </select>
          </label>
        )}
        {list === "penetrations" && (
          <label>
            Art{" "}
            <select
              aria-label="Art"
              value={method ?? ""}
              onChange={(e) => setMethod(e.target.value || null)}
            >
              <option value="">alle</option>
              {Object.entries(PENETRATION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        )}
        {list === "devices" && (
          <label>
            <input
              type="checkbox"
              checked={unconnected}
              onChange={(e) => setUnconnected(e.target.checked)}
            />{" "}
            nur nicht angeschlossene
          </label>
        )}
        {has.trade && (
          <div role="group" aria-label="Gewerk" className="lists__toggles">
            {TRADES.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={trades.includes(t)}
                onClick={() => setTrades((xs) => toggle(xs, t))}
              >
                {TRADE_LABELS[t]}
              </button>
            ))}
          </div>
        )}
        {has.status && (
          <div role="group" aria-label="Status" className="lists__toggles">
            {STATUSES.map((st) => (
              <button
                key={st}
                type="button"
                aria-pressed={statuses.includes(st)}
                onClick={() => setStatuses((xs) => toggle(xs, st))}
              >
                {STATUS_LABELS[st]}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="lists__body">
        {table && shown ? (
          <>
            <table aria-label={label} className="lists__table">
              <thead>
                <tr>
                  {table.columns.map((c) => (
                    <th
                      key={c.key}
                      className={c.numeric ? "lists__num" : undefined}
                      aria-sort={
                        sort?.key === c.key ? (sort.desc ? "descending" : "ascending") : undefined
                      }
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setSort((s) =>
                            s?.key === c.key && !s.desc
                              ? { key: c.key, desc: true }
                              : { key: c.key, desc: false },
                          )
                        }
                      >
                        {c.label}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr
                    key={r.id}
                    tabIndex={0}
                    aria-selected={r.select !== undefined && r.select.id === selectedId}
                    className={
                      r.select && r.select.id === selectedId ? "lists__row--selected" : undefined
                    }
                    onClick={() => r.select && view.select(r.select)}
                    onKeyDown={(e) => e.key === "Enter" && r.select && view.select(r.select)}
                  >
                    {table.columns.map((c) => (
                      <td key={c.key} className={c.numeric ? "lists__num" : undefined}>
                        {r.cells[c.key]?.text}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {shown.length === 0 && <p className="placeholder">Keine Einträge</p>}
            {table.summary.length > 0 && (
              <ul aria-label="Summen" className="lists__summary">
                {table.summary.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            )}
          </>
        ) : (
          materialList(project, filter).map((section) => (
            <section key={section.title} className="lists__section">
              <h3>{section.title}</h3>
              {section.rows.length === 0 ? (
                <p className="placeholder">Keine Einträge</p>
              ) : (
                <table aria-label={section.title} className="lists__table">
                  <thead>
                    <tr>
                      {section.columns.map((c) => (
                        <th key={c.key} className={c.numeric ? "lists__num" : undefined}>
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.map((r) => (
                      <tr key={r.id}>
                        {section.columns.map((c) => (
                          <td key={c.key} className={c.numeric ? "lists__num" : undefined}>
                            {r.cells[c.key]?.text}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          ))
        )}
      </div>
    </div>
  );
}
