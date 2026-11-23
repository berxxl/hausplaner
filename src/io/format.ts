/**
 * Dateiformat – die einzige Stelle mit Feldreihenfolge, Sortierung und Flow-Stil
 * (M1: design.md „Dateiformat M1“, M2: „Dateiformat M2“, M3: „Dateiformat M3“, M4: „Dateiformat M4“, M6: „Dateiformat M5 (Schemaversion 5)“). Writer und Golden-File-Tests hängen daran.
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
  | "roomBoundary"
  | "room"
  | "slope"
  | "opening"
  | "shutterBox"
  | "installZones"
  | "catalogFile"
  | "deviceType"
  | "shape3d"
  | "flush"
  | "knx"
  | "knxProvides"
  | "light"
  | "refrigerant"
  | "lineType"
  | "furnitureType"
  | "device"
  | "placement"
  | "furniture"
  | "warningsFile"
  | "lengthAllowance"
  | "routeNode"
  | "anchor"
  | "routeSegment"
  | "penetration"
  | "conduit"
  | "cablesFile"
  | "cable"
  | "endpoint"
  | "boardsFile"
  | "board"
  | "boardPlacement"
  | "boardField"
  | "circuit"
  | "knxLine"
  | "knxAssignment"
  | "viewsFile"
  | "cameraView"
  | "point3";

export type FieldKind =
  | { kind: "scalar" }
  | { kind: "object"; type: TypeName }
  | { kind: "list"; of: TypeName; sortBy?: "id" | "actuatorChannel"; flow?: boolean }
  /** Liste einfacher Werte; `sorted` sortiert alphabetisch. */
  | { kind: "scalars"; flow?: boolean; sorted?: boolean };

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
const flowScalars: FieldKind = { kind: "scalars", flow: true };
const byId = (of: TypeName): FieldKind => ({ kind: "list", of, sortBy: "id" });
const f = (key: string, value: FieldKind = scalar, optional = false): FieldSpec => ({
  key,
  value,
  optional,
});

export const FORMAT: Record<TypeName, TypeSpec> = {
  projectFile: { fields: [f("schemaVersion"), f("name"), f("settings", obj("settings"))] },
  settings: {
    fields: [
      f("northDeg"),
      f("installZones", obj("installZones")),
      f("lengthAllowance", obj("lengthAllowance")),
      f("teReservePercent"),
      f("actuatorReservePercent"),
      f("condensateMinSlopePercent"),
    ],
  },
  lengthAllowance: { flow: true, fields: [f("perDeviceMm"), f("perBoardMm"), f("wastePercent")] },
  installZones: {
    fields: [
      f("horizontalTop", flowScalars),
      f("horizontalBottom", flowScalars),
      f("verticalFromEdge", flowScalars),
    ],
  },
  storeyFile: {
    fields: [
      f("storey", obj("storey")),
      f("walls", byId("wall"), true),
      f("roomBoundaries", byId("roomBoundary"), true),
      f("rooms", byId("room"), true),
      f("openings", byId("opening"), true),
      f("devices", byId("device"), true),
      f("furniture", byId("furniture"), true),
      f("routeNodes", byId("routeNode"), true),
      f("routeSegments", byId("routeSegment"), true),
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
      f("calibration", obj("calibration"), true),
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
  roomBoundary: { fields: [f("id"), f("start", obj("point")), f("end", obj("point"))] },
  room: {
    fields: [
      f("id"),
      f("name"),
      f("rawHeightMm", scalar, true),
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
  catalogFile: {
    fields: [
      f("deviceTypes", byId("deviceType"), true),
      f("lineTypes", byId("lineType"), true),
      f("furnitureTypes", byId("furnitureType"), true),
    ],
  },
  deviceType: {
    fields: [
      f("id"),
      f("name"),
      f("trade"),
      f("symbol"),
      f("shape3d", obj("shape3d")),
      f("mounting", flowScalars),
      f("defaultHeightMm", scalar, true),
      f("flush", obj("flush"), true),
      f("teWidth", scalar, true),
      f("connects", flowScalars, true),
      f("knx", obj("knx"), true),
      f("light", obj("light"), true),
      f("refrigerant", obj("refrigerant"), true),
    ],
  },
  shape3d: { flow: true, fields: [f("kind"), f("widthMm"), f("heightMm"), f("depthMm")] },
  flush: { flow: true, fields: [f("boxDepthMm")] },
  knx: { fields: [f("consumes", scalar, true), f("provides", obj("knxProvides"), true)] },
  knxProvides: { flow: true, fields: [f("function"), f("channels")] },
  light: {
    flow: true,
    fields: [f("kind"), f("lumen"), f("beamAngleDeg", scalar, true), f("colorTempK")],
  },
  refrigerant: {
    flow: true,
    fields: [f("unit", scalar, true), f("minLengthM"), f("maxLengthM"), f("prechargedLengthM")],
  },
  lineType: { fields: [f("id"), f("name"), f("trade"), f("outerDiameterMm"), f("color")] },
  furnitureType: {
    fields: [f("id"), f("name"), f("widthMm"), f("depthMm"), f("heightMm"), f("elevationMm")],
  },
  device: {
    fields: [
      f("id"),
      f("label"),
      f("typeId"),
      f("status"),
      f("placement", obj("placement")),
      f("circuitId", scalar, true),
      f("knxLineId", scalar, true),
    ],
  },
  /** surface: kind, surface, u, v, rotationDeg; free: kind, x, y, z; board: kind, boardId, fieldId, row, slot. */
  placement: {
    flow: true,
    fields: [
      f("kind"),
      f("surface", scalar, true),
      f("u", scalar, true),
      f("v", scalar, true),
      f("rotationDeg", scalar, true),
      f("x", scalar, true),
      f("y", scalar, true),
      f("z", scalar, true),
      f("boardId", scalar, true),
      f("fieldId", scalar, true),
      f("row", scalar, true),
      f("slot", scalar, true),
    ],
  },
  furniture: {
    fields: [
      f("id"),
      f("typeId"),
      f("x"),
      f("y"),
      f("rotationDeg"),
      f("widthMm"),
      f("depthMm"),
      f("heightMm"),
      f("elevationMm"),
    ],
  },
  routeNode: {
    fields: [
      f("id"),
      f("deviceId", scalar, true),
      f("boardId", scalar, true),
      f("anchors", { kind: "list", of: "anchor" }),
    ],
  },
  anchor: { flow: true, fields: [f("surface"), f("u"), f("v")] },
  routeSegment: {
    fields: [
      f("id"),
      f("a"),
      f("b"),
      f("kind"),
      f("surface", scalar, true),
      f("penetration", obj("penetration"), true),
      f("conduit", obj("conduit"), true),
      f("status"),
    ],
  },
  penetration: { flow: true, fields: [f("method"), f("diameterMm")] },
  conduit: { flow: true, fields: [f("size"), f("innerDiameterMm")] },
  cablesFile: { fields: [f("cables", byId("cable"), true)] },
  cable: {
    fields: [
      f("id"),
      f("label"),
      f("lineTypeId"),
      f("status"),
      f("from", obj("endpoint")),
      f("to", obj("endpoint")),
      f("path", flowScalars, true),
    ],
  },
  endpoint: { flow: true, fields: [f("deviceId", scalar, true), f("boardId", scalar, true)] },
  boardsFile: {
    fields: [
      f("boards", byId("board"), true),
      f("devices", byId("device"), true),
      f("circuits", byId("circuit"), true),
      f("knxLines", byId("knxLine"), true),
      f("knxAssignments", { kind: "list", of: "knxAssignment", sortBy: "actuatorChannel" }, true),
    ],
  },
  board: {
    fields: [
      f("id"),
      f("label"),
      f("kind"),
      f("placement", obj("boardPlacement")),
      f("mounting"),
      f("widthMm"),
      f("heightMm"),
      f("depthMm"),
      f("parentBoardId", scalar, true),
      f("feedCableId", scalar, true),
      // Benutzerreihenfolge, nicht nach ID (design.md M4 „Dateiformat M4“)
      f("fields", { kind: "list", of: "boardField" }, true),
    ],
  },
  boardPlacement: { flow: true, fields: [f("surface"), f("u"), f("v")] },
  boardField: { flow: true, fields: [f("id"), f("kind"), f("rows"), f("tePerRow")] },
  circuit: {
    fields: [
      f("id"),
      f("label"),
      f("boardId"),
      f("protectionDeviceId", scalar, true),
      f("lineTypeId", scalar, true),
    ],
  },
  knxLine: { fields: [f("id"), f("label"), f("boardId", scalar, true)] },
  knxAssignment: {
    flow: true,
    fields: [f("actuatorDeviceId"), f("channel"), f("consumerDeviceId")],
  },
  viewsFile: { fields: [f("cameraViews", byId("cameraView"), true)] },
  cameraView: {
    fields: [
      f("id"),
      f("name"),
      f("position", obj("point3")),
      f("target", obj("point3")),
      f("upToStoreyId", scalar, true),
    ],
  },
  point3: { flow: true, fields: [f("x"), f("y"), f("z")] },
  warningsFile: {
    fields: [f("suppressedWarnings", { kind: "scalars", sorted: true }, true)],
  },
};

/** Optionen des yaml-Pakets (design.md „Weitere Regeln“). */
export const YAML_OPTIONS = {
  lineWidth: 0,
  flowCollectionPadding: false,
  indent: 2,
  indentSeq: true,
} as const;
