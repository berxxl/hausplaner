/**
 * Verteilerbelegung als Blatt (design.md M5 „Planinhalte“): Felder, Reihen, Geräte mit
 * Beschriftung wie in der Belegungsansicht, Zusammenfassung, darunter Stromkreise und KNX-Kanäle
 * des Verteilers. Nicht maßstäblich. Frei von React.
 */
import { boardDevices, fieldHasRows, FIELD_KIND_LABELS } from "../geometry/boards";
import { boardReserve } from "../geometry/reserve";
import type { Project } from "../model/types";
import { CIRCUIT_COLUMNS, circuitRows, KNX_COLUMNS, knxRows, knxSummary } from "../reports/rows";
import { filterRows } from "../reports/filter";
import { deviceCaption } from "../ui/board/layout";
import type { ExportOptions, SheetResult } from "./compose";
import { drawingArea, LINE, pdfText, TEXT, type Item } from "./sheet";
import { fitText, layoutTables, pagedSheets } from "./table";

const FIELD_GAP = 4;
const FIELD_PAD = 2;
const FIELD_HEAD = 6;
const MIN_TE = 6;
const MAX_TE_MM = 9;

export function boardSheets(project: Project, boardId: string, o: ExportOptions): SheetResult[] {
  const board = project.boards.find((b) => b.id === boardId);
  if (!board) return [];
  const storey = project.storeys.find((s) => s.id === board.storeyId)?.name ?? "";
  const content = `Belegung ${board.label}`;
  const area = drawingArea(o.format);
  const items: Item[] = [];
  const reserve = boardReserve(project, board);
  items.push({
    kind: "text",
    x: area.x,
    y: area.y + 4,
    text: pdfText(
      `${board.label}: ${reserve.used} belegt · ${reserve.earmarked} vorgemerkt · ${reserve.free} frei von ${reserve.total} TE`,
    ),
    size: TEXT.room,
    bold: true,
    data: "board-summary",
  });
  const top = area.y + 9;
  const fieldTe = board.fields.map((f) => Math.max(f.tePerRow, MIN_TE));
  const sumTe = fieldTe.reduce((a, b) => a + b, 0);
  const gaps =
    Math.max(0, board.fields.length - 1) * FIELD_GAP + board.fields.length * 2 * FIELD_PAD;
  let te = Math.min(MAX_TE_MM, (area.width - gaps) / Math.max(1, sumTe));
  const maxRows = Math.max(1, ...board.fields.map((f) => f.rows));
  const heightFor = (t: number) => FIELD_HEAD + maxRows * 2.5 * t + 2 * FIELD_PAD;
  if (heightFor(te) > area.height * 0.6)
    te = (area.height * 0.6 - FIELD_HEAD - 2 * FIELD_PAD) / (maxRows * 2.5);
  const rowH = 2.5 * te;
  const height = heightFor(te);
  const devices = boardDevices(project, board.id);

  let x = area.x;
  board.fields.forEach((field, fi) => {
    const w = fieldTe[fi]! * te + 2 * FIELD_PAD;
    items.push({
      kind: "poly",
      points: [
        [x, top],
        [x + w, top],
        [x + w, top + height],
        [x, top + height],
      ],
      closed: true,
      width: LINE.edge,
      data: `field:${field.id}`,
    });
    const head = fieldHasRows(field)
      ? `${FIELD_KIND_LABELS[field.kind]} · ${field.rows} × ${field.tePerRow} TE`
      : FIELD_KIND_LABELS[field.kind];
    items.push({
      kind: "text",
      x: x + FIELD_PAD,
      y: top + 4,
      text: pdfText(fitText(head, w - 2 * FIELD_PAD, TEXT.small)),
      size: TEXT.small,
      bold: true,
    });
    const x0 = x + FIELD_PAD;
    const y0 = top + FIELD_HEAD;
    for (let r = 0; r < field.rows; r++)
      for (let s = 0; s < field.tePerRow; s++)
        items.push({
          kind: "poly",
          points: [
            [x0 + s * te, y0 + r * rowH],
            [x0 + (s + 1) * te, y0 + r * rowH],
            [x0 + (s + 1) * te, y0 + (r + 1) * rowH - 1],
            [x0 + s * te, y0 + (r + 1) * rowH - 1],
          ],
          closed: true,
          width: LINE.dimension,
          color: "#c7c7cc",
        });
    for (const d of devices) {
      const p = d.placement;
      if (p.kind !== "board" || p.fieldId !== field.id) continue;
      const cap = deviceCaption(project, d);
      const dx = x0 + (p.slot - 1) * te;
      const dy = y0 + (p.row - 1) * rowH;
      const dw = cap.teWidth * te;
      items.push({
        kind: "poly",
        points: [
          [dx + 0.2, dy + 0.2],
          [dx + dw - 0.2, dy + 0.2],
          [dx + dw - 0.2, dy + rowH - 1.2],
          [dx + 0.2, dy + rowH - 1.2],
        ],
        closed: true,
        fill: "#f2f2f2",
        width: LINE.edge,
        data: `board-device:${d.id}`,
      });
      if (cap.narrow)
        items.push({
          kind: "text",
          x: dx + dw / 2 + 0.6,
          y: dy + rowH - 2,
          text: pdfText(fitText(cap.shown, rowH - 2.5, TEXT.small)),
          size: TEXT.small,
          rotate: -90,
          data: `board-label:${d.id}`,
        });
      else {
        items.push({
          kind: "text",
          x: dx + 1,
          y: dy + 2.8,
          text: pdfText(fitText(cap.shown, dw - 2, TEXT.small)),
          size: TEXT.small,
          bold: true,
          data: `board-label:${d.id}`,
        });
        if (cap.typeName !== cap.shown)
          items.push({
            kind: "text",
            x: dx + 1,
            y: dy + 5.4,
            text: pdfText(fitText(cap.typeName, dw - 2, TEXT.small)),
            size: TEXT.small,
          });
      }
    }
    x += w + FIELD_GAP;
  });

  const filter = { trades: o.trades, statuses: o.statuses };
  const circuits = filterRows(circuitRows(project), filter).filter((r) => r.boardId === board.id);
  const knx = knxRows(project).filter((r) => r.boardId === board.id);
  const pages = layoutTables(
    [
      { title: "Stromkreise", columns: CIRCUIT_COLUMNS, rows: circuits, summary: [] },
      ...(knx.length > 0
        ? [{ title: "KNX-Kanäle", columns: KNX_COLUMNS, rows: knx, summary: [knxSummary(knx)] }]
        : []),
    ],
    area,
    top + height + 8,
  );
  pages[0]!.unshift(...items);
  return pagedSheets(o, content, storey, pages).map((sheet) => ({ sheet, content, fit: null }));
}
