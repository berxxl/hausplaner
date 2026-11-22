/**
 * Trassen im Grundriss (design.md M3 „Darstellung“): Boden- und Deckensegmente des aktiven Geschosses
 * (Decke gestrichelt), Wanddurchbrüche als Strich durch die Wand, Deckendurchbrüche als Kreis.
 */
import { segmentWorldEnds } from "../../geometry/routes";
import { surfaceKind } from "../../model/devices";
import type { Project } from "../../model/types";
import { STATUS_COLORS } from "../labels";
import { HIGHLIGHT_COLOR } from "../surface/routeGeometry";

export function RoutesPlanLayer({
  project,
  storeyId,
  zoom,
  highlighted,
}: {
  project: Project;
  storeyId: string;
  zoom: number;
  highlighted: ReadonlySet<string>;
}) {
  const nodes = new Map(project.routeNodes.map((n) => [n.id, n]));
  const px = (n: number) => n / zoom;
  const items: React.ReactNode[] = [];
  for (const s of project.routeSegments) {
    const ends = segmentWorldEnds(project, s, nodes);
    if (!ends) continue;
    const color = highlighted.has(s.id) ? HIGHLIGHT_COLOR : STATUS_COLORS[s.status];
    const width = px(highlighted.has(s.id) ? 3.5 : 2);
    if (s.kind === "surface" && s.surface) {
      const kind = surfaceKind(s.surface);
      if (kind === "wall" || ends.a.storeyId !== storeyId) continue;
      items.push(
        <line
          key={s.id}
          data-plan-segment={s.id}
          data-highlighted={highlighted.has(s.id) || undefined}
          x1={ends.a.x}
          y1={ends.a.y}
          x2={ends.b.x}
          y2={ends.b.y}
          stroke={color}
          strokeWidth={width}
          strokeDasharray={kind === "floor" ? undefined : `${px(6)} ${px(4)}`}
        />,
      );
    } else if (s.penetration) {
      const r = Math.max(s.penetration.diameterMm / 2, px(4));
      const vertical = ends.a.storeyId !== ends.b.storeyId;
      if (!vertical) {
        if (ends.a.storeyId !== storeyId) continue;
        items.push(
          <line
            key={s.id}
            data-plan-segment={s.id}
            x1={ends.a.x}
            y1={ends.a.y}
            x2={ends.b.x}
            y2={ends.b.y}
            stroke={color}
            strokeWidth={px(4)}
          />,
        );
      } else {
        const own =
          ends.a.storeyId === storeyId ? ends.a : ends.b.storeyId === storeyId ? ends.b : null;
        if (!own) continue;
        items.push(
          <circle
            key={s.id}
            data-plan-segment={s.id}
            cx={own.x}
            cy={own.y}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={px(1.5)}
          />,
        );
      }
    }
  }
  return <g data-testid="plan-routes">{items}</g>;
}
