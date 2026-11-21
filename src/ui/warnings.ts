import { OPENING_LABELS } from "../geometry/openings";
import { openingURange, wallSides } from "../geometry/surfaces";
import { sortedStoreys } from "../io/project-files";
import type { Device, Opening, Project } from "../model/types";
import type { ProjectWarning } from "../rules";
import { findRoomView, freeSurfacesOf, roomViewsOf } from "./derived";
import type { ProjectStore } from "../store/history";
import type { SurfaceTarget, ViewStore } from "../store/view";

/** Ansicht der Fläche eines Geräts: Wandseite → Raumansicht des Abschnitts, sonst ganze Wandseite. */
export function deviceSurfaceTarget(project: Project, device: Device): SurfaceTarget | null {
  const p = device.placement;
  if (p.kind !== "surface") return null;
  const [kind, id, extra] = p.surface.split(":");
  if (kind === "wall") {
    for (const views of roomViewsOf(project).values()) {
      const v = views.find(
        (x) => x.ref === p.surface && p.u >= x.section.uFrom && p.u <= x.section.uTo,
      );
      if (v) return { kind: "room-wall", key: v.key };
    }
    return { kind: "wall-side", ref: p.surface };
  }
  if (kind === "ceiling" || kind === "floor") return { kind, roomId: id! };
  return { kind: "slope", roomId: id!, slopeId: extra! };
}

/** Wandansicht des Raums an Seite L, in dessen Abschnitt die Mitte der Öffnung liegt; sonst die ganze Wandseite L. */
export function openingSurfaceTarget(project: Project, opening: Opening): SurfaceTarget | null {
  const ref = `wall:${opening.wallId}:L`;
  const side = wallSides(project, opening.storeyId).find((s) => s.ref === ref);
  if (!side) return null;
  const [u1, u2] = openingURange(side, opening);
  const mid = (u1 + u2) / 2;
  for (const views of roomViewsOf(project).values()) {
    const v = views.find((x) => x.ref === ref && mid >= x.section.uFrom && mid <= x.section.uTo);
    if (v) return { kind: "room-wall", key: v.key };
  }
  return { kind: "wall-side", ref };
}

/** Wählt das Ziel einer Warnung aus und öffnet die passende Ansicht (design.md Tabelle „Warnungen“). */
export function activateWarning(
  warning: ProjectWarning,
  store: ProjectStore,
  view: ViewStore,
): void {
  const { target } = warning;
  const project = store.getState().project;
  if (target.kind === "room") {
    const room = project.rooms.find((r) => r.id === target.id);
    if (room) view.setActiveStorey(room.storeyId);
    view.select({ kind: "room", id: target.id });
    view.setEditor("plan");
  } else if (target.kind === "device") {
    const device = project.devices.find((d) => d.id === target.id);
    view.select({ kind: "device", id: target.id });
    if (!device) return;
    view.setActiveStorey(device.storeyId);
    const surface = deviceSurfaceTarget(project, device);
    if (surface) view.openSurface(surface, device.storeyId);
    else view.setEditor("plan");
  } else if (target.kind === "opening") {
    const opening = project.openings.find((o) => o.id === target.id);
    view.select({ kind: "opening", id: target.id });
    if (!opening) return;
    view.setActiveStorey(opening.storeyId);
    const surface = openingSurfaceTarget(project, opening);
    if (surface) view.openSurface(surface, opening.storeyId);
  }
}

/** Element und Ort einer Warnung für die Übersicht. */
export interface WarningInfo {
  warning: ProjectWarning;
  element: string;
  /** „<Geschoss> › <Raum> › <Ansicht>“, fehlende Teile ausgelassen */
  location: string;
  storeyIndex: number;
  roomName: string;
}

interface Place {
  storeyId?: string;
  room?: string;
  view?: string;
}

function surfacePlace(project: Project, target: SurfaceTarget, storeyId: string): Place {
  switch (target.kind) {
    case "room-wall": {
      const v = findRoomView(project, target.key);
      const room = v && project.rooms.find((r) => r.id === v.roomId);
      return { storeyId, room: room?.name, view: v?.name };
    }
    case "wall-side":
      return {
        storeyId,
        view: freeSurfacesOf(project, storeyId).find((f) => f.ref === target.ref)?.name,
      };
    case "ceiling":
    case "floor":
      return {
        storeyId,
        room: project.rooms.find((r) => r.id === target.roomId)?.name,
        view: target.kind === "ceiling" ? "Decke" : "Boden",
      };
    case "slope": {
      const room = project.rooms.find((r) => r.id === target.roomId);
      const n = (room?.slopes ?? []).findIndex((s) => s.id === target.slopeId) + 1;
      return { storeyId, room: room?.name, view: n > 0 ? `Schräge ${n}` : undefined };
    }
  }
}

function describe(project: Project, w: ProjectWarning): { element: string; place: Place } {
  const t = w.target.kind !== "none" ? w.target : w.deletable;
  if (!t) return { element: "", place: {} };
  if (t.kind === "room") {
    const room = project.rooms.find((r) => r.id === t.id);
    return {
      element: room?.name ?? t.id,
      place: { storeyId: room?.storeyId, room: room?.name, view: "Grundriss" },
    };
  }
  if (t.kind === "opening") {
    const o = project.openings.find((x) => x.id === t.id);
    if (!o) return { element: "Öffnung", place: {} };
    const element = `${OPENING_LABELS[o.kind]} ${o.widthMm} × ${o.heightMm}`;
    const surface = w.target.kind === "none" ? null : openingSurfaceTarget(project, o);
    return {
      element,
      place: surface ? surfacePlace(project, surface, o.storeyId) : { storeyId: o.storeyId },
    };
  }
  if (t.kind === "device") {
    const d = project.devices.find((x) => x.id === t.id);
    if (!d) return { element: "Gerät", place: {} };
    const surface = w.target.kind === "none" ? null : deviceSurfaceTarget(project, d);
    return {
      element: d.label,
      place: surface
        ? surfacePlace(project, surface, d.storeyId)
        : { storeyId: d.storeyId, view: "Grundriss" },
    };
  }
  const f = project.furniture.find((x) => x.id === t.id);
  return {
    element: f
      ? (project.catalog.furnitureTypes.find((x) => x.id === f.typeId)?.name ?? f.typeId)
      : "Möbel",
    place: { storeyId: f?.storeyId, view: "Grundriss" },
  };
}

/** Warnungen mit Element und Ort, sortiert nach Geschoss, Raum und Text (design.md M2 „Übersicht“). */
export function warningInfos(project: Project, warnings: readonly ProjectWarning[]): WarningInfo[] {
  const storeys = sortedStoreys(project);
  return warnings
    .map((warning) => {
      const { element, place } = describe(project, warning);
      const index = storeys.findIndex((s) => s.id === place.storeyId);
      const storeyName = index >= 0 ? storeys[index]!.name : undefined;
      return {
        warning,
        element,
        location: [storeyName, place.room, place.view].filter(Boolean).join(" › "),
        storeyIndex: index >= 0 ? index : storeys.length,
        roomName: place.room ?? "",
      };
    })
    .sort(
      (a, b) =>
        a.storeyIndex - b.storeyIndex ||
        a.roomName.localeCompare(b.roomName, "de") ||
        a.warning.text.localeCompare(b.warning.text, "de"),
    );
}
