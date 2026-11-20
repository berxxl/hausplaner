/** Warnungen zu Räumen, Schrägen und Öffnungen (design.md Tabelle „Warnungen“). Frei von React. */
import { isSlopeValid } from "../geometry/ceiling";
import { roomStatuses, type RoomStatus } from "../geometry/rooms";
import { distance } from "../geometry/vec";
import type { Opening, Project } from "../model/types";
import { wallGeoms } from "../store/building";
import type { ProjectWarning } from "./index";

const statusCache = new WeakMap<
  Project["walls"],
  WeakMap<Project["rooms"], Map<string, RoomStatus>>
>();

/** Zustand aller Räume (zwischengespeichert je Wand- und Raumliste). */
export function allRoomStatuses(project: Project): Map<string, RoomStatus> {
  let inner = statusCache.get(project.walls);
  if (!inner) statusCache.set(project.walls, (inner = new WeakMap()));
  const hit = inner.get(project.rooms);
  if (hit) return hit;
  const result = new Map<string, RoomStatus>();
  for (const storey of project.storeys) {
    const rooms = project.rooms.filter((r) => r.storeyId === storey.id);
    if (rooms.length === 0) continue;
    for (const [id, s] of roomStatuses(wallGeoms(project, storey.id), rooms)) result.set(id, s);
  }
  inner.set(project.rooms, result);
  return result;
}

export function roomWarnings(project: Project): ProjectWarning[] {
  const names = new Map(project.rooms.map((r) => [r.id, r.name]));
  const warnings: ProjectWarning[] = [];
  for (const [id, s] of allRoomStatuses(project)) {
    const target = { kind: "room" as const, id };
    if (s.status === "open" || s.status === "in-wall") {
      warnings.push({
        key: `room-open:${id}`,
        text: `Raum nicht geschlossen: ${names.get(id)}`,
        target,
      });
    } else if (s.status === "merged") {
      warnings.push({
        key: `room-merged:${id}`,
        text: `Raum mit ${names.get(s.with[0]!)} verschmolzen`,
        target,
      });
    }
  }
  return warnings;
}

export function slopeWarnings(project: Project): ProjectWarning[] {
  return project.rooms.flatMap((room) =>
    (room.slopes ?? [])
      .filter((s) => !isSlopeValid(s, room.polygon))
      .map((s) => ({
        key: `slope-invalid:${s.id}`,
        text: `Schräge ungültig: ${room.name}`,
        target: { kind: "room" as const, id: room.id },
      })),
  );
}

const KIND_LABELS: Record<Opening["kind"], string> = {
  window: "Fenster",
  door: "Tür",
  opening: "Durchgang",
};

/** Grund, warum eine Öffnung ungültig ist, in der Reihenfolge aus design.md; null = gültig. */
export function openingProblem(project: Project, opening: Opening): string | null {
  const wall = project.walls.find((w) => w.id === opening.wallId);
  if (!wall) return null; // eigene Warnung opening-without-wall
  const length = distance(wall.start, wall.end);
  if (opening.offsetMm < 0 || opening.offsetMm + opening.widthMm > length) return "über Wandende";
  const other = project.openings.find(
    (o) =>
      o.id !== opening.id &&
      o.wallId === opening.wallId &&
      o.offsetMm < opening.offsetMm + opening.widthMm &&
      opening.offsetMm < o.offsetMm + o.widthMm &&
      o.sillMm < opening.sillMm + opening.heightMm &&
      opening.sillMm < o.sillMm + o.heightMm,
  );
  if (other) return `überlappt ${KIND_LABELS[other.kind]} bei ${other.offsetMm} mm`;
  const storey = project.storeys.find((s) => s.id === wall.storeyId);
  const wallHeight = wall.rawHeightMm ?? storey?.rawHeightMm ?? Infinity;
  if (opening.sillMm + opening.heightMm > wallHeight) return "höher als die Wand";
  return null;
}

export function openingWarnings(project: Project): ProjectWarning[] {
  return project.openings.flatMap((o) => {
    const problem = openingProblem(project, o);
    return problem
      ? [
          {
            key: `opening-invalid:${o.id}`,
            text: `Öffnung ungültig: ${problem}`,
            target: { kind: "opening" as const, id: o.id },
          },
        ]
      : [];
  });
}
