/** Welche Fläche ein Doppelklick im Grundriss öffnet (design.md „Oberfläche“). Frei von React. */
import { pointInPolygon } from "../../geometry/polygon";
import { sidePoint, wallSides } from "../../geometry/surfaces";
import { distance, dot, projectOnSegment, sub, type Vec } from "../../geometry/vec";
import type { Project } from "../../model/types";
import type { SurfaceTarget } from "../../store/view";
import { roomViewsOf } from "../derived";

/**
 * Im Raum: die Wandansicht des Raums, deren Abschnitt dem Punkt am nächsten liegt.
 * Außerhalb aller Räume: die ganze Wandseite, vor der der Punkt liegt (bis `maxDistanceMm`).
 */
export function surfaceAt(
  project: Project,
  storeyId: string,
  p: Vec,
  maxDistanceMm: number,
): SurfaceTarget | null {
  const room = project.rooms.find(
    (r) => r.storeyId === storeyId && r.polygon.length >= 3 && pointInPolygon(p, r.polygon),
  );
  if (room) {
    let best: { key: string; d: number } | null = null;
    for (const v of roomViewsOf(project).get(room.id) ?? []) {
      const pr = projectOnSegment(p, v.base[0], v.base[1]);
      const q = pr.t <= 0 ? v.base[0] : pr.t >= 1 ? v.base[1] : pr.point;
      const d = distance(p, q);
      if (!best || d < best.d) best = { key: v.key, d };
    }
    return best ? { kind: "room-wall", key: best.key } : null;
  }
  let best: { ref: string; d: number } | null = null;
  for (const side of wallSides(project, storeyId)) {
    if (dot(sub(p, side.origin), side.outward) <= 0) continue; // nicht vor dieser Seite
    const a = sidePoint(side, side.uMin);
    const b = sidePoint(side, side.uMax);
    const pr = projectOnSegment(p, a, b);
    if (pr.t < 0 || pr.t > 1) continue;
    if (pr.distance <= maxDistanceMm && (!best || pr.distance < best.d))
      best = { ref: side.ref, d: pr.distance };
  }
  return best ? { kind: "wall-side", ref: best.ref } : null;
}
