import { useId, useState, type ReactNode } from "react";
import { AcConnectionInfo } from "./AcConnectionInfo";
import { finishedWallDistances, rawHeightOf, type PlanDirection } from "../geometry/devices";
import { OPENING_LABELS } from "../geometry/openings";
import type { RoomView } from "../geometry/surfaces";
import { mountingForSurface, surfaceKind } from "../model/devices";
import type { Device, Project } from "../model/types";
import { formatMm } from "../model/units";
import {
  COMBINATION_SPACING_MM,
  combineDevices,
  deleteDevices,
  editDevice,
} from "../store/devices";
import type { ProjectStore } from "../store/history";
import type { ViewStore } from "../store/view";
import { roomViewsOf } from "./derived";
import { DegField, MmField, TextField } from "./fields";
import { STATUS_LABELS } from "./labels";
import { BoardDeviceFields, ConsumerChannel, DeviceAssignments } from "./DeviceAssignments";

/** Bezugskante für den Abstand eines Wandgeräts (fertige Raumecke oder Laibung), design.md M2. */
interface ReferenceEdge {
  key: string;
  label: string;
  u: number;
  /** +1: Abstand = u − Kante (Kante links des Geräts), −1: Kante − u */
  dir?: 1 | -1;
}

function roomViewOf(project: Project, device: Device): RoomView | undefined {
  if (device.placement.kind !== "surface") return undefined;
  const { surface, u } = device.placement;
  for (const views of roomViewsOf(project).values()) {
    const v = views.find((x) => x.ref === surface && u >= x.section.uFrom && u <= x.section.uTo);
    if (v) return v;
  }
  return undefined;
}

function referenceEdges(view: RoomView | undefined): ReferenceEdge[] {
  if (!view) return [{ key: "start", label: "Wandanfang links", u: 0, dir: 1 }];
  const edges: ReferenceEdge[] = [
    { key: "left", label: "linke Raumecke", u: view.finished.uFrom, dir: 1 },
    { key: "right", label: "rechte Raumecke", u: view.finished.uTo, dir: -1 },
  ];
  view.openings.forEach((o, i) => {
    const name = `${OPENING_LABELS[o.kind]} ${i + 1}`;
    edges.push({ key: `${o.id}:l`, label: `${name}, linke Laibung`, u: o.uFrom });
    edges.push({ key: `${o.id}:r`, label: `${name}, rechte Laibung`, u: o.uTo });
  });
  return edges;
}

const DIRECTION_LABELS: Record<PlanDirection, string> = {
  left: "links",
  right: "rechts",
  up: "oben",
  down: "unten",
};

/**
 * Abstände eines Decken- oder Bodengeräts zur nächsten fertigen Wandoberfläche je Achse im
 * Grundriss (design.md M2 „Bezug und Bemaßung“). Decke: u läuft gespiegelt (x = −u).
 */
function wallDistanceFields(project: Project, device: Device) {
  const p = device.placement;
  if (p.kind !== "surface") return [];
  const [kind, roomId] = p.surface.split(":");
  if (kind !== "ceiling" && kind !== "floor") return [];
  const room = project.rooms.find((r) => r.id === roomId);
  const storey = project.storeys.find((s) => s.id === device.storeyId);
  if (!room || !storey) return [];
  const sign = kind === "ceiling" ? -1 : 1;
  const q = { x: sign * p.u, y: p.v };
  const d = finishedWallDistances(room.polygon, room.plasterMm ?? storey.defaults.plasterMm, q);
  const pick = (a: PlanDirection, b: PlanDirection): PlanDirection | null =>
    d[a] === null ? (d[b] === null ? null : b) : d[b] === null || d[a]! <= d[b]! ? a : b;
  const fields: { dir: PlanDirection; value: number; placement(mm: number): typeof p }[] = [];
  const x = pick("left", "right");
  if (x) {
    const edge = x === "left" ? q.x - d.left! : q.x + d.right!;
    fields.push({
      dir: x,
      value: Math.round(d[x]!),
      placement: (mm) => ({ ...p, u: Math.round(sign * (x === "left" ? edge + mm : edge - mm)) }),
    });
  }
  const y = pick("down", "up");
  if (y) {
    const edge = y === "down" ? q.y - d.down! : q.y + d.up!;
    fields.push({
      dir: y,
      value: Math.round(d[y]!),
      placement: (mm) => ({ ...p, v: Math.round(y === "down" ? edge + mm : edge - mm) }),
    });
  }
  return fields;
}

/** Eigenschaften eines Geräts bzw. einer Mehrfachauswahl (design.md M2 „Bezug und Bemaßung“). */
export function DeviceProperties({
  project,
  store,
  view,
  ids,
}: {
  project: Project;
  store: ProjectStore;
  view: ViewStore;
  ids: string[];
}) {
  if (ids.length > 1) return <MultiDevice project={project} store={store} view={view} ids={ids} />;
  const device = project.devices.find((d) => d.id === ids[0]);
  if (!device) return null;
  return (
    <SingleDevice key={device.id} device={device} project={project} store={store} view={view} />
  );
}

function SingleDevice({
  device,
  project,
  store,
  view,
}: {
  device: Device;
  project: Project;
  store: ProjectStore;
  view: ViewStore;
}) {
  const typeId = useId();
  const statusId = useId();
  const refId = useId();
  const [edgeKey, setEdgeKey] = useState("left");
  const p = device.placement;
  const mounting =
    p.kind === "free"
      ? "free"
      : p.kind === "board"
        ? "din-rail"
        : mountingForSurface(surfaceKind(p.surface));
  const compatible = project.catalog.deviceTypes.filter(
    (t) => t.mounting.includes(mounting) || t.id === device.typeId,
  );
  const edit = (patch: Parameters<typeof editDevice>[1], label?: string) =>
    store.execute(editDevice(device.id, patch, label));
  const isWall = p.kind === "surface" && surfaceKind(p.surface) === "wall";

  let positionFields: ReactNode;
  if (p.kind === "free") {
    positionFields = (
      <>
        <MmField
          label="x"
          value={p.x}
          onCommit={(x) => edit({ placement: { ...p, x } }, "Gerät verschieben")}
        />
        <MmField
          label="y"
          value={p.y}
          onCommit={(y) => edit({ placement: { ...p, y } }, "Gerät verschieben")}
        />
        <MmField
          label="z über Rohfußboden"
          value={p.z}
          onCommit={(z) => edit({ placement: { ...p, z } }, "Gerät verschieben")}
        />
      </>
    );
  } else if (isWall) {
    const edges = referenceEdges(roomViewOf(project, device));
    const edge = edges.find((e) => e.key === edgeKey) ?? edges[0]!;
    const dir = edge.dir ?? (p.u >= edge.u ? 1 : -1);
    const distance = Math.round((p.u - edge.u) * dir);
    const raw = rawHeightOf(project, device);
    positionFields = (
      <>
        <div className="field">
          <label htmlFor={refId}>Bezugskante</label>
          <select id={refId} value={edge.key} onChange={(e) => setEdgeKey(e.target.value)}>
            {edges.map((e) => (
              <option key={e.key} value={e.key}>
                {e.label}
              </option>
            ))}
          </select>
        </div>
        <MmField
          label="Abstand zur Bezugskante (Gerätemitte)"
          value={distance}
          onCommit={(d) =>
            edit({ placement: { ...p, u: Math.round(edge.u + dir * d) } }, "Gerät verschieben")
          }
        />
        <MmField
          label="Höhe über OKFF (Gerätemitte)"
          value={p.v}
          onCommit={(v) => edit({ placement: { ...p, v } }, "Gerät verschieben")}
        />
        <p className="field-info" aria-label="Rohbauhöhe">
          Rohbauhöhe: {raw === null ? "–" : `${formatMm(raw)} mm`}
        </p>
      </>
    );
  } else if (p.kind === "surface") {
    const distances = wallDistanceFields(project, device);
    positionFields = (
      <>
        {distances.map((f) => (
          <MmField
            key={f.dir}
            label={`Abstand zur Wand ${DIRECTION_LABELS[f.dir]} (Grundriss)`}
            min={0}
            value={f.value}
            onCommit={(mm) => edit({ placement: f.placement(mm) }, "Gerät verschieben")}
          />
        ))}
        <MmField
          label="u (Fläche)"
          value={p.u}
          onCommit={(u) => edit({ placement: { ...p, u } }, "Gerät verschieben")}
        />
        <MmField
          label="v (Fläche)"
          value={p.v}
          onCommit={(v) => edit({ placement: { ...p, v } }, "Gerät verschieben")}
        />
      </>
    );
  }

  return (
    <div className="device-properties">
      <TextField label="Bezeichnung" value={device.label} onCommit={(label) => edit({ label })} />
      <div className="field">
        <label htmlFor={typeId}>Typ</label>
        <select
          id={typeId}
          value={device.typeId}
          onChange={(e) => edit({ typeId: e.target.value })}
        >
          {compatible.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={statusId}>Status</label>
        <select
          id={statusId}
          value={device.status}
          onChange={(e) => edit({ status: e.target.value as Device["status"] })}
        >
          {(Object.keys(STATUS_LABELS) as Device["status"][]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      {positionFields}
      {p.kind === "board" && (
        <BoardDeviceFields device={device} project={project} store={store} view={view} />
      )}
      {p.kind === "surface" && (
        <DegField
          label="Drehung"
          value={p.rotationDeg}
          onCommit={(rotationDeg) => edit({ placement: { ...p, rotationDeg } })}
        />
      )}
      <DeviceAssignments ids={[device.id]} project={project} store={store} view={view} />
      <ConsumerChannel device={device} project={project} store={store} />
      <AcConnectionInfo project={project} view={view} deviceId={device.id} />
      <button type="button" onClick={() => store.execute(deleteDevices([device.id]))}>
        Gerät löschen
      </button>
    </div>
  );
}

function MultiDevice({
  project,
  store,
  view,
  ids,
}: {
  project: Project;
  store: ProjectStore;
  view: ViewStore;
  ids: string[];
}) {
  const [spacing, setSpacing] = useState(COMBINATION_SPACING_MM);
  const [error, setError] = useState<string | null>(null);
  // Kombinieren nur für Geräte derselben Fläche (Mehrfachauswahl im Grundriss geht ab M4 über Flächen)
  const surfaces = new Set(
    project.devices
      .filter((d) => ids.includes(d.id))
      .map((d) => (d.placement.kind === "surface" ? d.placement.surface : d.id)),
  );
  const sameSurface = surfaces.size === 1;
  const combine = (direction: "horizontal" | "vertical") => {
    const r = combineDevices(project, ids, direction, spacing);
    if (!r.ok) return setError(r.error);
    setError(null);
    store.execute(r.command);
  };
  return (
    <div className="device-properties">
      <p>{ids.length} Geräte ausgewählt</p>
      {sameSurface && <MmField label="Achsabstand" min={1} value={spacing} onCommit={setSpacing} />}
      <button type="button" disabled={!sameSurface} onClick={() => combine("horizontal")}>
        Waagerecht kombinieren
      </button>
      <button type="button" disabled={!sameSurface} onClick={() => combine("vertical")}>
        Senkrecht kombinieren
      </button>
      {error && <p role="alert">{error}</p>}
      <DeviceAssignments ids={ids} project={project} store={store} view={view} />
      <button
        type="button"
        onClick={() => {
          store.execute(deleteDevices(ids));
          view.select(null);
        }}
      >
        Geräte löschen
      </button>
    </div>
  );
}
