/** Kollision von Wandgeräten mit Möbeln (design.md M2 „Möbel“, Regel `device-covered`). Frei von React. */
import { frontRect, sectionAt } from "../geometry/devices";
import { silhouetteOn } from "../geometry/furniture";
import { sections, wallSides } from "../geometry/surfaces";
import { surfaceKind } from "../model/devices";
import type { Project } from "../model/types";
import type { ProjectWarning } from "./index";

/** `device-covered:<deviceId>`: Frontrechteck eines Wandgeräts überlappt die Silhouette eines Möbels. */
export function deviceCoveredWarnings(project: Project): ProjectWarning[] {
  const warnings: ProjectWarning[] = [];
  for (const storey of project.storeys) {
    const furniture = project.furniture.filter((f) => f.storeyId === storey.id);
    if (furniture.length === 0) continue;
    const devices = project.devices.filter(
      (d) =>
        d.storeyId === storey.id &&
        d.placement.kind === "surface" &&
        surfaceKind(d.placement.surface) === "wall",
    );
    if (devices.length === 0) continue;
    const sides = wallSides(project, storey.id);
    const secs = sections(project, storey.id, sides);
    for (const device of devices) {
      const p = device.placement;
      if (p.kind !== "surface") continue;
      const side = sides.find((s) => s.ref === p.surface);
      const type = project.catalog.deviceTypes.find((t) => t.id === device.typeId);
      const rect = frontRect(device, type);
      if (!side || !rect) continue;
      const sec = sectionAt(secs, side.ref, p.u);
      const room = sec && project.rooms.find((r) => r.id === sec.roomId);
      const plaster = room ? (room.plasterMm ?? storey.defaults.plasterMm) : 0;
      const buildup = room ? (room.floorBuildupMm ?? storey.defaults.floorBuildupMm) : 0;
      const range: [number, number] = sec ? [sec.uFrom, sec.uTo] : [side.uMin, side.uMax];
      for (const f of furniture) {
        const s = silhouetteOn(project, side, plaster, buildup, range, f);
        if (!s) continue;
        const overlap =
          Math.min(rect.uMax, s.uTo) > Math.max(rect.uMin, s.uFrom) &&
          Math.min(rect.vMax, s.vTo) > Math.max(rect.vMin, s.vFrom);
        if (!overlap) continue;
        const typeName =
          project.catalog.furnitureTypes.find((t) => t.id === f.typeId)?.name ?? f.typeId;
        warnings.push({
          key: `device-covered:${device.id}`,
          text: `Gerät durch Möbel verdeckt: ${device.label} (${typeName})`,
          target: { kind: "device", id: device.id },
        });
        break;
      }
    }
  }
  return warnings;
}
