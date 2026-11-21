/**
 * Befehle für Wände, Räume, Öffnungen und Schrägen. Raumkonturen werden im selben Befehl neu berechnet
 * (design.md „Store mit Befehlen und Patches“). Frei von React.
 */
import type { Draft } from "immer";
import { roomStatuses } from "../geometry/rooms";
import type { WallEditResult } from "../geometry/wall-edit";
import type { WallGeom } from "../geometry/walls";
import type { Opening, Project, Room, Slope, Wall } from "../model/types";
import type { Command } from "./history";

const plainPt = (p: { x: number; y: number }) => ({ x: p.x, y: p.y });

/**
 * Liegt das Gerät auf einer Fläche der Wand (beide Seiten) bzw. des Raums (Decke, Boden, Schrägen)?
 * Grundlage für das Mitlöschen (design.md M2 „Geräte platzieren“).
 */
export function onSurfaceOf(
  device: { placement: Project["devices"][number]["placement"] },
  owner: "wall" | "room",
  id: string,
): boolean {
  if (device.placement.kind !== "surface") return false;
  const [kind, ownerId] = device.placement.surface.split(":");
  return ownerId === id && (owner === "wall" ? kind === "wall" : kind !== "wall");
}

/** Anzahl der Geräte, die mit der Wand bzw. dem Raum gelöscht würden. */
export function dependentDeviceCount(project: Project, owner: "wall" | "room", id: string) {
  return project.devices.filter((d) => onSurfaceOf(d, owner, id)).length;
}

export function wallGeoms(project: Project | Draft<Project>, storeyId: string): WallGeom[] {
  return project.walls
    .filter((w) => w.storeyId === storeyId)
    .map((w) => ({
      id: w.id,
      start: plainPt(w.start),
      end: plainPt(w.end),
      thicknessMm: w.thicknessMm,
    }));
}

const samePolygon = (
  a: readonly { x: number; y: number }[],
  b: readonly { x: number; y: number }[],
) => a.length === b.length && a.every((p, i) => p.x === b[i]!.x && p.y === b[i]!.y);

/** Neue Konturen für alle geschlossenen Räume des Geschosses; offene und verschmolzene behalten ihre Kontur. */
export function recomputeRooms(draft: Draft<Project>, storeyId: string): void {
  const rooms = draft.rooms.filter((r) => r.storeyId === storeyId);
  if (rooms.length === 0) return;
  const statuses = roomStatuses(
    wallGeoms(draft, storeyId),
    rooms.map((r) => ({ id: r.id, seed: plainPt(r.seed), polygon: [] })),
  );
  for (const room of rooms) {
    const s = statuses.get(room.id);
    if (s?.status === "ok" && !samePolygon(room.polygon, s.polygon)) room.polygon = s.polygon;
  }
}

/** Endpunkt einer vorhandenen Wand, der beim Zeichnen auf eine gemeinsame Ecke gelegt wird. */
export interface WallJoin {
  id: string;
  end: "start" | "end";
  point: { x: number; y: number };
}

/** Neue Wand; `joins` legt im selben Befehl Enden der Nachbarwände im Zug auf die gemeinsame Ecke. */
export function addWall(wall: Wall, joins: WallJoin[] = []): Command {
  return {
    label: "Wand zeichnen",
    run(draft) {
      for (const j of joins) {
        const w = draft.walls.find((x) => x.id === j.id);
        if (w) w[j.end] = plainPt(j.point);
      }
      draft.walls.push(wall);
      recomputeRooms(draft, wall.storeyId);
    },
  };
}

/** Übernimmt das Ergebnis einer Wandbearbeitung (Endpunkt, Länge, parallel verschieben). */
export function applyWallEdit(storeyId: string, result: WallEditResult, label: string): Command {
  return {
    label,
    run(draft) {
      for (const [id, axis] of result.changes) {
        const w = draft.walls.find((x) => x.id === id);
        if (!w) continue;
        if (w.start.x !== axis.start.x || w.start.y !== axis.start.y) w.start = axis.start;
        if (w.end.x !== axis.end.x || w.end.y !== axis.end.y) w.end = axis.end;
      }
      recomputeRooms(draft, storeyId);
    },
  };
}

export type WallPropEdit =
  | { field: "thicknessMm"; value: number }
  | { field: "kind"; value: Wall["kind"] }
  | { field: "rawHeightMm"; value: number | undefined }
  | { field: "outsideSide"; value: "L" | "R" | undefined };

const WALL_LABELS: Record<WallPropEdit["field"], string> = {
  thicknessMm: "Wanddicke ändern",
  kind: "Wandart ändern",
  rawHeightMm: "Wandhöhe ändern",
  outsideSide: "Außenseite umschalten",
};

export function editWall(id: string, edit: WallPropEdit): Command {
  return {
    label: WALL_LABELS[edit.field],
    run(draft) {
      const w = draft.walls.find((x) => x.id === id);
      if (!w) return;
      if (edit.field === "thicknessMm") w.thicknessMm = edit.value;
      else if (edit.field === "kind") w.kind = edit.value;
      else if (edit.value === undefined) delete w[edit.field];
      else if (edit.field === "rawHeightMm") w.rawHeightMm = edit.value;
      else w.outsideSide = edit.value;
      if (edit.field === "thicknessMm") recomputeRooms(draft, w.storeyId);
    },
  };
}

/** Löscht eine Wand mit ihren Öffnungen in einem Schritt. */
export function deleteWall(id: string): Command {
  return {
    label: "Wand löschen",
    run(draft) {
      const w = draft.walls.find((x) => x.id === id);
      if (!w) return;
      draft.walls = draft.walls.filter((x) => x.id !== id);
      draft.openings = draft.openings.filter((o) => o.wallId !== id);
      draft.devices = draft.devices.filter((d) => !onSurfaceOf(d, "wall", id));
      recomputeRooms(draft, w.storeyId);
    },
  };
}

export function addRoom(room: Room): Command {
  return {
    label: "Raum anlegen",
    run(draft) {
      draft.rooms.push(room);
    },
  };
}

/** Neuer Saatpunkt und Kontur; ID, Name, Werte und Schrägen bleiben. */
export function redetectRoom(
  id: string,
  seed: { x: number; y: number },
  polygon: { x: number; y: number }[],
): Command {
  return {
    label: "Raum neu erkennen",
    run(draft) {
      const r = draft.rooms.find((x) => x.id === id);
      if (!r) return;
      r.seed = seed;
      r.polygon = polygon;
    },
  };
}

export type RoomEdit =
  | { field: "name"; value: string }
  | { field: "floorBuildupMm" | "plasterMm" | "suspendedMm"; value: number | undefined };

const ROOM_LABELS: Record<RoomEdit["field"], string> = {
  name: "Raum umbenennen",
  floorBuildupMm: "Fußbodenaufbau ändern",
  plasterMm: "Putzstärke ändern",
  suspendedMm: "Abhängung ändern",
};

/** Ändert einen Raumwert; `undefined` = Standardwert des Geschosses. */
export function editRoom(id: string, edit: RoomEdit): Command {
  return {
    label: ROOM_LABELS[edit.field],
    run(draft) {
      const r = draft.rooms.find((x) => x.id === id);
      if (!r) return;
      if (edit.field === "name") r.name = edit.value;
      else if (edit.value === undefined) delete r[edit.field];
      else r[edit.field] = edit.value;
    },
  };
}

/** Löscht einen Raum mit seinen Schrägen; die Wände bleiben. */
export function deleteRoom(id: string): Command {
  return {
    label: "Raum löschen",
    run(draft) {
      draft.rooms = draft.rooms.filter((r) => r.id !== id);
      draft.devices = draft.devices.filter((d) => !onSurfaceOf(d, "room", id));
    },
  };
}

export function addOpening(opening: Opening): Command {
  return {
    label: "Öffnung setzen",
    run(draft) {
      draft.openings.push(opening);
    },
  };
}

export type OpeningEdit =
  | { field: "offsetMm" | "widthMm" | "heightMm" | "sillMm"; value: number }
  | { field: "kind"; value: Opening["kind"] }
  | { field: "shutterBox"; value: Opening["shutterBox"] };

const OPENING_LABELS: Record<OpeningEdit["field"], string> = {
  offsetMm: "Öffnung verschieben",
  widthMm: "Öffnungsbreite ändern",
  heightMm: "Öffnungshöhe ändern",
  sillMm: "Brüstung ändern",
  kind: "Öffnungsart ändern",
  shutterBox: "Rollladenkasten ändern",
};

export function editOpening(id: string, edit: OpeningEdit): Command {
  return {
    label: OPENING_LABELS[edit.field],
    run(draft) {
      const o = draft.openings.find((x) => x.id === id);
      if (!o) return;
      if (edit.field === "kind") o.kind = edit.value;
      else if (edit.field === "shutterBox") {
        if (edit.value) o.shutterBox = edit.value;
        else delete o.shutterBox;
      } else o[edit.field] = edit.value;
    },
  };
}

export function addSlope(roomId: string, slope: Slope): Command {
  return {
    label: "Schräge anlegen",
    run(draft) {
      const r = draft.rooms.find((x) => x.id === roomId);
      if (!r) return;
      (r.slopes ??= []).push(slope);
    },
  };
}

export type SlopeEdit = { field: "heightAtBaseMm" | "angleDeg"; value: number };

export function editSlope(roomId: string, slopeId: string, edit: SlopeEdit): Command {
  return {
    label: edit.field === "angleDeg" ? "Neigung ändern" : "Höhe der Schräge ändern",
    run(draft) {
      const s = draft.rooms.find((x) => x.id === roomId)?.slopes?.find((x) => x.id === slopeId);
      if (s) s[edit.field] = edit.value;
    },
  };
}

export function deleteSlope(roomId: string, slopeId: string): Command {
  return {
    label: "Schräge löschen",
    run(draft) {
      const r = draft.rooms.find((x) => x.id === roomId);
      if (!r?.slopes) return;
      r.slopes = r.slopes.filter((s) => s.id !== slopeId);
      if (r.slopes.length === 0) delete r.slopes;
      const ref = `slope:${roomId}:${slopeId}`;
      draft.devices = draft.devices.filter(
        (d) => !(d.placement.kind === "surface" && d.placement.surface === ref),
      );
    },
  };
}
