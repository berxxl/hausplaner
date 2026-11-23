/**
 * Standardkatalog für neue und migrierte Projekte (design.md M2 „Standardkatalog“).
 * Feste, lesbare IDs; Symbole im Raster viewBox 0 0 100 100 in Anlehnung an DIN EN 60617,
 * Attribute in einfachen Anführungszeichen, damit sie in YAML ohne Escapes lesbar bleiben.
 * Frei von React.
 */
import type { Catalog, DeviceType, FurnitureType, LineType } from "./types";

const S = "stroke='currentColor' stroke-width='5' fill='none'";
const T = "fill='currentColor' text-anchor='middle' font-family='sans-serif'";

/** Rechteck mit Kurztext, für Geräte ohne eigenes Normsymbol. */
const labelBox = (label: string, size = 30) =>
  `<rect x='10' y='25' width='80' height='50' ${S}/><text x='50' y='${50 + size * 0.35}' font-size='${size}' ${T}>${label}</text>`;
const labelCircle = (label: string, size = 34) =>
  `<circle cx='50' cy='50' r='35' ${S}/><text x='50' y='${50 + size * 0.35}' font-size='${size}' ${T}>${label}</text>`;

const SYMBOLS = {
  socket: `<path d='M20 70 A30 30 0 0 1 80 70' ${S}/><line x1='15' y1='70' x2='85' y2='70' ${S}/><line x1='50' y1='40' x2='50' y2='15' ${S}/>`,
  socketDouble: `<path d='M20 70 A30 30 0 0 1 80 70' ${S}/><line x1='15' y1='70' x2='85' y2='70' ${S}/><line x1='38' y1='42' x2='38' y2='15' ${S}/><line x1='62' y1='42' x2='62' y2='15' ${S}/>`,
  switch: `<circle cx='38' cy='62' r='15' ${S}/><line x1='49' y1='51' x2='80' y2='20' ${S}/><line x1='80' y1='20' x2='90' y2='30' ${S}/>`,
  outletCeiling: `<circle cx='50' cy='50' r='30' ${S}/><line x1='29' y1='29' x2='71' y2='71' ${S}/><line x1='71' y1='29' x2='29' y2='71' ${S}/>`,
  outletWall: `<circle cx='50' cy='40' r='25' ${S}/><line x1='32' y1='22' x2='68' y2='58' ${S}/><line x1='68' y1='22' x2='32' y2='58' ${S}/><line x1='50' y1='65' x2='50' y2='90' ${S}/>`,
  spot: `<circle cx='50' cy='50' r='28' ${S}/><circle cx='50' cy='50' r='9' fill='currentColor'/>`,
};

type TypeInput = Omit<DeviceType, "connects"> & { connects?: DeviceType["connects"] };
const device = (t: TypeInput): DeviceType => ({ ...t, connects: t.connects ?? [] });

const flushBox = { boxDepthMm: 60 };
const plate = { kind: "box", widthMm: 80, heightMm: 80, depthMm: 10 } as const;
const rail = (te: number) =>
  ({ kind: "box", widthMm: Math.round(te * 17.5), heightMm: 90, depthMm: 70 }) as const;

export const DEFAULT_DEVICE_TYPES: DeviceType[] = [
  device({
    id: "socket",
    name: "Steckdose",
    trade: "power",
    symbol: SYMBOLS.socket,
    shape3d: plate,
    mounting: ["wall", "floor"],
    defaultHeightMm: 300,
    flush: flushBox,
    connects: ["power"],
  }),
  device({
    id: "socket-double",
    name: "Doppelsteckdose",
    trade: "power",
    symbol: SYMBOLS.socketDouble,
    shape3d: { kind: "box", widthMm: 151, heightMm: 80, depthMm: 10 },
    mounting: ["wall", "floor"],
    defaultHeightMm: 300,
    flush: flushBox,
    connects: ["power"],
  }),
  device({
    id: "switch",
    name: "Schalter",
    trade: "power",
    symbol: SYMBOLS.switch,
    shape3d: plate,
    mounting: ["wall"],
    defaultHeightMm: 1050,
    flush: flushBox,
    connects: ["power"],
  }),
  device({
    id: "knx-push-button",
    name: "KNX-Taster",
    trade: "knx",
    symbol: labelBox("KNX", 24),
    shape3d: { kind: "box", widthMm: 80, heightMm: 80, depthMm: 12 },
    mounting: ["wall"],
    defaultHeightMm: 1050,
    flush: flushBox,
    connects: ["knx"],
  }),
  device({
    id: "presence-knx",
    name: "Präsenzmelder KNX",
    trade: "knx",
    symbol: labelCircle("P"),
    shape3d: { kind: "cylinder", widthMm: 100, heightMm: 100, depthMm: 50 },
    mounting: ["ceiling"],
    connects: ["knx"],
  }),
  device({
    id: "ceiling-outlet",
    name: "Deckenauslass",
    trade: "power",
    symbol: SYMBOLS.outletCeiling,
    shape3d: { kind: "cylinder", widthMm: 80, heightMm: 80, depthMm: 20 },
    mounting: ["ceiling"],
    connects: ["power"],
    knx: { consumes: "switch" },
    light: { kind: "point", lumen: 1000, colorTempK: 3000 },
  }),
  device({
    id: "wall-outlet",
    name: "Wandauslass",
    trade: "power",
    symbol: SYMBOLS.outletWall,
    shape3d: { kind: "cylinder", widthMm: 80, heightMm: 80, depthMm: 20 },
    mounting: ["wall"],
    defaultHeightMm: 2000,
    flush: flushBox,
    connects: ["power"],
    knx: { consumes: "switch" },
    light: { kind: "point", lumen: 600, colorTempK: 3000 },
  }),
  device({
    id: "spot",
    name: "Spot",
    trade: "power",
    symbol: SYMBOLS.spot,
    shape3d: { kind: "cylinder", widthMm: 90, heightMm: 90, depthMm: 10 },
    mounting: ["ceiling"],
    connects: ["power"],
    knx: { consumes: "dim" },
    light: { kind: "spot", lumen: 450, beamAngleDeg: 36, colorTempK: 3000 },
  }),
  device({
    id: "shutter-motor",
    name: "Rollladenmotor",
    trade: "power",
    symbol: labelCircle("M"),
    shape3d: { kind: "box", widthMm: 500, heightMm: 60, depthMm: 60 },
    mounting: ["wall"],
    connects: ["power"],
    knx: { consumes: "blind" },
  }),
  device({
    id: "network-socket",
    name: "Netzwerkdose",
    trade: "data",
    symbol: labelBox("RJ45", 22),
    shape3d: plate,
    mounting: ["wall", "floor"],
    defaultHeightMm: 300,
    flush: flushBox,
    connects: ["data"],
  }),
  device({
    id: "wlan-ap",
    name: "WLAN-Accesspoint",
    trade: "data",
    symbol: labelCircle("AP", 28),
    shape3d: { kind: "cylinder", widthMm: 160, heightMm: 160, depthMm: 35 },
    mounting: ["ceiling", "wall"],
    defaultHeightMm: 2200,
    connects: ["data"],
  }),
  device({
    id: "router",
    name: "Router",
    trade: "data",
    symbol: labelBox("R", 34),
    shape3d: { kind: "box", widthMm: 250, heightMm: 180, depthMm: 50 },
    mounting: ["wall", "free"],
    defaultHeightMm: 1500,
    connects: ["data", "power"],
  }),
  device({
    id: "mcb",
    name: "LS-Schalter",
    trade: "power",
    symbol: labelBox("LS"),
    shape3d: rail(1),
    mounting: ["din-rail"],
    teWidth: 1,
    connects: ["power"],
  }),
  device({
    id: "rcbo",
    name: "FI/LS",
    trade: "power",
    symbol: labelBox("FI/LS", 22),
    shape3d: rail(2),
    mounting: ["din-rail"],
    teWidth: 2,
    connects: ["power"],
  }),
  device({
    id: "rcd",
    name: "RCD",
    trade: "power",
    symbol: labelBox("RCD", 26),
    shape3d: rail(4),
    mounting: ["din-rail"],
    teWidth: 4,
    connects: ["power"],
  }),
  device({
    id: "spd",
    name: "SPD (Überspannungsschutz)",
    trade: "power",
    symbol: labelBox("SPD", 26),
    shape3d: rail(4),
    mounting: ["din-rail"],
    teWidth: 4,
    connects: ["power"],
  }),
  device({
    id: "knx-power-supply",
    name: "KNX-Netzteil",
    trade: "knx",
    symbol: labelBox("NT"),
    shape3d: rail(4),
    mounting: ["din-rail"],
    teWidth: 4,
    connects: ["power", "knx"],
  }),
  device({
    id: "knx-switch-actuator",
    name: "Schaltaktor",
    trade: "knx",
    symbol: labelBox("SA"),
    shape3d: rail(4),
    mounting: ["din-rail"],
    teWidth: 4,
    connects: ["power", "knx"],
    knx: { provides: { function: "switch", channels: 8 } },
  }),
  device({
    id: "knx-dim-actuator",
    name: "Dimmaktor",
    trade: "knx",
    symbol: labelBox("DA"),
    shape3d: rail(4),
    mounting: ["din-rail"],
    teWidth: 4,
    connects: ["power", "knx"],
    knx: { provides: { function: "dim", channels: 4 } },
  }),
  device({
    id: "knx-blind-actuator",
    name: "Jalousieaktor",
    trade: "knx",
    symbol: labelBox("JA"),
    shape3d: rail(4),
    mounting: ["din-rail"],
    teWidth: 4,
    connects: ["power", "knx"],
    knx: { provides: { function: "blind", channels: 4 } },
  }),
  device({
    id: "knx-heating-actuator",
    name: "Heizungsaktor",
    trade: "knx",
    symbol: labelBox("HA"),
    shape3d: rail(4),
    mounting: ["din-rail"],
    teWidth: 4,
    connects: ["power", "knx"],
    knx: { provides: { function: "heating", channels: 6 } },
  }),
  // M4 (design.md M4 „Katalog“); die Migration 3 → 4 ergänzt sie in bestehenden Projekten
  device({
    id: "knx-switch-actuator-16",
    name: "Schaltaktor 16-fach",
    trade: "knx",
    symbol: labelBox("SA16", 24),
    shape3d: rail(8),
    mounting: ["din-rail"],
    teWidth: 8,
    connects: ["power", "knx"],
    knx: { provides: { function: "switch", channels: 16 } },
  }),
  device({
    id: "patch-panel",
    name: "Patchfeld 6-fach",
    trade: "data",
    symbol: labelBox("PF"),
    shape3d: rail(6),
    mounting: ["din-rail"],
    teWidth: 6,
    connects: ["data"],
  }),
  device({
    id: "network-switch",
    name: "Switch 8 Port",
    trade: "data",
    symbol: labelBox("SW"),
    shape3d: rail(6),
    mounting: ["din-rail"],
    teWidth: 6,
    connects: ["data", "power"],
  }),
  device({
    id: "power-supply",
    name: "Netzteil",
    trade: "power",
    symbol: labelBox("24V", 24),
    shape3d: rail(2),
    mounting: ["din-rail"],
    teWidth: 2,
    connects: ["power"],
  }),
  device({
    id: "ac-indoor",
    name: "Klima-Innengerät",
    trade: "refrigerant",
    symbol: labelBox("AC"),
    shape3d: { kind: "box", widthMm: 800, heightMm: 290, depthMm: 200 },
    mounting: ["wall"],
    defaultHeightMm: 2100,
    connects: ["power", "refrigerant", "condensate"],
    refrigerant: { unit: "indoor", minLengthM: 3, maxLengthM: 25, prechargedLengthM: 7 },
  }),
  device({
    id: "ac-outdoor",
    name: "Klima-Außengerät",
    trade: "refrigerant",
    symbol: `<rect x='10' y='20' width='80' height='60' ${S}/><circle cx='50' cy='50' r='20' ${S}/>`,
    shape3d: { kind: "box", widthMm: 800, heightMm: 550, depthMm: 290 },
    mounting: ["free", "wall"],
    connects: ["power", "refrigerant"],
    refrigerant: { unit: "outdoor", minLengthM: 3, maxLengthM: 25, prechargedLengthM: 7 },
  }),
  // M6: Grenzen je Kältemittelverbindung (design.md M6 „Katalog“)
  device({
    id: "ac-outdoor-multi-3",
    name: "Klima-Außengerät Multisplit 3",
    trade: "refrigerant",
    symbol: `<rect x='10' y='20' width='80' height='60' ${S}/><circle cx='50' cy='50' r='20' ${S}/><text x='50' y='96' font-size='22' ${T}>3</text>`,
    shape3d: { kind: "box", widthMm: 900, heightMm: 700, depthMm: 320 },
    mounting: ["free", "wall"],
    connects: ["power", "refrigerant"],
    refrigerant: { unit: "outdoor", minLengthM: 3, maxLengthM: 25, prechargedLengthM: 7 },
  }),
  device({
    id: "condensate-drain",
    name: "Kondensatablauf",
    trade: "condensate",
    symbol: labelCircle("KA", 30),
    shape3d: { kind: "cylinder", widthMm: 50, heightMm: 50, depthMm: 40 },
    mounting: ["wall", "floor", "free"],
    defaultHeightMm: 300,
    connects: ["condensate"],
  }),
];

export const DEFAULT_LINE_TYPES: LineType[] = [
  { id: "nym-j-3x1-5", name: "NYM-J 3×1,5", trade: "power", outerDiameterMm: 8, color: "#757575" },
  {
    id: "nym-j-5x1-5",
    name: "NYM-J 5×1,5",
    trade: "power",
    outerDiameterMm: 9.5,
    color: "#616161",
  },
  { id: "nym-j-3x2-5", name: "NYM-J 3×2,5", trade: "power", outerDiameterMm: 9, color: "#c62828" },
  { id: "nym-j-5x2-5", name: "NYM-J 5×2,5", trade: "power", outerDiameterMm: 11, color: "#8e0000" },
  { id: "nym-j-5x10", name: "NYM-J 5×10", trade: "power", outerDiameterMm: 17, color: "#4e342e" },
  {
    id: "knx-bus",
    name: "KNX J-Y(St)Y 2×2×0,8",
    trade: "knx",
    outerDiameterMm: 5,
    color: "#2e7d32",
  },
  { id: "cat-7", name: "Cat 7", trade: "data", outerDiameterMm: 7.5, color: "#1565c0" },
  {
    id: "conduit-m20",
    name: "Leerrohr M20",
    trade: "conduit",
    outerDiameterMm: 20,
    color: "#9e9e9e",
  },
  {
    id: "conduit-m25",
    name: "Leerrohr M25",
    trade: "conduit",
    outerDiameterMm: 25,
    color: "#8d8d8d",
  },
  {
    id: "refrigerant-pair",
    name: 'Kältemittelleitungspaar 1/4" + 3/8"',
    trade: "refrigerant",
    outerDiameterMm: 30,
    color: "#4fc3f7",
  },
  {
    id: "condensate",
    name: "Kondensatleitung",
    trade: "condensate",
    outerDiameterMm: 16,
    color: "#80cbc4",
  },
];

export const DEFAULT_FURNITURE_TYPES: FurnitureType[] = [
  {
    id: "bed-160",
    name: "Bett 160 × 200",
    widthMm: 1600,
    depthMm: 2000,
    heightMm: 450,
    elevationMm: 0,
  },
  {
    id: "bed-90",
    name: "Bett 90 × 200",
    widthMm: 900,
    depthMm: 2000,
    heightMm: 450,
    elevationMm: 0,
  },
  {
    id: "wardrobe",
    name: "Kleiderschrank",
    widthMm: 2000,
    depthMm: 600,
    heightMm: 2200,
    elevationMm: 0,
  },
  { id: "dresser", name: "Kommode", widthMm: 1200, depthMm: 500, heightMm: 900, elevationMm: 0 },
  { id: "desk", name: "Schreibtisch", widthMm: 1600, depthMm: 800, heightMm: 750, elevationMm: 0 },
  {
    id: "dining-table",
    name: "Esstisch",
    widthMm: 1800,
    depthMm: 900,
    heightMm: 750,
    elevationMm: 0,
  },
  { id: "sofa", name: "Sofa", widthMm: 2200, depthMm: 950, heightMm: 850, elevationMm: 0 },
  {
    id: "kitchen-base",
    name: "Küchenunterschrank",
    widthMm: 600,
    depthMm: 600,
    heightMm: 900,
    elevationMm: 0,
  },
  {
    id: "kitchen-wall",
    name: "Küchenhängeschrank",
    widthMm: 600,
    depthMm: 350,
    heightMm: 700,
    elevationMm: 1450,
  },
  {
    id: "tall-cabinet",
    name: "Hochschrank",
    widthMm: 600,
    depthMm: 600,
    heightMm: 2100,
    elevationMm: 0,
  },
  {
    id: "washbasin",
    name: "Waschtisch",
    widthMm: 800,
    depthMm: 500,
    heightMm: 850,
    elevationMm: 0,
  },
  { id: "bathtub", name: "Badewanne", widthMm: 1700, depthMm: 750, heightMm: 600, elevationMm: 0 },
  {
    id: "shower-tray",
    name: "Duschwanne",
    widthMm: 900,
    depthMm: 900,
    heightMm: 50,
    elevationMm: 0,
  },
  { id: "wc", name: "WC", widthMm: 380, depthMm: 600, heightMm: 400, elevationMm: 0 },
];

/** Frische Kopie des Standardkatalogs (das Projekt darf ihn verändern). */
export function defaultCatalog(): Catalog {
  return structuredClone({
    deviceTypes: DEFAULT_DEVICE_TYPES,
    lineTypes: DEFAULT_LINE_TYPES,
    furnitureTypes: DEFAULT_FURNITURE_TYPES,
  });
}

/** Standardwerte der Installationszonen nach DIN 18015-3 (architektur.md „Settings“). */
export const DEFAULT_INSTALL_ZONES = {
  horizontalTop: [150, 450] as [number, number],
  horizontalBottom: [150, 450] as [number, number],
  verticalFromEdge: [100, 300] as [number, number],
};

/** Standardzuschläge für Leitungslängen (design.md M3 „Leitungen“). */
export const DEFAULT_LENGTH_ALLOWANCE = { perDeviceMm: 300, perBoardMm: 1500, wastePercent: 10 };

/** Standardreserven (design.md M4 „Schemaversion 4 und Migration“). */
export const DEFAULT_TE_RESERVE_PERCENT = 25;
export const DEFAULT_ACTUATOR_RESERVE_PERCENT = 20;

/** Standardtypen, die mit M4 hinzukamen (Migration 3 → 4 ergänzt fehlende IDs). */
export const M4_DEVICE_TYPE_IDS = [
  "knx-switch-actuator-16",
  "patch-panel",
  "network-switch",
  "power-supply",
];
export const M4_LINE_TYPE_IDS = ["nym-j-5x10"];

/** Standard-Mindestgefälle von Kondensatleitungen in % (design.md M6 „Schemaversion 5“). */
export const DEFAULT_CONDENSATE_MIN_SLOPE_PERCENT = 1;

/** Standardtypen, die mit M6 hinzukamen (Migration 4 → 5 ergänzt fehlende IDs). */
export const M6_DEVICE_TYPE_IDS = ["ac-outdoor-multi-3", "condensate-drain"];
