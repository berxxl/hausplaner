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
