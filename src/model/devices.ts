/** Hilfen rund um Geräteplatzierungen (design.md M2 „Katalog“, „Geräte platzieren“). Frei von React. */
import type { Device, DeviceType, Mounting } from "./types";

export type SurfaceKind = "wall" | "ceiling" | "floor" | "slope";

/** Art der Fläche einer SurfaceRef ("wall:<id>:L" → "wall"). */
export function surfaceKind(surface: string): SurfaceKind {
  return surface.slice(0, surface.indexOf(":")) as SurfaceKind;
}

/** Montageart, die eine Flächenart verlangt: Schrägen zählen als Decke. */
export function mountingForSurface(kind: SurfaceKind): Mounting {
  return kind === "slope" ? "ceiling" : kind;
}

/** Montageart, auf der ein Gerät sitzt. */
export function deviceMounting(device: Device): Mounting {
  if (device.placement.kind === "board") return "din-rail";
  return device.placement.kind === "free"
    ? "free"
    : mountingForSurface(surfaceKind(device.placement.surface));
}

/**
 * Rolle eines Klimageräts (design.md M6 „Dateiformat M5“): `refrigerant.unit`, ohne Feld
 * Innengerät, wenn der Typ Kondensat anschließt, sonst Außengerät; null ohne Kältemittelangaben.
 */
export function refrigerantUnit(type: DeviceType | undefined): "indoor" | "outdoor" | null {
  if (!type?.refrigerant) return null;
  return type.refrigerant.unit ?? (type.connects.includes("condensate") ? "indoor" : "outdoor");
}

/** In M2 platzierbare Montagearten (din-rail erst ab M4). */
export const PLACEABLE_MOUNTINGS: readonly Mounting[] = ["wall", "ceiling", "floor", "free"];

/** Typen, die in M2 platziert werden können (mindestens eine Montageart außer Hutschiene). */
export function placeableTypes(types: DeviceType[]): DeviceType[] {
  return types.filter((t) => t.mounting.some((m) => PLACEABLE_MOUNTINGS.includes(m)));
}
