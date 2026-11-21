/** Befehle für Geräte (design.md M2 „Geräte platzieren“, „Gerätekombinationen“). Frei von React. */
import { surfaceStoreyId } from "../geometry/devices";
import type { Device, DevicePlacement, Project } from "../model/types";
import type { Checked } from "./catalog";
import type { Command } from "./history";

export const COMBINATION_SPACING_MM = 71;

/** Geschoss einer Platzierung: das der Fläche, frei: das angegebene. */
export function placementStorey(
  project: Project,
  placement: DevicePlacement,
  fallbackStoreyId: string,
): string {
  return placement.kind === "free"
    ? fallbackStoreyId
    : (surfaceStoreyId(project, placement.surface) ?? fallbackStoreyId);
}

export function addDevice(device: Device): Command {
  return {
    label: "Gerät setzen",
    run(draft) {
      draft.devices.push(device);
    },
  };
}

export type DeviceEdit = Partial<Pick<Device, "label" | "typeId" | "status" | "placement">>;

export function editDevice(id: string, edit: DeviceEdit, label = "Gerät ändern"): Command {
  return {
    label,
    run(draft) {
      const d = draft.devices.find((x) => x.id === id);
      if (d) Object.assign(d, structuredClone(edit));
    },
  };
}

export function moveDevice(id: string, placement: DevicePlacement): Command {
  return editDevice(id, { placement }, "Gerät verschieben");
}

export function deleteDevices(ids: readonly string[]): Command {
  const set = new Set(ids);
  return {
    label: "Gerät löschen",
    run(draft) {
      draft.devices = draft.devices.filter((d) => !set.has(d.id));
    },
  };
}

/**
 * Ordnet Geräte einer Fläche waagerecht (Reihenfolge nach u, alle auf v des ersten) oder senkrecht
 * (Reihenfolge nach v absteigend, alle auf u des obersten) im gegebenen Achsabstand an.
 */
export function combineDevices(
  project: Project,
  ids: readonly string[],
  direction: "horizontal" | "vertical",
  spacingMm = COMBINATION_SPACING_MM,
): Checked {
  const devices = ids
    .map((id) => project.devices.find((d) => d.id === id))
    .filter((d): d is Device => !!d);
  if (devices.length < 2) return { ok: false, error: "Mindestens zwei Geräte auswählen" };
  const surfaces = new Set(
    devices.map((d) => (d.placement.kind === "surface" ? d.placement.surface : null)),
  );
  if (surfaces.size !== 1 || surfaces.has(null))
    return { ok: false, error: "Kombinieren nur auf einer Fläche" };
  const uv = (d: Device) => d.placement as Extract<DevicePlacement, { kind: "surface" }>;
  const ordered = [...devices].sort((a, b) =>
    direction === "horizontal" ? uv(a).u - uv(b).u : uv(b).v - uv(a).v,
  );
  const first = uv(ordered[0]!);
  const targets = ordered.map((d, i) => ({
    id: d.id,
    u: direction === "horizontal" ? first.u + i * spacingMm : first.u,
    v: direction === "horizontal" ? first.v : first.v - i * spacingMm,
  }));
  return {
    ok: true,
    command: {
      label: "Geräte kombinieren",
      run(draft) {
        for (const t of targets) {
          const d = draft.devices.find((x) => x.id === t.id);
          if (d?.placement.kind === "surface") {
            d.placement.u = t.u;
            d.placement.v = t.v;
          }
        }
      },
    },
  };
}
