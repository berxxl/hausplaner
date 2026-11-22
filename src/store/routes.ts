/**
 * Befehle für Trassen (design.md M3 „Trassen zeichnen“, „Durchbrüche“, „Status“). Abhängige
 * Änderungen (Gerätknoten, Übergangsanker, verwaiste Knoten, Pfade) erledigt normalizeAfterCommand.
 * Frei von React.
 */
import { current, type Draft } from "immer";
import { surfaceStoreyId } from "../geometry/devices";
import { splitInPaths } from "../geometry/routes";
import type { Anchor, Project, RouteNode, RouteSegment } from "../model/types";
import type { Command } from "./history";

/** Neuer Knoten mit Geschoss aus dem ersten Anker. */
export function makeNode(
  project: Project,
  id: string,
  anchors: Anchor[],
  deviceId?: string,
): RouteNode {
  const storeyId = surfaceStoreyId(project, anchors[0]!.surface) ?? "";
  return { id, storeyId, anchors, ...(deviceId ? { deviceId } : {}) };
}

/** Teilt ein Flächensegment an einem neuen Knoten; Teil A hängt an Knoten a, Teil B an Knoten b. */
function applySplit(
  draft: Draft<Project>,
  segmentId: string,
  node: RouteNode,
  idA: string,
  idB: string,
): void {
  const seg = draft.routeSegments.find((s) => s.id === segmentId);
  if (!seg || seg.kind !== "surface") return;
  const paths = splitInPaths(
    draft.cables as Project["cables"],
    new Map(draft.routeSegments.map((s) => [s.id, s as RouteSegment])),
    new Map(draft.routeNodes.map((n) => [n.id, n as RouteNode])),
    segmentId,
    idA,
    idB,
  );
  if (!draft.routeNodes.some((n) => n.id === node.id)) draft.routeNodes.push(structuredClone(node));
  const base = structuredClone(current(seg) as RouteSegment);
  draft.routeSegments = draft.routeSegments.filter((s) => s.id !== segmentId);
  draft.routeSegments.push({ ...base, id: idA, b: node.id });
  draft.routeSegments.push({ ...base, id: idB, a: node.id, storeyId: node.storeyId });
  for (const c of draft.cables) {
    const p = paths.get(c.id);
    if (p) c.path = p;
  }
}

export interface SplitSpec {
  segmentId: string;
  node: RouteNode;
  idA: string;
  idB: string;
}

export function splitSegment(spec: SplitSpec): Command {
  return {
    label: "Segment teilen",
    run(draft) {
      applySplit(draft, spec.segmentId, spec.node, spec.idA, spec.idB);
    },
  };
}

/**
 * Ein Segment des Trassenzugs: neue Knoten anlegen, vorher Segmente an Abzweigen teilen,
 * dann das Segment von `a` nach `b` auf `surface`.
 */
export function drawSegment(spec: {
  segment: Pick<RouteSegment, "id" | "a" | "b" | "surface">;
  newNodes?: RouteNode[];
  splits?: SplitSpec[];
}): Command {
  return {
    label: "Trasse zeichnen",
    run(draft) {
      for (const sp of spec.splits ?? []) applySplit(draft, sp.segmentId, sp.node, sp.idA, sp.idB);
      for (const n of spec.newNodes ?? [])
        if (!draft.routeNodes.some((x) => x.id === n.id)) draft.routeNodes.push(structuredClone(n));
      const a = draft.routeNodes.find((n) => n.id === spec.segment.a);
      draft.routeSegments.push({
        id: spec.segment.id,
        storeyId: a?.storeyId ?? "",
        a: spec.segment.a,
        b: spec.segment.b,
        kind: "surface",
        surface: spec.segment.surface!,
        status: "planned",
      });
    },
  };
}

/** Verschiebt den maßgebenden Anker; weitere Anker leitet die Nachbearbeitung ab. */
export function moveNode(id: string, anchor: Anchor): Command {
  return {
    label: "Knoten verschieben",
    run(draft) {
      const n = draft.routeNodes.find((x) => x.id === id);
      if (n) n.anchors[0] = { ...anchor };
    },
  };
}

export type SegmentEdit = Partial<Pick<RouteSegment, "status" | "conduit" | "penetration">>;

/** Status, Leerrohr oder Durchbruchmaße für ein oder mehrere Segmente in einem Schritt. */
export function editSegments(ids: readonly string[], edit: SegmentEdit): Command {
  const set = new Set(ids);
  return {
    label: "Segment ändern",
    run(draft) {
      for (const s of draft.routeSegments) {
        if (!set.has(s.id)) continue;
        for (const [k, v] of Object.entries(edit) as [keyof SegmentEdit, unknown][]) {
          if (v === undefined || v === null) delete s[k];
          else (s as Record<string, unknown>)[k] = structuredClone(v);
        }
      }
    },
  };
}

/** Löscht Knoten mit allen anliegenden Segmenten und einzelne Segmente. */
export function deleteRoute(spec: {
  nodes?: readonly string[];
  segments?: readonly string[];
}): Command {
  const nodes = new Set(spec.nodes ?? []);
  const segments = new Set(spec.segments ?? []);
  return {
    label: "Trasse löschen",
    run(draft) {
      draft.routeSegments = draft.routeSegments.filter(
        (s) => !segments.has(s.id) && !nodes.has(s.a) && !nodes.has(s.b),
      );
      draft.routeNodes = draft.routeNodes.filter((n) => !nodes.has(n.id));
    },
  };
}

/** Durchbruch: Knoten auf dieser Seite (vorhanden oder neu), Gegenknoten, Segment. */
export function addPenetration(spec: {
  id: string;
  near: RouteNode;
  far: RouteNode;
  method: NonNullable<RouteSegment["penetration"]>["method"];
  diameterMm: number;
  /** a ist bei Deckendurchbrüchen der obere Knoten */
  nearIsA: boolean;
}): Command {
  return {
    label: "Durchbruch anlegen",
    run(draft) {
      for (const n of [spec.near, spec.far])
        if (!draft.routeNodes.some((x) => x.id === n.id)) draft.routeNodes.push(structuredClone(n));
      const [a, b] = spec.nearIsA ? [spec.near, spec.far] : [spec.far, spec.near];
      draft.routeSegments.push({
        id: spec.id,
        storeyId: a.storeyId,
        a: a.id,
        b: b.id,
        kind: "penetration",
        penetration: { method: spec.method, diameterMm: spec.diameterMm },
        status: "planned",
      });
    },
  };
}

/** Anzahl Leitungen, die beim Löschen dieser Geräte mitgelöscht werden. */
export function dependentCableCount(project: Project, deviceIds: readonly string[]): number {
  const set = new Set(deviceIds);
  return project.cables.filter((c) => set.has(c.from.deviceId) || set.has(c.to.deviceId)).length;
}
