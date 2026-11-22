/** Eigenschaften von Trassenknoten und -segmenten (design.md M3 „Trassen zeichnen“, „Leerrohre“, „Status“). */
import { useId } from "react";
import { CONDUIT_SIZES, occupancy } from "../geometry/cables";
import { roomViewAt, segmentLength } from "../geometry/routes";
import { surfaceKind } from "../model/devices";
import type { Project, RouteNode, RouteSegment, Status } from "../model/types";
import { formatMm } from "../model/units";
import type { ProjectStore } from "../store/history";
import { deleteRoute, editSegments, moveNode } from "../store/routes";
import type { ViewStore } from "../store/view";
import { MmField } from "./fields";
import { STATUS_LABELS } from "./labels";

const METHOD_LABELS = {
  drill: "Bohrung",
  "core-drill": "Kernbohrung",
  slot: "Schlitz",
  conduit: "Leerrohr",
} as const;

export function RouteNodeProperties({
  node,
  project,
  store,
}: {
  node: RouteNode;
  project: Project;
  store: ProjectStore;
}) {
  const a = node.anchors[0]!;
  const device = node.deviceId ? project.devices.find((d) => d.id === node.deviceId) : undefined;
  const move = (patch: Partial<typeof a>) => store.execute(moveNode(node.id, { ...a, ...patch }));
  const view = surfaceKind(a.surface) === "wall" ? roomViewAt(project, a.surface, a.u) : undefined;
  return (
    <>
      {device ? (
        <p className="field-info">Am Gerät „{device.label}“; der Knoten folgt dem Gerät.</p>
      ) : view ? (
        <>
          <MmField
            label="Abstand zur linken Raumecke"
            value={Math.round(a.u - view.finished.uFrom)}
            onCommit={(d) => move({ u: Math.round(view.finished.uFrom + d) })}
          />
          <MmField
            label="Abstand zur rechten Raumecke"
            value={Math.round(view.finished.uTo - a.u)}
            onCommit={(d) => move({ u: Math.round(view.finished.uTo - d) })}
          />
          <MmField label="Höhe über OKFF" value={a.v} onCommit={(v) => move({ v })} />
        </>
      ) : (
        <>
          <MmField label="u (Fläche)" value={a.u} onCommit={(u) => move({ u })} />
          <MmField label="v (Fläche)" value={a.v} onCommit={(v) => move({ v })} />
        </>
      )}
      {node.anchors.length > 1 && (
        <p className="field-info">Übergang auf {node.anchors.length - 1} weitere Fläche(n)</p>
      )}
      <button type="button" onClick={() => store.execute(deleteRoute({ nodes: [node.id] }))}>
        Knoten löschen
      </button>
    </>
  );
}

function StatusSelect({ value, onChange }: { value: Status | ""; onChange(status: Status): void }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>Status</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as Status)}>
        {value === "" && <option value="">–</option>}
        {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
    </div>
  );
}

export function RouteSegmentProperties({
  ids,
  project,
  store,
  view,
}: {
  ids: string[];
  project: Project;
  store: ProjectStore;
  view: ViewStore;
}) {
  const conduitId = useId();
  const methodId = useId();
  const segments = ids
    .map((id) => project.routeSegments.find((s) => s.id === id))
    .filter((s): s is RouteSegment => !!s);
  if (segments.length === 0) return null;
  const edit = (patch: Parameters<typeof editSegments>[1]) =>
    store.execute(editSegments(ids, patch));
  const remove = () => store.execute(deleteRoute({ segments: ids }));
  if (segments.length > 1) {
    const statuses = new Set(segments.map((s) => s.status));
    return (
      <>
        <p>{segments.length} Segmente ausgewählt</p>
        <StatusSelect
          value={statuses.size === 1 ? segments[0]!.status : ""}
          onChange={(status) => edit({ status })}
        />
        <button type="button" onClick={remove}>
          Segmente löschen
        </button>
      </>
    );
  }
  const s = segments[0]!;
  const nodes = new Map(project.routeNodes.map((n) => [n.id, n]));
  const length = segmentLength(project, s, nodes);
  const occ = occupancy(project, s.id);
  return (
    <>
      <StatusSelect value={s.status} onChange={(status) => edit({ status })} />
      <p className="field-info" aria-label="Länge">
        Länge: {length === null ? "–" : `${formatMm(Math.round(length))} mm`}
        {s.kind === "penetration" ? " (Bauteildicke)" : ""}
      </p>
      {s.penetration && (
        <>
          <div className="field">
            <label htmlFor={methodId}>Art</label>
            <select
              id={methodId}
              value={s.penetration.method}
              onChange={(e) =>
                edit({
                  penetration: {
                    ...s.penetration!,
                    method: e.target.value as keyof typeof METHOD_LABELS,
                  },
                })
              }
            >
              {(Object.keys(METHOD_LABELS) as (keyof typeof METHOD_LABELS)[]).map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABELS[m]}
                </option>
              ))}
            </select>
          </div>
          <MmField
            label="Durchmesser"
            min={1}
            value={s.penetration.diameterMm}
            onCommit={(diameterMm) => edit({ penetration: { ...s.penetration!, diameterMm } })}
          />
        </>
      )}
      {s.kind === "surface" && (
        <div className="field">
          <label htmlFor={conduitId}>Leerrohr</label>
          <select
            id={conduitId}
            value={s.conduit?.size ?? ""}
            onChange={(e) => {
              const size = CONDUIT_SIZES.find((c) => c.size === e.target.value);
              edit({ conduit: size ? { ...size } : undefined });
            }}
          >
            <option value="">kein</option>
            {CONDUIT_SIZES.map((c) => (
              <option key={c.size} value={c.size}>
                {c.size} ({String(c.innerDiameterMm).replace(".", ",")} mm innen)
              </option>
            ))}
            {s.conduit && !CONDUIT_SIZES.some((c) => c.size === s.conduit!.size) && (
              <option value={s.conduit.size}>{s.conduit.size}</option>
            )}
          </select>
        </div>
      )}
      <section aria-label="Belegung" className="field-info">
        <p>
          {occ.cables.length} {occ.cables.length === 1 ? "Leitung" : "Leitungen"},{" "}
          {Math.round(occ.areaMm2)} mm²
          {occ.fill !== null && `, Füllgrad ${Math.round(occ.fill * 100)} %`}
        </p>
        {occ.cables.length > 0 && (
          <ul>
            {occ.cables.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="link"
                  onClick={() => view.select({ kind: "cable", id: c.id })}
                >
                  {c.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <button type="button" onClick={remove}>
        Segment löschen
      </button>
    </>
  );
}
