/** Deterministischer YAML-Writer nach FORMAT. Frei von React. */
import { Document, Pair, Scalar, YAMLMap, YAMLSeq } from "yaml";
import { FORMAT, YAML_OPTIONS, type FieldKind, type TypeName } from "./format";

type Plain = Record<string, unknown>;

function scalarNode(value: unknown): Scalar {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Ungültige Zahl: ${value}`);
    return new Scalar(Object.is(value, -0) ? 0 : value);
  }
  if (typeof value === "string") {
    const s = new Scalar(value);
    s.type = Scalar.QUOTE_DOUBLE;
    return s;
  }
  if (typeof value === "boolean") return new Scalar(value);
  throw new Error(`Nicht schreibbarer Wert: ${String(value)}`);
}

function isUnset(value: unknown): boolean {
  return value === undefined || value === null || (Array.isArray(value) && value.length === 0);
}

function fieldNode(value: unknown, kind: FieldKind, inFlow: boolean): unknown {
  switch (kind.kind) {
    case "scalar":
      return scalarNode(value);
    case "object":
      return objectNode(value as Plain, kind.type, inFlow);
    case "list": {
      if (!Array.isArray(value)) throw new Error("Liste erwartet");
      const items = kind.sortBy ? [...value].sort(byKey(kind.sortBy)) : value;
      const seq = new YAMLSeq();
      seq.flow = inFlow || !!kind.flow;
      for (const item of items) seq.items.push(objectNode(item as Plain, kind.of, seq.flow));
      return seq;
    }
    case "scalars": {
      if (!Array.isArray(value)) throw new Error("Liste erwartet");
      const items = kind.sorted
        ? [...(value as string[])].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
        : value;
      const seq = new YAMLSeq();
      seq.flow = inFlow || !!kind.flow;
      for (const item of items) seq.items.push(scalarNode(item));
      return seq;
    }
  }
}

function byKey(key: string) {
  return (a: unknown, b: unknown): number => {
    const ka = String((a as Plain)[key]);
    const kb = String((b as Plain)[key]);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  };
}

function objectNode(value: Plain, type: TypeName, inFlow: boolean): YAMLMap {
  const spec = FORMAT[type];
  const map = new YAMLMap();
  map.flow = inFlow || !!spec.flow;
  for (const field of spec.fields) {
    const v = value[field.key];
    if (isUnset(v)) {
      if (field.optional) continue;
      throw new Error(`Pflichtfeld ${type}.${field.key} fehlt`);
    }
    map.items.push(new Pair(new Scalar(field.key), fieldNode(v, field.value, map.flow)));
  }
  return map;
}

/** Serialisiert ein Dateiobjekt kanonisch. Felder, die nicht in FORMAT stehen, werden nicht geschrieben. */
export function writeYaml(value: Plain, type: TypeName): string {
  const doc = new Document();
  doc.contents = objectNode(value, type, false);
  return doc.toString(YAML_OPTIONS);
}
