/**
 * zod-Schema des Modells (M1: design.md „Dateiformat M1“, M2: „Dateiformat M2“, architektur.md „Datenmodell“).
 * Dateischemata beschreiben genau den Inhalt einer Datei; alle Objekte sind strict.
 */
import { z } from "zod";
import { ID_PATTERN } from "./ids";

export const CURRENT_SCHEMA_VERSION = 2;

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

export const SettingsSchema = z.strictObject({ northDeg: deg, installZones: InstallZonesSchema });

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
]);

export const DeviceSchema = z.strictObject({
  id,
  label: text,
  typeId: catalogId,
  status: z.enum(["planned", "installed", "verified"]),
  placement: DevicePlacementSchema,
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

export const WarningsFileSchema = z.strictObject({
  suppressedWarnings: z.array(z.string()).optional(),
});

export const StoreyFileSchema = z.strictObject({
  storey: StoreySchema,
  walls: z.array(WallSchema).optional(),
  rooms: z.array(RoomSchema).optional(),
  openings: z.array(OpeningSchema).optional(),
  devices: z.array(DeviceSchema).optional(),
  furniture: z.array(FurnitureSchema).optional(),
});

export type ProjectFile = z.infer<typeof ProjectFileSchema>;
export type StoreyFile = z.infer<typeof StoreyFileSchema>;
export type CatalogFile = z.infer<typeof CatalogFileSchema>;
export type WarningsFile = z.infer<typeof WarningsFileSchema>;
