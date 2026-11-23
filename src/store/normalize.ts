/**
 * Abhängige Änderungen, die zu jedem Befehl gehören und deshalb im selben Patch landen
 * (design.md M2 „Store und Befehle“, M3 „Store und Befehle“, „Löschen und abhängige Änderungen“):
 * Höhenbezug von Wandgeräten bei geänderter Raumzuordnung, Trassen (Anker auf gelöschten Flächen,
 * Gerätknoten, Übergangsanker, verwaiste Segmente und Knoten, Leitungen gelöschter Geräte, Pfade),
 * Verteiler (M4: Löschkaskaden, Verteilerknoten, optionale Verweise), 3D-Ansichten (M6), Bereinigen übergangener
 * Warnungen, zu denen keine Warnung mehr berechnet wird. Frei von React.
 */
import { current, type Draft } from "immer";
import { boardNodeAnchor } from "../geometry/boards";
import { deviceHeightAdjustments } from "../geometry/devices";
import { rederivedAnchors, sameAnchors } from "../geometry/routes";
import type { Anchor, Project } from "../model/types";
import { computeWarnings } from "../rules";

export function normalizeAfterCommand(base: Project, draft: Draft<Project>): void {
  rebaseDeviceHeights(base, draft);
  normalizeBoards(base, draft);
  normalizeRoutes(base, draft);
  normalizeCameraViews(draft);
  pruneSuppressedWarnings(draft);
}

/** Ansicht mit unbekanntem „Anzeigen bis“ zeigt alle Geschosse (design.md M6 „Dateiformat M5“). */
function normalizeCameraViews(draft: Draft<Project>): void {
  const storeys = new Set(draft.storeys.map((s) => s.id));
  for (const v of draft.cameraViews)
    if (v.upToStoreyId !== undefined && !storeys.has(v.upToStoreyId)) delete v.upToStoreyId;
}

/** Gibt es die Fläche (Wand, Raum, Schräge) im Projekt? */
function surfaceExists(project: Project, ref: string): boolean {
  const [kind, id, extra] = ref.split(":");
  if (kind === "wall") return project.walls.some((w) => w.id === id);
  const room = project.rooms.find((r) => r.id === id);
  if (!room) return false;
  return kind !== "slope" || !!room.slopes?.some((s) => s.id === extra);
}

function normalizeRoutes(base: Project, draft: Draft<Project>): void {
  if (
    draft.routeNodes.length === 0 &&
    draft.cables.length === 0 &&
    base.routeNodes.length === 0 &&
    base.cables.length === 0
  )
    return;
  let after = current(draft) as Project;
  const buildingChanged =
    after.walls !== base.walls || after.rooms !== base.rooms || after.storeys !== base.storeys;

  // 1. Anker auf Flächen, die dieser Befehl gelöscht hat; Knoten ohne Anker entfallen
  if (buildingChanged) {
    const gone = (a: Anchor) => surfaceExists(base, a.surface) && !surfaceExists(after, a.surface);
    for (const n of draft.routeNodes)
      if (n.anchors.some(gone)) n.anchors = n.anchors.filter((a) => !gone(a));
    draft.routeNodes = draft.routeNodes.filter((n) => n.anchors.length > 0);
  }

  // 2. Gerätknoten folgen ihrem Gerät; Geräte, die dieser Befehl gelöscht hat, lösen den Knoten
  //    und nehmen ihre Leitungen mit
  if (after.devices !== base.devices) {
    const deleted = new Set(
      base.devices.filter((d) => !after.devices.some((x) => x.id === d.id)).map((d) => d.id),
    );
    if (deleted.size > 0)
      draft.cables = draft.cables.filter(
        (c) => !deleted.has(c.from.deviceId ?? "") && !deleted.has(c.to.deviceId ?? ""),
      );
    for (const n of draft.routeNodes) {
      if (!n.deviceId) continue;
      if (deleted.has(n.deviceId)) {
        delete n.deviceId;
        continue;
      }
      const d = after.devices.find((x) => x.id === n.deviceId);
      if (d?.placement.kind !== "surface") continue;
      const a = n.anchors[0]!;
      const { surface, u, v } = d.placement;
      if (n.anchors.length !== 1 || a.surface !== surface || a.u !== u || a.v !== v)
        n.anchors = [{ surface, u, v }];
    }
  }

  // 3. Übergangsknoten: weitere Anker aus dem ersten ableiten (bleiben stehen, wenn die Kante fehlt)
  after = current(draft) as Project;
  if (buildingChanged || after.routeNodes !== base.routeNodes) {
    for (const n of draft.routeNodes) {
      if (n.anchors.length < 2) continue;
      const next = rederivedAnchors(after, n as Project["routeNodes"][number]);
      if (next && !sameAnchors(next, n.anchors as Anchor[])) n.anchors = next;
    }
  }

  // 4. Segmente ohne Knoten oder ohne Anker auf ihrer Fläche entfallen
  after = current(draft) as Project;
  if (after.routeNodes !== base.routeNodes || after.routeSegments !== base.routeSegments) {
    const nodes = new Map(after.routeNodes.map((n) => [n.id, n]));
    const baseNodes = new Set(base.routeNodes.map((n) => n.id));
    const keep = (s: Project["routeSegments"][number]) => {
      const a = nodes.get(s.a);
      const b = nodes.get(s.b);
      // Verweise ins Leere aus dem Laden bleiben (Warnung), nur von diesem Befehl gelöschte Knoten zählen
      if (!a || !b) return ![s.a, s.b].some((id) => baseNodes.has(id) && !nodes.has(id));
      if (s.kind !== "surface" || !s.surface) return true;
      return (
        a.anchors.some((x) => x.surface === s.surface) &&
        b.anchors.some((x) => x.surface === s.surface)
      );
    };
    if (!after.routeSegments.every(keep))
      draft.routeSegments = draft.routeSegments.filter((s) => keep(s as never));

    // 5. Knoten ohne Segment entfallen, wenn sie neu sind oder ihr letztes Segment verloren haben
    after = current(draft) as Project;
    const used = new Set(after.routeSegments.flatMap((s) => [s.a, s.b]));
    const hadSegment = new Set(base.routeSegments.flatMap((s) => [s.a, s.b]));
    const orphan = (id: string) => !used.has(id) && (!baseNodes.has(id) || hadSegment.has(id));
    if (after.routeNodes.some((n) => orphan(n.id)))
      draft.routeNodes = draft.routeNodes.filter((n) => !orphan(n.id));
  }

  // 6. Pfade: Segment-IDs, die es nicht (mehr) gibt, entfernen
  after = current(draft) as Project;
  const segIds = new Set(after.routeSegments.map((s) => s.id));
  for (const c of draft.cables)
    if (c.path.some((id) => !segIds.has(id))) c.path = c.path.filter((id) => segIds.has(id));
}

const hasBoardData = (p: Project) =>
  p.boards.length + p.circuits.length + p.knxLines.length + p.knxAssignments.length > 0 ||
  p.devices.some((d) => d.circuitId !== undefined || d.knxLineId !== undefined);

/**
 * Verteiler (design.md M4 „Löschen und abhängige Änderungen“): Verteiler auf gelöschten Wänden,
 * Kaskade gelöschter Verteiler, Bereinigung optionaler Verweise, Verteilerknoten nachführen.
 */
function normalizeBoards(base: Project, draft: Draft<Project>): void {
  if (!hasBoardData(base) && !hasBoardData(current(draft) as Project)) return;
  let after = current(draft) as Project;

  // 1. Verteiler auf Wänden, die dieser Befehl gelöscht hat
  if (after.walls !== base.walls) {
    const walls = new Set(after.walls.map((w) => w.id));
    const baseWalls = new Set(base.walls.map((w) => w.id));
    const gone = (b: Project["boards"][number]) => {
      const wallId = b.placement.surface.split(":")[1]!;
      return baseWalls.has(wallId) && !walls.has(wallId);
    };
    if (after.boards.some(gone)) draft.boards = draft.boards.filter((b) => !gone(b as never));
  }

  // 2. Kaskade gelöschter Verteiler
  after = current(draft) as Project;
  const deletedBoards = new Set(
    base.boards.filter((b) => !after.boards.some((x) => x.id === b.id)).map((b) => b.id),
  );
  if (deletedBoards.size > 0) {
    draft.devices = draft.devices.filter(
      (d) => d.placement.kind !== "board" || !deletedBoards.has(d.placement.boardId),
    );
    draft.circuits = draft.circuits.filter((c) => !deletedBoards.has(c.boardId));
    draft.cables = draft.cables.filter(
      (c) => !deletedBoards.has(c.from.boardId ?? "") && !deletedBoards.has(c.to.boardId ?? ""),
    );
    for (const n of draft.routeNodes)
      if (n.boardId && deletedBoards.has(n.boardId)) delete n.boardId;
  }

  // 3. Optionale Verweise ins Leere gelten als nicht gesetzt und werden entfernt
  after = current(draft) as Project;
  const boards = new Set(after.boards.map((b) => b.id));
  const devices = new Set(after.devices.map((d) => d.id));
  const circuits = new Set(after.circuits.map((c) => c.id));
  const lines = new Set(after.knxLines.map((l) => l.id));
  const cables = new Set(after.cables.map((c) => c.id));
  for (const b of draft.boards) {
    if (b.parentBoardId !== undefined && !boards.has(b.parentBoardId)) {
      delete b.parentBoardId;
      delete b.feedCableId;
    }
    if (b.feedCableId !== undefined && !cables.has(b.feedCableId)) delete b.feedCableId;
  }
  for (const d of draft.devices) {
    if (d.circuitId !== undefined && !circuits.has(d.circuitId)) delete d.circuitId;
    if (d.knxLineId !== undefined && !lines.has(d.knxLineId)) delete d.knxLineId;
  }
  for (const c of draft.circuits)
    if (c.protectionDeviceId !== undefined && !devices.has(c.protectionDeviceId))
      delete c.protectionDeviceId;
  for (const l of draft.knxLines)
    if (l.boardId !== undefined && !boards.has(l.boardId)) delete l.boardId;
  if (
    after.knxAssignments.some(
      (a) => !devices.has(a.actuatorDeviceId) || !devices.has(a.consumerDeviceId),
    )
  )
    draft.knxAssignments = draft.knxAssignments.filter(
      (a) => devices.has(a.actuatorDeviceId) && devices.has(a.consumerDeviceId),
    );

  // 4. Verteilerknoten folgen ihrem Verteiler (ein Anker, Mitte der Oberkante)
  after = current(draft) as Project;
  for (const n of draft.routeNodes) {
    if (!n.boardId) continue;
    const b = after.boards.find((x) => x.id === n.boardId);
    if (!b) continue;
    const want = boardNodeAnchor(b);
    const a = n.anchors[0]!;
    if (n.anchors.length !== 1 || a.surface !== want.surface || a.u !== want.u || a.v !== want.v)
      n.anchors = [want];
  }
}

function rebaseDeviceHeights(base: Project, draft: Draft<Project>): void {
  if (draft.devices.length === 0) return;
  const after = current(draft) as Project;
  // Raumzuordnung kann sich nur ändern, wenn Wände, Räume oder Geschosse geändert wurden
  if (after.walls === base.walls && after.rooms === base.rooms && after.storeys === base.storeys)
    return;
  for (const { id, delta } of deviceHeightAdjustments(base, after)) {
    const d = draft.devices.find((x) => x.id === id);
    if (d && d.placement.kind === "surface") d.placement.v += delta;
  }
}

/** Entfernt Markierungen, deren Warnung entfallen ist (Element gelöscht oder Verstoß behoben). */
function pruneSuppressedWarnings(draft: Draft<Project>): void {
  if (draft.suppressedWarnings.length === 0) return;
  const keys = new Set(computeWarnings(current(draft) as Project).map((w) => w.key));
  if (draft.suppressedWarnings.every((k) => keys.has(k))) return;
  draft.suppressedWarnings = draft.suppressedWarnings.filter((k) => keys.has(k));
}
