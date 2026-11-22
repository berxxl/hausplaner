/** Raster der Belegungsansicht (design.md M4 „Belegungsansicht“): Felder, Reihen, Plätze in px. */
import { fieldHasRows, type Placement } from "../../geometry/boards";
import type { Board } from "../../model/types";

/** Raster der Ansicht in px (1 TE = 18 mm, hier 22 px). */
export const BOARD_LAYOUT = { te: 22, row: 56, head: 28, pad: 12, gap: 16, minTe: 6 } as const;

export interface FieldBox {
  fieldId: string;
  x: number;
  width: number;
}

/** Lage der Felder (links nach rechts) in px. */
export function boardLayout(board: Board): { fields: FieldBox[]; width: number; height: number } {
  const L = BOARD_LAYOUT;
  let x = L.pad;
  const fields = board.fields.map((f) => {
    const width = Math.max(f.tePerRow, L.minTe) * L.te + 2 * L.pad;
    const box = { fieldId: f.id, x, width };
    x += width + L.gap;
    return box;
  });
  const rows = Math.max(1, ...board.fields.map((f) => f.rows));
  return { fields, width: x, height: L.head + rows * L.row + 2 * L.pad };
}

/** Linke obere Ecke eines Platzes in px. */
export function slotPosition(board: Board, at: Placement): { x: number; y: number } | null {
  const L = BOARD_LAYOUT;
  const box = boardLayout(board).fields.find((f) => f.fieldId === at.fieldId);
  if (!box) return null;
  return { x: box.x + L.pad + (at.slot - 1) * L.te, y: L.head + L.pad + (at.row - 1) * L.row };
}

/** Platz unter einem Punkt der Ansicht. */
export function slotAt(board: Board, x: number, y: number): Placement | null {
  const L = BOARD_LAYOUT;
  for (const box of boardLayout(board).fields) {
    const field = board.fields.find((f) => f.id === box.fieldId)!;
    if (!fieldHasRows(field) || x < box.x + L.pad || x >= box.x + box.width - L.pad) continue;
    const slot = Math.floor((x - box.x - L.pad) / L.te) + 1;
    const row = Math.floor((y - L.head - L.pad) / L.row) + 1;
    if (row < 1 || row > field.rows || slot < 1 || slot > field.tePerRow) return null;
    return { fieldId: field.id, row, slot };
  }
  return null;
}

/** Einziger Text eines Katalogsymbols (z. B. „LS“), als Kürzel für schmale Geräte. */
export function symbolText(symbol: string | undefined): string | null {
  const texts = [...(symbol ?? "").matchAll(/<text[^>]*>([^<]+)<\/text>/g)];
  return texts.length === 1 ? texts[0]![1]!.trim() : null;
}
