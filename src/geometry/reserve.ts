/**
 * Reserve eines Verteilers (design.md M4 „Belegungsansicht“, „Bedarf vormerken“): belegte,
 * vorgemerkte und freie TE der Verteilerfelder. Frei von React.
 */
import { deviceTeWidth, distributionTe } from "./boards";
import { actuatorEarmarkTe } from "./knx";
import type { Board, Project } from "../model/types";

export interface Reserve {
  total: number;
  used: number;
  earmarked: number;
  /** gesamt − belegt − vorgemerkt, kann negativ sein */
  free: number;
  /** frei / gesamt unter teReservePercent */
  low: boolean;
}

/** Vorgemerkt: 1 LS je Stromkreis ohne Schutzgerät + TE des Aktorvorschlags. */
export function earmarkedTe(project: Project, board: Board): number {
  const mcb = project.catalog.deviceTypes.find((t) => t.id === "mcb");
  const perCircuit = mcb ? deviceTeWidth(mcb) : 1;
  const unprotected = project.circuits.filter(
    (c) =>
      c.boardId === board.id &&
      !project.devices.some((d) => d.id === c.protectionDeviceId && d.placement.kind === "board"),
  ).length;
  return unprotected * perCircuit + actuatorEarmarkTe(project, board.id);
}

export function boardReserve(project: Project, board: Board): Reserve {
  const { total, used } = distributionTe(project, board);
  const earmarked = earmarkedTe(project, board);
  const free = total - used - earmarked;
  const low = total > 0 && free / total < project.settings.teReservePercent / 100 - 1e-9;
  return { total, used, earmarked, free, low };
}
