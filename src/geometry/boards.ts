/**
 * Verteiler (design.md M4 „Verteiler platzieren“, „Belegungsansicht“): Lage, Gerätebreite,
 * Belegung, Platzsuche, Reserve. Frei von React.
 */
import type { Board, Trade } from "../model/types";

/** Gewerke, die ein Verteiler je Art als Leitungsendpunkt anschließt (design.md M4). */
const BOARD_CONNECTS: Record<Board["kind"], readonly Trade[]> = {
  "meter-cabinet": ["power", "knx", "conduit", "other"],
  "sub-distribution": ["power", "knx", "conduit", "other"],
  media: ["data", "power", "conduit", "other"],
};

export function boardConnects(kind: Board["kind"]): readonly Trade[] {
  return BOARD_CONNECTS[kind];
}
