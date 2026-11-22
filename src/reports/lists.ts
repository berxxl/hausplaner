/** Die Listen der App und des Exports (design.md M5 „Listen in der App“). */
export const LISTS = [
  { kind: "devices", label: "Geräte" },
  { kind: "circuits", label: "Stromkreise" },
  { kind: "knx", label: "KNX-Kanäle" },
  { kind: "cables", label: "Leitungen" },
  { kind: "penetrations", label: "Durchbrüche" },
  { kind: "material", label: "Material" },
] as const;

export type ListKind = (typeof LISTS)[number]["kind"];
