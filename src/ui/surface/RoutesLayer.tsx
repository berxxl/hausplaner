/**
 * Trassen in der Flächenansicht (design.md M3 „Darstellung“): Segmente in Statusfarben, Leerrohr
 * als doppelte Linie, Knoten als Punkt, Übergangsknoten als Raute, Durchbrüche als Kreis mit
 * Durchmesser, hervorgehobene Leitung in Orange, roter Rand bei offener Warnung.
 */
import { STATUS_COLORS, WARNING_COLOR } from "../labels";
import type { UV } from "./model";
import { HIGHLIGHT_COLOR, type RouteGeometry } from "./routeGeometry";

export function RoutesLayer({
  geometry,
  zoom,
  selectedIds,
  highlighted,
  warned,
  preview,
}: {
  geometry: RouteGeometry;
  zoom: number;
  selectedIds: ReadonlySet<string>;
  highlighted: ReadonlySet<string>;
  warned: ReadonlySet<string>;
  preview: { a: UV; b: UV } | null;
}) {
  const px = (n: number) => n / zoom;
  const color = (status: string) => STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? "#888";
  return (
    <g data-testid="surface-routes">
      {geometry.segments.map((s) => {
        const stroke = warned.has(s.id)
          ? WARNING_COLOR
          : highlighted.has(s.id)
            ? HIGHLIGHT_COLOR
            : selectedIds.has(s.id)
              ? "#0071e3"
              : color(s.status);
        return (
          <g
            key={s.id}
            data-segment={s.id}
            data-status={s.status}
            data-highlighted={highlighted.has(s.id) || undefined}
          >
            {s.conduit && (
              <line
                x1={s.a.u}
                y1={s.a.v}
                x2={s.b.u}
                y2={s.b.v}
                stroke={stroke}
                strokeWidth={px(7)}
                strokeLinecap="round"
              />
            )}
            {s.conduit && (
              <line
                x1={s.a.u}
                y1={s.a.v}
                x2={s.b.u}
                y2={s.b.v}
                stroke="#fff"
                strokeWidth={px(4)}
                strokeLinecap="round"
              />
            )}
            <line
              x1={s.a.u}
              y1={s.a.v}
              x2={s.b.u}
              y2={s.b.v}
              stroke={stroke}
              strokeWidth={px(selectedIds.has(s.id) || highlighted.has(s.id) ? 3.5 : 2)}
              strokeLinecap="round"
            />
          </g>
        );
      })}
      {geometry.penetrations.map((p) => (
        <circle
          key={p.id}
          data-penetration={p.id}
          cx={p.at.u}
          cy={p.at.v}
          r={Math.max(p.diameterMm / 2, px(4))}
          fill="none"
          stroke={warned.has(p.id) ? WARNING_COLOR : selectedIds.has(p.id) ? "#0071e3" : "#444"}
          strokeWidth={px(1.5)}
        />
      ))}
      {geometry.nodes.map((n) =>
        n.transition ? (
          <rect
            key={n.id}
            data-node={n.id}
            data-transition
            x={n.at.u - px(4)}
            y={n.at.v - px(4)}
            width={px(8)}
            height={px(8)}
            transform={`rotate(45 ${n.at.u} ${n.at.v})`}
            fill={selectedIds.has(n.id) ? "#0071e3" : "#fff"}
            stroke={warned.has(n.id) ? WARNING_COLOR : "#444"}
            strokeWidth={px(1.5)}
          />
        ) : (
          <circle
            key={n.id}
            data-node={n.id}
            cx={n.at.u}
            cy={n.at.v}
            r={px(n.device ? 2.5 : 3.5)}
            fill={selectedIds.has(n.id) ? "#0071e3" : "#444"}
          />
        ),
      )}
      {preview && (
        <line
          data-testid="route-preview"
          x1={preview.a.u}
          y1={preview.a.v}
          x2={preview.b.u}
          y2={preview.b.v}
          stroke="#0071e3"
          strokeOpacity={0.6}
          strokeWidth={px(2)}
          strokeDasharray={`${px(6)} ${px(4)}`}
        />
      )}
    </g>
  );
}
