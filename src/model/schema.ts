/**
 * zod-Schema des Modells (M1: design.md „Dateiformat M1“, M2: „Dateiformat M2“, M3: „Dateiformat M3“, M4: „Dateiformat M4“, M6: „Dateiformat M5 (Schemaversion 5)“, architektur.md „Datenmodell“).
 * Dateischemata beschreiben genau den Inhalt einer Datei; alle Objekte sind strict.
 */
import { z } from "zod";
import { ID_PATTERN } from "./ids";

export const CURRENT_SCHEMA_VERSION = 5;

const id = z.string().regex(ID_PATTERN, "ID muss aus 8 Zeichen 0-9 und a-z bestehen");
const mm = z.number().int("Längen sind ganze Millimeter");
const positiveMm = mm.positive("Wert muss größer als 0 sein");
const nonNegativeMm = mm.nonnegative("Wert darf nicht negativ sein");
const deg = z.number().finite();
const text = z.string();
/** Katalog-IDs: zufällige IDs oder feste, lesbare IDs des Standardkatalogs (design.md M2 „Dateiformat M2“). */
const catalogId = z
  .string()
  .max(40, "Katalog-ID höchstens 40 Zeichen")
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Katalog-ID aus a-z, 0-9 und Bindestrichen");
const range = z
  .tuple([z.number().int().nonnegative(), z.number().int().nonnegative()])
  .refine(([a, b]) => a < b, "Bereich [a, b] mit a < b");

export const PointSchema = z.strictObject({ x: mm, y: mm });
export const PdfPointSchema = z.strictObject({ x: z.number().finite(), y: z.number().finite() });

export const InstallZonesSchema = z.strictObject({
  horizontalTop: range,
  horizontalBottom: range,
  verticalFromEdge: range,
});

/** Zuschläge für Leitungslängen (design.md M3 „Leitungen“). */
export const LengthAllowanceSchema = z.strictObject({
  perDeviceMm: nonNegativeMm,
  /** Zuschlag je Verteilerendpunkt (ab M4). */
  perBoardMm: nonNegativeMm,
  wastePercent: z.number().nonnegative("Wert darf nicht negativ sein"),
});

export const SettingsSchema = z.strictObject({
  northDeg: deg,
  installZones: InstallZonesSchema,
  lengthAllowance: LengthAllowanceSchema,
  /** Mindestreserve freier TE in Verteilerfeldern (M4). */
  teReservePercent: z
    .number()
    .min(0, "Wert zwischen 0 und 100")
    .max(100, "Wert zwischen 0 und 100"),
  /** Reserve beim Aktorvorschlag (M4). */
  actuatorReservePercent: z
    .number()
    .min(0, "Wert zwischen 0 und 100")
    .max(100, "Wert zwischen 0 und 100"),
  /** Mindestgefälle von Kondensatleitungen in % (M6). */
  condensateMinSlopePercent: z
    .number()
    .min(0, "Wert zwischen 0 und 10")
    .max(10, "Wert zwischen 0 und 10"),
});

export const ProjectFileSchema = z.strictObject({
  schemaVersion: z.number().int().nonnegative(),
  name: text,
  settings: SettingsSchema,
});

export const StoreyDefaultsSchema = z.strictObject({
  floorBuildupMm: nonNegativeMm,
  plasterMm: nonNegativeMm,
  suspendedMm: nonNegativeMm,
});

export const UnderlaySchema = z.strictObject({
  file: text,
  page: z.number().int().min(1, "Seiten zählen ab 1"),
  /** Fehlt, solange der Plan nicht kalibriert ist (Anzeige dann im Maßstab 1:100). */
  calibration: z
    .strictObject({ p1: PdfPointSchema, p2: PdfPointSchema, distanceMm: positiveMm })
    .optional(),
  offset: PointSchema,
  rotationDeg: deg,
  opacity: z.number().min(0).max(1),
  visible: z.boolean(),
});

export const StoreySchema = z.strictObject({
  id,
  name: text,
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Ungültiger Slug"),
  elevationMm: mm,
  rawHeightMm: positiveMm,
  defaults: StoreyDefaultsSchema,
  underlay: UnderlaySchema.optional(),
});

export const WallSchema = z.strictObject({
  id,
  kind: z.enum(["exterior", "interior"]),
  start: PointSchema,
  end: PointSchema,
  thicknessMm: positiveMm,
  rawHeightMm: positiveMm.optional(),
  outsideSide: z.enum(["L", "R"]).optional(),
});

/** Gedachte Raumgrenze (design.md M4 „Gedachte Raumgrenze“): Linie ohne Dicke. */
export const RoomBoundarySchema = z.strictObject({ id, start: PointSchema, end: PointSchema });

export const SlopeSchema = z.strictObject({
  id,
  baseLine: z.tuple([PointSchema, PointSchema]),
  heightAtBaseMm: mm,
  angleDeg: deg.gt(0).lt(90),
});

export const RoomSchema = z.strictObject({
  id,
  name: text,
  rawHeightMm: positiveMm.optional(),
  floorBuildupMm: nonNegativeMm.optional(),
  plasterMm: nonNegativeMm.optional(),
  suspendedMm: nonNegativeMm.optional(),
  seed: PointSchema,
  polygon: z.array(PointSchema),
  slopes: z.array(SlopeSchema).optional(),
});

export const OpeningSchema = z.strictObject({
  id,
  wallId: id,
  kind: z.enum(["window", "door", "opening"]),
  offsetMm: mm,
  widthMm: positiveMm,
  heightMm: positiveMm,
  sillMm: mm,
  shutterBox: z
    .strictObject({ position: z.enum(["inside", "outside", "top"]), heightMm: positiveMm })
    .optional(),
});

// --- Katalog (M2) ---

export const TRADES = [
  "power",
  "knx",
  "data",
  "conduit",
  "refrigerant",
  "condensate",
  "other",
] as const;
export const TradeSchema = z.enum(TRADES);
export const MOUNTINGS = ["wall", "ceiling", "floor", "din-rail", "free"] as const;
export const KNX_FUNCTIONS = ["switch", "dim", "blind", "heating", "binary-input"] as const;
const KnxFunctionSchema = z.enum(KNX_FUNCTIONS);

export const DeviceTypeSchema = z.strictObject({
  id: catalogId,
  name: text,
  trade: TradeSchema,
  /** SVG-Fragment im Raster viewBox 0 0 100 100 (design.md M2 „Symbole“). */
  symbol: text,
  shape3d: z.strictObject({
    kind: z.enum(["box", "cylinder"]),
    widthMm: positiveMm,
    heightMm: positiveMm,
    depthMm: positiveMm,
  }),
  mounting: z.array(z.enum(MOUNTINGS)).min(1, "Mindestens eine Montageart"),
  defaultHeightMm: mm.optional(),
  flush: z.strictObject({ boxDepthMm: positiveMm }).optional(),
  teWidth: z.number().positive().optional(),
  /** In der Datei weggelassen, wenn leer. */
  connects: z.array(TradeSchema).optional(),
  knx: z
    .strictObject({
      consumes: KnxFunctionSchema.optional(),
      provides: z
        .strictObject({ function: KnxFunctionSchema, channels: z.number().int().positive() })
        .optional(),
    })
    .optional(),
  light: z
    .strictObject({
      kind: z.enum(["spot", "point", "area"]),
      lumen: z.number().positive(),
      beamAngleDeg: deg.optional(),
      colorTempK: z.number().int().positive(),
    })
    .optional(),
  refrigerant: z
    .strictObject({
      /** Rolle (M6); fehlt sie, wird sie abgeleitet (`refrigerantUnit`). */
      unit: z.enum(["indoor", "outdoor"]).optional(),
      minLengthM: z.number().nonnegative(),
      maxLengthM: z.number().positive(),
      prechargedLengthM: z.number().nonnegative(),
    })
    .optional(),
});

export const LineTypeSchema = z.strictObject({
  id: catalogId,
  name: text,
  trade: TradeSchema,
  /** Auf 0,1 mm (Kabeldurchmesser sind selten ganze Millimeter). */
  outerDiameterMm: z.number().positive(),
  color: z.string().regex(/^#[0-9a-f]{6}$/, "Farbe als #rrggbb"),
});

export const FurnitureTypeSchema = z.strictObject({
  id: catalogId,
  name: text,
  widthMm: positiveMm,
  depthMm: positiveMm,
  heightMm: positiveMm,
  elevationMm: nonNegativeMm,
});

export const CatalogFileSchema = z.strictObject({
  deviceTypes: z.array(DeviceTypeSchema).optional(),
  lineTypes: z.array(LineTypeSchema).optional(),
  furnitureTypes: z.array(FurnitureTypeSchema).optional(),
});

// --- Geräte und Möbel (M2) ---

/** "wall:<id>:L|R", "ceiling:<roomId>", "floor:<roomId>", "slope:<roomId>:<slopeId>". */
export const SURFACE_REF_PATTERN =
  /^(wall:[0-9a-z]{8}:[LR]|ceiling:[0-9a-z]{8}|floor:[0-9a-z]{8}|slope:[0-9a-z]{8}:[0-9a-z]{8})$/;

export const DevicePlacementSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("surface"),
    surface: z.string().regex(SURFACE_REF_PATTERN, "Ungültige Fläche"),
    u: mm,
    v: mm,
    rotationDeg: deg,
  }),
  z.strictObject({ kind: z.literal("free"), x: mm, y: mm, z: mm }),
  /** Reiheneinbau (M4): Reihe und Platz zählen ab 1. */
  z.strictObject({
    kind: z.literal("board"),
    boardId: z.string().regex(ID_PATTERN, "ID muss aus 8 Zeichen 0-9 und a-z bestehen"),
    fieldId: z.string().regex(ID_PATTERN, "ID muss aus 8 Zeichen 0-9 und a-z bestehen"),
    row: z.number().int().min(1, "Reihen zählen ab 1"),
    slot: z.number().int().min(1, "Plätze zählen ab 1"),
  }),
]);

export const DeviceSchema = z.strictObject({
  id,
  label: text,
  typeId: catalogId,
  status: z.enum(["planned", "installed", "verified"]),
  placement: DevicePlacementSchema,
  circuitId: id.optional(),
  knxLineId: id.optional(),
});

export const FurnitureSchema = z.strictObject({
  id,
  typeId: catalogId,
  x: mm,
  y: mm,
  rotationDeg: deg,
  widthMm: positiveMm,
  depthMm: positiveMm,
  heightMm: positiveMm,
  elevationMm: nonNegativeMm,
});

// --- Trassen und Leitungen (M3) ---

const surfaceRef = z.string().regex(SURFACE_REF_PATTERN, "Ungültige Fläche");
const status = z.enum(["planned", "installed", "verified"]);

export const AnchorSchema = z.strictObject({ surface: surfaceRef, u: mm, v: mm });

export const RouteNodeSchema = z.strictObject({
  id,
  deviceId: id.optional(),
  boardId: id.optional(),
  anchors: z.array(AnchorSchema).min(1, "Mindestens ein Anker"),
});

export const PENETRATION_METHODS = ["drill", "core-drill", "slot", "conduit"] as const;

export const RouteSegmentSchema = z
  .strictObject({
    id,
    a: id,
    b: id,
    kind: z.enum(["surface", "penetration"]),
    surface: surfaceRef.optional(),
    penetration: z
      .strictObject({ method: z.enum(PENETRATION_METHODS), diameterMm: positiveMm })
      .optional(),
    conduit: z.strictObject({ size: text, innerDiameterMm: z.number().positive() }).optional(),
    status,
  })
  .refine(
    (s) => (s.kind === "surface" ? !!s.surface && !s.penetration : !!s.penetration && !s.surface),
    {
      message: "surface nur bei kind surface, penetration nur bei kind penetration",
    },
  );

/** Genau eins von `deviceId` und `boardId` (design.md M4). */
export const EndpointSchema = z
  .strictObject({ deviceId: id.optional(), boardId: id.optional() })
  .refine((e) => (e.deviceId === undefined) !== (e.boardId === undefined), {
    message: "Endpunkt braucht genau eins von deviceId und boardId",
  });

export const CableSchema = z.strictObject({
  id,
  label: text,
  lineTypeId: catalogId,
  status,
  from: EndpointSchema,
  to: EndpointSchema,
  path: z.array(id).optional(),
});

export const CablesFileSchema = z.strictObject({ cables: z.array(CableSchema).optional() });

// --- Verteiler, Stromkreise, KNX (M4) ---

export const BOARD_KINDS = ["meter-cabinet", "sub-distribution", "media"] as const;
export const FIELD_KINDS = [
  "meter",
  "apz",
  "upper-connection",
  "lower-connection",
  "distribution",
  "multimedia",
] as const;

export const BoardFieldSchema = z.strictObject({
  id,
  kind: z.enum(FIELD_KINDS),
  rows: z.number().int().nonnegative("Wert darf nicht negativ sein"),
  tePerRow: z.number().int().nonnegative("Wert darf nicht negativ sein"),
});

export const BoardSchema = z.strictObject({
  id,
  label: text,
  kind: z.enum(BOARD_KINDS),
  /** Nur Wandseiten (design.md M4 „Verteiler platzieren“). */
  placement: z.strictObject({
    surface: z.string().regex(/^wall:[0-9a-z]{8}:[LR]$/, "Verteiler nur auf Wandseiten"),
    u: mm,
    v: mm,
  }),
  mounting: z.enum(["flush", "surface"]),
  widthMm: positiveMm,
  heightMm: positiveMm,
  depthMm: positiveMm,
  parentBoardId: id.optional(),
  feedCableId: id.optional(),
  /** In Benutzerreihenfolge (links nach rechts); in der Datei weggelassen, wenn leer. */
  fields: z.array(BoardFieldSchema).optional(),
});

export const CircuitSchema = z.strictObject({
  id,
  label: text,
  boardId: id,
  protectionDeviceId: id.optional(),
  lineTypeId: catalogId.optional(),
});

export const KnxLineSchema = z.strictObject({ id, label: text, boardId: id.optional() });

export const KnxAssignmentSchema = z.strictObject({
  actuatorDeviceId: id,
  channel: z.number().int().min(1, "Kanäle zählen ab 1"),
  consumerDeviceId: id,
});

export const BoardsFileSchema = z.strictObject({
  boards: z.array(BoardSchema).optional(),
  devices: z.array(DeviceSchema).optional(),
  circuits: z.array(CircuitSchema).optional(),
  knxLines: z.array(KnxLineSchema).optional(),
  knxAssignments: z.array(KnxAssignmentSchema).optional(),
});

// --- 3D-Ansichten (M6) ---

const PointMm3Schema = z.strictObject({ x: mm, y: mm, z: mm });

/** Gespeicherte Kameraposition in Welt-mm, z über Geländenull (design.md M6 „Kamerapositionen“). */
export const CameraViewSchema = z.strictObject({
  id,
  name: text,
  position: PointMm3Schema,
  target: PointMm3Schema,
  upToStoreyId: id.optional(),
});

export const ViewsFileSchema = z.strictObject({
  cameraViews: z.array(CameraViewSchema).optional(),
});

export const WarningsFileSchema = z.strictObject({
  suppressedWarnings: z.array(z.string()).optional(),
});

export const StoreyFileSchema = z.strictObject({
  storey: StoreySchema,
  walls: z.array(WallSchema).optional(),
  roomBoundaries: z.array(RoomBoundarySchema).optional(),
  rooms: z.array(RoomSchema).optional(),
  openings: z.array(OpeningSchema).optional(),
  devices: z.array(DeviceSchema).optional(),
  furniture: z.array(FurnitureSchema).optional(),
  routeNodes: z.array(RouteNodeSchema).optional(),
  routeSegments: z.array(RouteSegmentSchema).optional(),
});

export type ProjectFile = z.infer<typeof ProjectFileSchema>;
export type StoreyFile = z.infer<typeof StoreyFileSchema>;
export type CatalogFile = z.infer<typeof CatalogFileSchema>;
export type WarningsFile = z.infer<typeof WarningsFileSchema>;
export type CablesFile = z.infer<typeof CablesFileSchema>;
export type BoardsFile = z.infer<typeof BoardsFileSchema>;
export type ViewsFile = z.infer<typeof ViewsFileSchema>;
