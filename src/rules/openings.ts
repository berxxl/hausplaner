/** Warnungsregeln für Öffnungen (M1). Frei von React. */
import type { Project } from "../model/types";

export interface Warning {
  /** Stabiler Schlüssel `<regel>:<objektId>`. */
  key: string;
  text: string;
}

/** `opening-without-wall`: Öffnung verweist auf eine Wand, die es nicht gibt. */
export function openingsWithoutWall(project: Project): Warning[] {
  const wallIds = new Set(project.walls.map((w) => w.id));
  return project.openings
    .filter((o) => !wallIds.has(o.wallId))
    .map((o) => ({ key: `opening-without-wall:${o.id}`, text: `Öffnung ohne Wand (${o.wallId})` }));
}
