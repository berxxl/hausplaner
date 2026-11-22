/** Deutsche Bezeichnungen für Katalogwerte. */
import type { Trade } from "../model/types";

export const TRADE_LABELS: Record<Trade, string> = {
  power: "Strom",
  knx: "KNX",
  data: "Daten",
  conduit: "Leerrohr",
  refrigerant: "Kältemittel",
  condensate: "Kondensat",
  other: "Sonstiges",
};

export const KNX_FUNCTION_LABELS = {
  switch: "Schalten",
  dim: "Dimmen",
  blind: "Jalousie",
  heating: "Heizung",
  "binary-input": "Binäreingang",
} as const;

export const LIGHT_KIND_LABELS = { spot: "Spot", point: "Punkt", area: "Fläche" } as const;

/** Farben der Gerätestatus (design.md M2 „Darstellung“). */
export const STATUS_COLORS = {
  planned: "#8e8e93",
  installed: "#0071e3",
  verified: "#2e7d32",
} as const;

export const STATUS_LABELS = {
  planned: "geplant",
  installed: "verlegt",
  verified: "geprüft",
} as const;

/** Arten von Durchbrüchen (design.md M3 „Durchbrüche“). */
export const PENETRATION_LABELS = {
  drill: "Bohrung",
  "core-drill": "Kernbohrung",
  slot: "Schlitz",
  conduit: "Leerrohr",
} as const;

export const WARNING_COLOR = "#d70015";

/**
 * „2 Geräte und 1 Leitung werden mitgelöscht.“ (design.md M2/M3/M4 „Löschen“); null, wenn nichts.
 * `extra`: Verteiler und Stromkreise (M4).
 */
export function cascadeMessage(
  devices: number,
  cables: number,
  extra: { boards?: number; circuits?: number } = {},
): string | null {
  const counts: [number, string, string][] = [
    [extra.boards ?? 0, "Verteiler", "Verteiler"],
    [devices, "Gerät", "Geräte"],
    [extra.circuits ?? 0, "Stromkreis", "Stromkreise"],
    [cables, "Leitung", "Leitungen"],
  ];
  const parts = counts
    .filter(([n]) => n > 0)
    .map(([n, one, many]) => `${n} ${n === 1 ? one : many}`);
  if (parts.length === 0) return null;
  const total = counts.reduce((s, [n]) => s + n, 0);
  const text =
    parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(", ")} und ${parts.at(-1)!}`;
  return `${text} ${total === 1 ? "wird" : "werden"} mitgelöscht.`;
}
