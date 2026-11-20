/** Modell im Speicher: ein einziges Project-Objekt (architektur.md „Datenmodell“, M1-Teil). */
import type { z } from "zod";
import type {
  OpeningSchema,
  PointSchema,
  RoomSchema,
  SettingsSchema,
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

export interface Project {
  schemaVersion: number;
  name: string;
  settings: Settings;
  storeys: Storey[];
  walls: Wall[];
  rooms: Room[];
  openings: Opening[];
}
