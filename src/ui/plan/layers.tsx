/** Zeichenebenen des Grundrisses. Weltkoordinaten (mm, y nach oben) außer bei den Beschriftungen. */
import { useMemo } from "react";
import { fromPath, union } from "../../geometry/clipper";
import { openingClipped, openingFootprint } from "../../geometry/openings";
import { centroid } from "../../geometry/polygon";
import { finishedArea } from "../../geometry/rooms";
import { wallBody, type EndRef, type WallGeom } from "../../geometry/walls";
import { add, scale, sub, type Vec } from "../../geometry/vec";
import { formatArea, formatLength } from "../../model/units";
import type { Opening, Room, Storey } from "../../model/types";
import type { Selection } from "../../store/view";
import { screenToWorld, worldToScreen, type Camera, type Viewport } from "./camera";

const pts = (poly: readonly Vec[]) => poly.map((p) => `${p.x},${p.y}`).join(" ");

/** Raster: Linien alle 1 m und, wenn genug Platz ist, alle 100 mm. Nur zur Orientierung. */
export function Grid({ cam, vp }: { cam: Camera; vp: Viewport }) {
  const a = screenToWorld(cam, vp, { x: 0, y: vp.height });
  const b = screenToWorld(cam, vp, { x: vp.width, y: 0 });
  const lines: { key: string; x1: number; y1: number; x2: number; y2: number; major: boolean }[] =
    [];
  for (const step of cam.zoom * 100 >= 6 ? [100, 1000] : [1000]) {
    if ((b.x - a.x) / step > 400 || (b.y - a.y) / step > 400) continue;
    for (let x = Math.ceil(a.x / step) * step; x <= b.x; x += step) {
      if (step === 100 && x % 1000 === 0) continue;
      lines.push({ key: `v${step}:${x}`, x1: x, y1: a.y, x2: x, y2: b.y, major: step === 1000 });
    }
    for (let y = Math.ceil(a.y / step) * step; y <= b.y; y += step) {
      if (step === 100 && y % 1000 === 0) continue;
      lines.push({ key: `h${step}:${y}`, x1: a.x, y1: y, x2: b.x, y2: y, major: step === 1000 });
    }
  }
  return (
    <g className="grid" aria-hidden="true">
      {lines.map((l) => (
        <line
          key={l.key}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          className={l.major ? "grid__major" : "grid__minor"}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
}

export function RoomsLayer({
  rooms,
  selection,
}: {
  rooms: readonly Room[];
  selection: Selection | null;
}) {
  return (
    <g>
      {rooms.map((r) => (
        <polygon
          key={r.id}
          data-room={r.id}
          points={pts(r.polygon)}
          className={
            selection?.kind === "room" && selection.id === r.id ? "room room--selected" : "room"
          }
        />
      ))}
    </g>
  );
}

export function WallsLayer({
  walls,
  selection,
}: {
  walls: readonly WallGeom[];
  selection: Selection | null;
}) {
  // Vereinigte Wandfläche mit gemeinsamer Kontur, darüber die einzelnen Körper für Auswahl und Tests
  const outline = useMemo(() => {
    const bodies = walls.map((w) => wallBody(walls, w));
    return union(bodies)
      .map(
        (path) =>
          "M" +
          fromPath(path)
            .map((p) => `${p.x},${p.y}`)
            .join("L") +
          "Z",
      )
      .join(" ");
  }, [walls]);
  return (
    <g>
      <path
        d={outline}
        className="walls-outline"
        fillRule="nonzero"
        vectorEffect="non-scaling-stroke"
      />
      {walls.map((w) => (
        <polygon
          key={w.id}
          data-wall={w.id}
          points={pts(wallBody(walls, w))}
          className={
            selection?.kind === "wall" && selection.id === w.id ? "wall wall--selected" : "wall"
          }
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
}

/** Öffnungen als ausgesparte Rechtecke über die Wanddicke; ungültige rot umrandet. */
export function OpeningsLayer({
  walls,
  openings,
  selection,
  invalid,
}: {
  walls: readonly WallGeom[];
  openings: readonly Opening[];
  selection: Selection | null;
  invalid: ReadonlySet<string>;
}) {
  const byId = new Map(walls.map((w) => [w.id, w]));
  return (
    <g>
      {openings.map((o) => {
        const wall = byId.get(o.wallId);
        if (!wall) return null; // Verweis ins Leere: nicht dargestellt
        const fp = openingFootprint(wall, o);
        const selected = selection?.kind === "opening" && selection.id === o.id;
        const bad = invalid.has(o.id) || openingClipped(wall, o);
        const mid1 = scale(add(fp[0]!, fp[3]!), 0.5);
        const mid2 = scale(add(fp[1]!, fp[2]!), 0.5);
        return (
          <g
            key={o.id}
            data-opening={o.id}
            className={`opening opening--${o.kind}${selected ? " opening--selected" : ""}${bad ? " opening--invalid" : ""}`}
          >
            <polygon points={pts(fp)} vectorEffect="non-scaling-stroke" />
            {o.kind === "window" && (
              <line
                x1={mid1.x}
                y1={mid1.y}
                x2={mid2.x}
                y2={mid2.y}
                vectorEffect="non-scaling-stroke"
              />
            )}
            {o.kind === "door" && (
              <line
                x1={fp[0]!.x}
                y1={fp[0]!.y}
                x2={fp[2]!.x}
                y2={fp[2]!.y}
                vectorEffect="non-scaling-stroke"
              />
            )}
          </g>
        );
      })}
    </g>
  );
}

/** Raumnamen und fertige Flächen in Bildschirmkoordinaten (nicht gespiegelt). */
export function RoomLabels({
  rooms,
  storey,
  cam,
  vp,
}: {
  rooms: readonly Room[];
  storey: Storey | undefined;
  cam: Camera;
  vp: Viewport;
}) {
  return (
    <g className="room-labels" aria-hidden="true">
      {rooms.map((r) => {
        if (r.polygon.length < 3) return null;
        const c = worldToScreen(cam, vp, centroid(r.polygon));
        const plaster = r.plasterMm ?? storey?.defaults.plasterMm ?? 0;
        return (
          <text key={r.id} x={c.x} y={c.y} textAnchor="middle">
            <tspan x={c.x}>{r.name}</tspan>
            <tspan x={c.x} dy="1.2em" className="room-labels__area">
              {formatArea(finishedArea(r.polygon, plaster))}
            </tspan>
          </text>
        );
      })}
    </g>
  );
}

/** Markierung offener Wandenden. */
export function OpenEndMarkers({
  walls,
  ends,
  zoom,
}: {
  walls: readonly WallGeom[];
  ends: readonly EndRef[];
  zoom: number;
}) {
  const byId = new Map(walls.map((w) => [w.id, w]));
  const r = 9 / zoom;
  return (
    <g className="open-ends" data-testid="open-ends">
      {ends.map((e) => {
        const w = byId.get(e.wallId);
        if (!w) return null;
        const p = e.end === "start" ? w.start : w.end;
        return (
          <circle
            key={`${e.wallId}:${e.end}`}
            cx={p.x}
            cy={p.y}
            r={r}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </g>
  );
}

/** Messlinie mit Beschriftung in Bildschirmkoordinaten. */
export function MeasureOverlay({
  a,
  b,
  cam,
  vp,
}: {
  a: Vec;
  b: Vec | null;
  cam: Camera;
  vp: Viewport;
}) {
  const sa = worldToScreen(cam, vp, a);
  if (!b) return <circle cx={sa.x} cy={sa.y} r={4} className="measure" />;
  const sb = worldToScreen(cam, vp, b);
  const mid = scale(add(sa, sb), 0.5);
  const d = sub(b, a);
  return (
    <g className="measure">
      <line x1={sa.x} y1={sa.y} x2={sb.x} y2={sb.y} />
      <circle cx={sa.x} cy={sa.y} r={3} />
      <circle cx={sb.x} cy={sb.y} r={3} />
      <text x={mid.x} y={mid.y - 8} textAnchor="middle" data-testid="measure-label">
        {formatLength(Math.hypot(d.x, d.y))}
      </text>
    </g>
  );
}
