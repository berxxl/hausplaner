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

export const WARNING_COLOR = "#d70015";
