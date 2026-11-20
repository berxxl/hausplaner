/**
 * Dateiformat M1 – die einzige Stelle mit Feldreihenfolge, Sortierung und Flow-Stil
 * (design.md „Dateiformat M1“). Writer und Golden-File-Tests hängen daran.
 */

export type TypeName =
  | "projectFile"
  | "settings"
  | "storeyFile"
  | "storey"
  | "defaults"
  | "underlay"
  | "calibration"
  | "point"
  | "wall"
  | "room"
  | "slope"
  | "opening"
  | "shutterBox";

export type FieldKind =
  | { kind: "scalar" }
  | { kind: "object"; type: TypeName }
  | { kind: "list"; of: TypeName; sortBy?: "id"; flow?: boolean };

export interface FieldSpec {
  key: string;
  value: FieldKind;
  /** Nur schreiben, wenn gesetzt (leere Listen gelten als nicht gesetzt). */
  optional?: boolean;
}

export interface TypeSpec {
  fields: FieldSpec[];
  /** Objekt immer einzeilig im Flow-Stil. */
  flow?: boolean;
}

const scalar: FieldKind = { kind: "scalar" };
const obj = (type: TypeName): FieldKind => ({ kind: "object", type });
const f = (key: string, value: FieldKind = scalar, optional = false): FieldSpec => ({
  key,
  value,
  optional,
});

export const FORMAT: Record<TypeName, TypeSpec> = {
  projectFile: { fields: [f("schemaVersion"), f("name"), f("settings", obj("settings"))] },
  settings: { fields: [f("northDeg")] },
  storeyFile: {
    fields: [
      f("storey", obj("storey")),
      f("walls", { kind: "list", of: "wall", sortBy: "id" }, true),
      f("rooms", { kind: "list", of: "room", sortBy: "id" }, true),
      f("openings", { kind: "list", of: "opening", sortBy: "id" }, true),
    ],
  },
  storey: {
    fields: [
      f("id"),
      f("name"),
      f("slug"),
      f("elevationMm"),
      f("rawHeightMm"),
      f("defaults", obj("defaults")),
      f("underlay", obj("underlay"), true),
    ],
  },
  defaults: { flow: true, fields: [f("floorBuildupMm"), f("plasterMm"), f("suspendedMm")] },
  underlay: {
    fields: [
      f("file"),
      f("page"),
      f("calibration", obj("calibration")),
      f("offset", obj("point")),
      f("rotationDeg"),
      f("opacity"),
      f("visible"),
    ],
  },
  calibration: {
    flow: true,
    fields: [f("p1", obj("point")), f("p2", obj("point")), f("distanceMm")],
  },
  point: { flow: true, fields: [f("x"), f("y")] },
  wall: {
    fields: [
      f("id"),
      f("kind"),
      f("start", obj("point")),
      f("end", obj("point")),
      f("thicknessMm"),
      f("rawHeightMm", scalar, true),
      f("outsideSide", scalar, true),
    ],
  },
  room: {
    fields: [
      f("id"),
      f("name"),
      f("floorBuildupMm", scalar, true),
      f("plasterMm", scalar, true),
      f("suspendedMm", scalar, true),
      f("seed", obj("point")),
      f("polygon", { kind: "list", of: "point" }),
      f("slopes", { kind: "list", of: "slope", sortBy: "id" }, true),
    ],
  },
  slope: {
    fields: [
      f("id"),
      f("baseLine", { kind: "list", of: "point", flow: true }),
      f("heightAtBaseMm"),
      f("angleDeg"),
    ],
  },
  opening: {
    fields: [
      f("id"),
      f("wallId"),
      f("kind"),
      f("offsetMm"),
      f("widthMm"),
      f("heightMm"),
      f("sillMm"),
      f("shutterBox", obj("shutterBox"), true),
    ],
  },
  shutterBox: { flow: true, fields: [f("position"), f("heightMm")] },
};

/** Optionen des yaml-Pakets (design.md „Weitere Regeln“). */
export const YAML_OPTIONS = {
  lineWidth: 0,
  flowCollectionPadding: false,
  indent: 2,
  indentSeq: true,
} as const;
