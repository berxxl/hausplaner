/** Modell im Speicher: ein einziges Project-Objekt (architektur.md „Datenmodell“, M1- bis M6-Teil). */
import type { z } from "zod";
import type {
  AnchorSchema,
  BoardFieldSchema,
  RoomBoundarySchema,
  BoardSchema,
  CircuitSchema,
  EndpointSchema,
  KnxAssignmentSchema,
  KnxLineSchema,
  LengthAllowanceSchema,
  CableSchema,
  DevicePlacementSchema,
  DeviceSchema,
  DeviceTypeSchema,
  FurnitureSchema,
  FurnitureTypeSchema,
  InstallZonesSchema,
  LineTypeSchema,
  MOUNTINGS,
  OpeningSchema,
  TRADES,
  PointSchema,
  RoomSchema,
  RouteNodeSchema,
  RouteSegmentSchema,
  SettingsSchema,
  CameraViewSchema,
  SlopeSchema,
  StoreySchema,
  UnderlaySchema,
  WallSchema,
} from "./schema";

export type Id = string;
export type Pt = z.infer<typeof PointSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type Underlay = z.infer<typeof UnderlaySchema>;
export type Storey = z.infer<typeof StoreySchema>;
export type Slope = z.infer<typeof SlopeSchema>;
/** storeyId wird beim Laden aus der Datei gesetzt und nie geschrieben. */
export type Wall = z.infer<typeof WallSchema> & { storeyId: Id };
export type Room = z.infer<typeof RoomSchema> & { storeyId: Id };
export type Opening = z.infer<typeof OpeningSchema> & { storeyId: Id };
export type RoomBoundary = z.infer<typeof RoomBoundarySchema> & { storeyId: Id };

export type Trade = (typeof TRADES)[number];
export type Mounting = (typeof MOUNTINGS)[number];
export type InstallZones = z.infer<typeof InstallZonesSchema>;
/** Im Modell ist `connects` immer gesetzt (in der Datei weggelassen, wenn leer). */
export type DeviceType = Omit<z.infer<typeof DeviceTypeSchema>, "connects"> & { connects: Trade[] };
export type LineType = z.infer<typeof LineTypeSchema>;
export type FurnitureType = z.infer<typeof FurnitureTypeSchema>;
export interface Catalog {
  deviceTypes: DeviceType[];
  lineTypes: LineType[];
  furnitureTypes: FurnitureType[];
}
export type DevicePlacement = z.infer<typeof DevicePlacementSchema>;
/** storeyId: Geschoss der Fläche bzw. bei freier Platzierung das Geschoss; beim Laden gesetzt. */
export type Device = z.infer<typeof DeviceSchema> & { storeyId: Id };
export type Furniture = z.infer<typeof FurnitureSchema> & { storeyId: Id };

export type LengthAllowance = z.infer<typeof LengthAllowanceSchema>;
export type Anchor = z.infer<typeof AnchorSchema>;
/** storeyId: Geschoss des ersten Ankers; beim Laden gesetzt (design.md M3 „Dateiformat M3“). */
export type RouteNode = z.infer<typeof RouteNodeSchema> & { storeyId: Id };
/** storeyId: Geschoss von Knoten a; beim Laden gesetzt. */
export type RouteSegment = z.infer<typeof RouteSegmentSchema> & { storeyId: Id };
/** Im Modell ist `path` immer gesetzt (in der Datei weggelassen, wenn leer). */
export type Cable = Omit<z.infer<typeof CableSchema>, "path"> & { path: Id[] };
export type Status = Cable["status"];

export type Endpoint = z.infer<typeof EndpointSchema>;
export type BoardField = z.infer<typeof BoardFieldSchema>;
/** storeyId: Geschoss der Wand von placement.surface; beim Laden gesetzt, nie geschrieben. */
export type Board = Omit<z.infer<typeof BoardSchema>, "fields"> & {
  storeyId: Id;
  fields: BoardField[];
};
export type Circuit = z.infer<typeof CircuitSchema>;
export type KnxLine = z.infer<typeof KnxLineSchema>;
export type KnxAssignment = z.infer<typeof KnxAssignmentSchema>;
export type CameraView = z.infer<typeof CameraViewSchema>;
export type BoardPlacement = Extract<DevicePlacement, { kind: "board" }>;

export interface Project {
  schemaVersion: number;
  name: string;
  settings: Settings;
  catalog: Catalog;
  storeys: Storey[];
  walls: Wall[];
  /** Gedachte Raumgrenzen (M4) */
  roomBoundaries: RoomBoundary[];
  rooms: Room[];
  openings: Opening[];
  devices: Device[];
  furniture: Furniture[];
  routeNodes: RouteNode[];
  routeSegments: RouteSegment[];
  /** leitungen.yaml */
  cables: Cable[];
  /** verteiler.yaml (M4); Reiheneinbaugeräte stehen in `devices`. */
  boards: Board[];
  circuits: Circuit[];
  knxLines: KnxLine[];
  knxAssignments: KnxAssignment[];
  /** Schlüssel bewusst übergangener Warnungen (warnungen.yaml). */
  suppressedWarnings: string[];
  /** Gespeicherte 3D-Kamerapositionen (ansichten.yaml, M6). */
  cameraViews: CameraView[];
}
