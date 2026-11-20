/**
 * zod-Schema des M1-Modells (design.md „Dateiformat M1“, architektur.md „Datenmodell“).
 * Dateischemata beschreiben genau den Inhalt einer Datei; alle Objekte sind strict.
 */
import { z } from "zod";
import { ID_PATTERN } from "./ids";

export const CURRENT_SCHEMA_VERSION = 1;

const id = z.string().regex(ID_PATTERN, "ID muss aus 8 Zeichen 0-9 und a-z bestehen");
const mm = z.number().int("Längen sind ganze Millimeter");
const positiveMm = mm.positive("Wert muss größer als 0 sein");
const nonNegativeMm = mm.nonnegative("Wert darf nicht negativ sein");
const deg = z.number().finite();
const text = z.string();

export const PointSchema = z.strictObject({ x: mm, y: mm });
export const PdfPointSchema = z.strictObject({ x: z.number().finite(), y: z.number().finite() });

export const SettingsSchema = z.strictObject({ northDeg: deg });

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
  calibration: z.strictObject({ p1: PdfPointSchema, p2: PdfPointSchema, distanceMm: positiveMm }),
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

export const StoreyFileSchema = z.strictObject({
  storey: StoreySchema,
  walls: z.array(WallSchema).optional(),
  rooms: z.array(RoomSchema).optional(),
  openings: z.array(OpeningSchema).optional(),
});

export type ProjectFile = z.infer<typeof ProjectFileSchema>;
export type StoreyFile = z.infer<typeof StoreyFileSchema>;
