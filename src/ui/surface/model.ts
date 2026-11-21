/** Aufbereitung einer Fläche für die Flächenansicht. Frei von React. */
import {
  slopeFrame,
  slopeOutline,
  viewOpenings,
  wallSides,
  type RoomView,
  type ViewOpening,
} from "../../geometry/surfaces";
import { distance, projectOnSegment, type Vec } from "../../geometry/vec";
import type { Project } from "../../model/types";
import type { SurfaceTarget } from "../../store/view";
import { findRoomView, freeSurfacesOf, roomViewsOf } from "../derived";

export interface UV {
  u: number;
  v: number;
}

export interface EdgeLabel {
  text: string;
  at: UV;
  target: SurfaceTarget;
}

export interface SurfaceModel {
  kind: SurfaceTarget["kind"];
  /** SurfaceRef der gezeigten Fläche (Geräte darauf) */
  ref: string;
  /** Raumansicht: u-Bereich des Rohbauabschnitts; Geräte außerhalb gehören zu anderen Räumen */
  uRange?: [number, number];
  /** Raumansicht einer Wandseite (Zonen und Zuführungen) */
  roomView?: RoomView;
  title: string;
  storeyId: string;
  contour: UV[];
  openings: ViewOpening[];
  labels: EdgeLabel[];
  nav: { label: string; target: SurfaceTarget; rel: "left" | "right" | "ceiling" | "floor" }[];
  /** Gesamtbreite für die Bemaßung */
  widthMm?: number;
  /** fertige Maße (Raumansicht) oder Rohbau (ganze Wandseite) */
  finished: boolean;
}

const toUV = (p: Vec, mirror: boolean): UV => ({ u: mirror ? -p.x : p.x, v: p.y });

export function surfaceModel(project: Project, target: SurfaceTarget): SurfaceModel | null {
  switch (target.kind) {
    case "room-wall": {
      const v = findRoomView(project, target.key);
      const room = v && project.rooms.find((r) => r.id === v.roomId);
      if (!v || !room) return null;
      const contour: UV[] = [
        { u: v.finished.uFrom, v: 0 },
        { u: v.finished.uTo, v: 0 },
        ...[...v.top].reverse(),
      ];
      const nav: SurfaceModel["nav"] = [];
      const left = v.left ? findRoomView(project, v.left) : undefined;
      const right = v.right ? findRoomView(project, v.right) : undefined;
      if (left)
        nav.push({
          rel: "left",
          label: `◀ ${left.name}`,
          target: { kind: "room-wall", key: left.key },
        });
      if (right)
        nav.push({
          rel: "right",
          label: `${right.name} ▶`,
          target: { kind: "room-wall", key: right.key },
        });
      nav.push({ rel: "ceiling", label: "Decke", target: { kind: "ceiling", roomId: room.id } });
      nav.push({ rel: "floor", label: "Boden", target: { kind: "floor", roomId: room.id } });
      return {
        kind: target.kind,
        ref: v.ref,
        uRange: [v.section.uFrom, v.section.uTo],
        roomView: v,
        title: `${room.name} › ${v.name}`,
        storeyId: v.storeyId,
        contour,
        openings: v.openings,
        labels: [],
        nav,
        widthMm: v.finished.uTo - v.finished.uFrom,
        finished: true,
      };
    }
    case "wall-side": {
      const wall = project.walls.find((w) => target.ref.startsWith(`wall:${w.id}:`));
      if (!wall) return null;
      const side = wallSides(project, wall.storeyId).find((s) => s.ref === target.ref);
      if (!side) return null;
      const free = freeSurfacesOf(project, wall.storeyId).find((f) => f.ref === target.ref);
      const outside = free?.outside ?? false;
      return {
        kind: target.kind,
        ref: target.ref,
        title: free?.name ?? "Wandseite",
        storeyId: wall.storeyId,
        contour: [
          { u: side.uMin, v: 0 },
          { u: side.uMax, v: 0 },
          { u: side.uMax, v: side.wallHeightMm },
          { u: side.uMin, v: side.wallHeightMm },
        ],
        openings: viewOpenings(project, side, 0, 0, outside),
        labels: [],
        nav: [],
        widthMm: side.uMax - side.uMin,
        finished: false,
      };
    }
    case "ceiling":
    case "floor": {
      const room = project.rooms.find((r) => r.id === target.roomId);
      if (!room) return null;
      const mirror = target.kind === "ceiling";
      const labels = (roomViewsOf(project).get(room.id) ?? [])
        .filter((v) => !v.freeStanding)
        .map((v) => ({
          text: v.name,
          at: toUV(
            { x: (v.base[0].x + v.base[1].x) / 2, y: (v.base[0].y + v.base[1].y) / 2 },
            mirror,
          ),
          target: { kind: "room-wall", key: v.key } as SurfaceTarget,
        }));
      return {
        kind: target.kind,
        ref: `${mirror ? "ceiling" : "floor"}:${room.id}`,
        title: `${room.name} › ${mirror ? "Decke" : "Boden"}`,
        storeyId: room.storeyId,
        contour: room.polygon.map((p) => toUV(p, mirror)),
        openings: [],
        labels,
        nav: [],
        finished: false,
      };
    }
    case "slope": {
      const room = project.rooms.find((r) => r.id === target.roomId);
      const slope = room?.slopes?.find((s) => s.id === target.slopeId);
      const storey = room && project.storeys.find((s) => s.id === room.storeyId);
      if (!room || !slope || !storey) return null;
      const frame = slopeFrame(room, slope);
      const outline = slopeOutline(room, storey, slope);
      const views = (roomViewsOf(project).get(room.id) ?? []).filter((v) => !v.freeStanding);
      const labels: EdgeLabel[] = [];
      for (let i = 0; i < outline.length; i++) {
        const a = outline[i]!;
        const b = outline[(i + 1) % outline.length]!;
        if (distance(a, b) < 1) continue;
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const view = views.find((v) => {
          const pa = projectOnSegment(a, v.base[0], v.base[1]);
          const pb = projectOnSegment(b, v.base[0], v.base[1]);
          return (
            pa.distance < 1 &&
            pb.distance < 1 &&
            projectOnSegment(mid, v.base[0], v.base[1]).t >= 0 &&
            projectOnSegment(mid, v.base[0], v.base[1]).t <= 1
          );
        });
        const at = frame.toUV(mid);
        if (view)
          labels.push({ text: view.name, at, target: { kind: "room-wall", key: view.key } });
        else labels.push({ text: "Decke", at, target: { kind: "ceiling", roomId: room.id } });
      }
      const index = (room.slopes ?? []).indexOf(slope) + 1;
      return {
        kind: target.kind,
        ref: `slope:${room.id}:${slope.id}`,
        title: `${room.name} › Schräge ${index}`,
        storeyId: room.storeyId,
        contour: outline.map((p) => frame.toUV(p)),
        openings: [],
        labels,
        nav: [{ rel: "ceiling", label: "Decke", target: { kind: "ceiling", roomId: room.id } }],
        finished: false,
      };
    }
  }
}

/** Fangpunkte für das Messen: Ecken der Kontur und der Öffnungen (fertige Maße). */
export function snapPoints(model: SurfaceModel): UV[] {
  const pts = [...model.contour];
  for (const o of model.openings) {
    pts.push(
      { u: o.uFrom, v: o.vFrom },
      { u: o.uTo, v: o.vFrom },
      { u: o.uTo, v: o.vTo },
      { u: o.uFrom, v: o.vTo },
    );
  }
  return pts;
}
