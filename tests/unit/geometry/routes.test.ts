// Trassengeometrie (Tasks 2.1–2.4)
import {
  anchorWorld,
  edgeAnchors,
  penetrationLength,
  penetrationTarget,
  projectOntoSegment,
  rederivedAnchors,
  segmentLength,
  splitInPaths,
} from "../../../src/geometry/routes";
import { loadProject } from "../../../src/io/load";
import type { Cable, Project, RouteNode, RouteSegment } from "../../../src/model/types";
import { readFixture } from "../fixtures";

const EG = "e0g1k2m3";
const OG = "o9g1k2m3";

/**
 * M2-Fixture (EG: Küche 150..3940 × 150..2940 roh, Putz 15, Aufbau 120, Rohbauhöhe 2500;
 * Bad mit Aufbau 140) plus OG auf 2800 mit einem Raum über der Küche.
 */
function project(): Project {
  const r = loadProject(readFixture("m2"));
  if (r.status !== "ok") throw new Error();
  const p = r.project;
  p.storeys.push({
    id: OG,
    name: "OG",
    slug: "og",
    elevationMm: 2800,
    rawHeightMm: 2500,
    defaults: { floorBuildupMm: 120, plasterMm: 15, suspendedMm: 0 },
  });
  p.rooms.push({
    id: "r9kind01",
    storeyId: OG,
    name: "Kind",
    seed: { x: 2000, y: 1500 },
    polygon: [
      { x: 150, y: 150 },
      { x: 3940, y: 150 },
      { x: 3940, y: 2940 },
      { x: 150, y: 2940 },
    ],
  });
  return p;
}

const node = (id: string, anchors: RouteNode["anchors"], deviceId?: string): RouteNode => ({
  id,
  storeyId: EG,
  anchors,
  ...(deviceId ? { deviceId } : {}),
});

describe("Anker und Längen (2.1)", () => {
  test("Weltposition auf Wand, Decke (gespiegelt) und Boden", () => {
    const p = project();
    // Wand Küche/Bad, Küchenseite R: u = x, fertige Oberfläche 15 mm vor y = 2940
    expect(anchorWorld(p, { surface: "wall:1bih0wst:R", u: 2000, v: 1000 })).toMatchObject({
      x: 2000,
      y: 2925,
      z: 1120,
      storeyId: EG,
    });
    expect(anchorWorld(p, { surface: "ceiling:r1kueche", u: -2000, v: 1500 })).toMatchObject({
      x: 2000,
      y: 1500,
      z: 2485,
    });
    expect(anchorWorld(p, { surface: "floor:r1kueche", u: 2000, v: 1500 })).toMatchObject({
      z: 120,
    });
  });

  test("Segmentlänge in (u, v)", () => {
    const p = project();
    const nodes = new Map([
      ["n1", node("n1", [{ surface: "wall:1bih0wst:R", u: 1000, v: 2200 }])],
      ["n2", node("n2", [{ surface: "wall:1bih0wst:R", u: 1300, v: 1800 }])],
    ]);
    const seg: RouteSegment = {
      id: "s1",
      storeyId: EG,
      a: "n1",
      b: "n2",
      kind: "surface",
      surface: "wall:1bih0wst:R",
      status: "planned",
    };
    expect(segmentLength(p, seg, nodes)).toBe(500);
  });
});

describe("Übergänge an Kanten (2.2)", () => {
  test("rechte Raumecke: zweiter Anker in der rechten Nachbaransicht bei deren linker fertiger Ecke (Spec-Scenario „Über Eck“)", () => {
    const p = project();
    // Küche, Wand zum Bad (Seite R): fertige Ecken bei u = 165 und 3925; rechts schließt die
    // Innenwand zum Wohnen an (Seite L, u = 6000 − y, fertige linke Ecke bei y = 2925 → u = 3075)
    expect(edgeAnchors(p, { surface: "wall:1bih0wst:R", u: 3925, v: 1200 })).toEqual([
      { surface: "wall:1aiv0ert:L", u: 3075, v: 1200 },
    ]);
    // und zurück
    expect(edgeAnchors(p, { surface: "wall:1aiv0ert:L", u: 3075, v: 1200 })).toEqual([
      { surface: "wall:1bih0wst:R", u: 3925, v: 1200 },
    ]);
  });

  test("Oberkante: Knoten erscheint im Deckenspiegel am Wandrand (Spec-Scenario „Zur Decke“)", () => {
    const p = project();
    // fertige Decke 2500 − 15 = 2485 über Rohfußboden, 2365 über OKFF
    expect(edgeAnchors(p, { surface: "wall:1bih0wst:R", u: 2000, v: 2365 })).toEqual([
      { surface: "ceiling:r1kueche", u: -2000, v: 2925 },
    ]);
    expect(edgeAnchors(p, { surface: "ceiling:r1kueche", u: -2000, v: 2925 })).toEqual([
      { surface: "wall:1bih0wst:R", u: 2000, v: 2365 },
    ]);
  });

  test("obere Raumecke hat drei Anker; Unterkante führt auf den Boden", () => {
    const p = project();
    expect(edgeAnchors(p, { surface: "wall:1bih0wst:R", u: 3925, v: 2365 })).toEqual([
      { surface: "wall:1aiv0ert:L", u: 3075, v: 2365 },
      { surface: "ceiling:r1kueche", u: -3925, v: 2925 },
    ]);
    expect(edgeAnchors(p, { surface: "wall:1bih0wst:R", u: 2000, v: 0 })).toEqual([
      { surface: "floor:r1kueche", u: 2000, v: 2925 },
    ]);
  });

  test("unter einer Schräge liegt der Deckenanker auf der Schräge", () => {
    const p = project();
    const kueche = p.rooms.find((r) => r.id === "r1kueche")!;
    // Schräge entlang der Südwand, steigt nach Norden; an der Nordwand (Wand zum Bad) 2300 hoch
    kueche.slopes = [
      {
        id: "sl1schrg",
        baseLine: [
          { x: 150, y: 150 },
          { x: 3940, y: 150 },
        ],
        heightAtBaseMm: 1000,
        angleDeg: 30,
      },
    ];
    // Südwand (Seite L, u = 8000 − x): Oberkante der Wandansicht an der Grundlinie der Schräge
    // 1000 − 15 Putz − 120 Aufbau = 865 über OKFF; dort bildet die Schräge die Decke
    expect(edgeAnchors(p, { surface: "wall:0aw1s0ud:L", u: 6000, v: 1000 })).toEqual([]);
    const result = edgeAnchors(p, { surface: "wall:0aw1s0ud:L", u: 6000, v: 865 });
    expect(result).toHaveLength(1);
    expect(result[0]!.surface).toBe("slope:r1kueche:sl1schrg");
    // und von der Schräge zurück auf die Wand
    expect(edgeAnchors(p, result[0]!)).toEqual([{ surface: "wall:0aw1s0ud:L", u: 6000, v: 865 }]);
  });

  test("Ableitung aus dem ersten Anker; ohne Kante null", () => {
    const p = project();
    const n = node("n1", [
      { surface: "wall:1bih0wst:R", u: 2000, v: 2365 },
      { surface: "ceiling:r1kueche", u: -1990, v: 2925 },
    ]);
    expect(rederivedAnchors(p, n)).toEqual([
      { surface: "wall:1bih0wst:R", u: 2000, v: 2365 },
      { surface: "ceiling:r1kueche", u: -2000, v: 2925 },
    ]);
    n.anchors[0]!.v = 2000;
    expect(rederivedAnchors(p, n)).toBeNull();
  });

  test("unterschiedliche Fußbodenaufbauten: gleiche Höhe über Rohfußboden", () => {
    const p = project();
    p.rooms.find((r) => r.id === "r1kueche")!.floorBuildupMm = 100;
    const [a] = edgeAnchors(p, { surface: "wall:1bih0wst:R", u: 3925, v: 1200 });
    expect(a).toEqual({ surface: "wall:1aiv0ert:L", u: 3075, v: 1200 });
  });
});

describe("Durchbrüche (2.3)", () => {
  test("40-mm-Bohrung in der Küchenwand: Gegenknoten auf der anderen Seite gespiegelt (Spec-Scenario „Durch die Innenwand“)", () => {
    const p = project();
    // Küche → Wohnen durch die Innenwand x = 4000: L (Küche) u = 6000 − y, R (Wohnen) u = y
    const t = penetrationTarget(p, { surface: "wall:1aiv0ert:L", u: 4000, v: 1000 });
    expect(t).toEqual({ ok: true, anchor: { surface: "wall:1aiv0ert:R", u: 2000, v: 1000 } });
    if (!t.ok) return;
    expect(anchorWorld(p, t.anchor)).toMatchObject({ y: 2000, z: 1120 });
    expect(penetrationLength(p, { surface: "wall:1aiv0ert:L", u: 4000, v: 1000 }, t.anchor)).toBe(
      120 + 15 + 15,
    );
  });

  test("Küche → Bad: gleiche Rohbauhöhe bei anderem Fußbodenaufbau", () => {
    const p = project();
    const t = penetrationTarget(p, { surface: "wall:1bih0wst:R", u: 2000, v: 1000 });
    expect(t).toEqual({ ok: true, anchor: { surface: "wall:1bih0wst:L", u: 2000, v: 980 } });
  });

  test("Kernbohrung 65 mm durch die Außenwand verbindet Innenseite und Außenseite (Spec-Scenario „Kernbohrung nach außen“)", () => {
    const p = project();
    const inside = { surface: "wall:0aw1s0ud:L", u: 6000, v: 2100 };
    const t = penetrationTarget(p, inside);
    expect(t).toEqual({ ok: true, anchor: { surface: "wall:0aw1s0ud:R", u: 2000, v: 2220 } });
    if (t.ok) expect(penetrationLength(p, inside, t.anchor)).toBe(300 + 15);
  });

  test("Boden im OG → Decke des Raums darunter im EG (Spec-Scenario „Durch die Geschossdecke“)", () => {
    const p = project();
    const floor = { surface: "floor:r9kind01", u: 2000, v: 1500 };
    const t = penetrationTarget(p, floor);
    expect(t).toEqual({ ok: true, anchor: { surface: "ceiling:r1kueche", u: -2000, v: 1500 } });
    // OKFF OG 2800 + 120, fertige Decke EG 2485
    if (t.ok) expect(penetrationLength(p, floor, t.anchor)).toBe(2920 - 2485);
    expect(penetrationTarget(p, { surface: "ceiling:r1kueche", u: -2000, v: 1500 })).toEqual({
      ok: true,
      anchor: floor,
    });
  });

  test("ohne Raum darunter bzw. darüber abgelehnt", () => {
    const p = project();
    expect(penetrationTarget(p, { surface: "floor:r1kueche", u: 2000, v: 1500 })).toEqual({
      ok: false,
      error: "Kein Raum unter diesem Punkt",
    });
    expect(penetrationTarget(p, { surface: "ceiling:r2wohnen", u: -6000, v: 1500 })).toEqual({
      ok: false,
      error: "Kein Raum über diesem Punkt",
    });
  });
});

describe("Segment teilen (2.4)", () => {
  test("Projektion auf das Segment, begrenzt", () => {
    const a = { surface: "x", u: 0, v: 0 };
    const b = { surface: "x", u: 1000, v: 0 };
    expect(projectOntoSegment(a, b, 400, 300)).toEqual({ u: 400, v: 0, t: 0.4 });
    expect(projectOntoSegment(a, b, -50, 0)).toMatchObject({ u: 0, t: 0 });
  });

  test("Leitung über das geteilte Segment hat danach beide Teile in Wegrichtung", () => {
    const s = (id: string, a: string, b: string): RouteSegment => ({
      id,
      storeyId: EG,
      a,
      b,
      kind: "surface",
      surface: "wall:1bih0wst:R",
      status: "planned",
    });
    // n1 (Gerät) – s1 – n2 – s2 (a = n3, b = n2, also entgegen der Wegrichtung) – n3 – s3 – n4
    const segments = new Map([
      ["s1", s("s1", "n1", "n2")],
      ["s2", s("s2", "n3", "n2")],
      ["s3", s("s3", "n3", "n4")],
    ]);
    const nodes = new Map([["n1", node("n1", [], "d1")]]);
    const cable = (id: string, path: string[]): Cable => ({
      id,
      label: id,
      lineTypeId: "x",
      status: "planned",
      from: { deviceId: "d1" },
      to: { deviceId: "d2" },
      path,
    });
    const paths = splitInPaths(
      [cable("c1", ["s1", "s2", "s3"]), cable("c2", ["s2"]), cable("c3", ["s3", "s2", "s1"])],
      segments,
      nodes,
      "s2",
      "s2a",
      "s2b",
    );
    // s2a hängt an n3 (a), s2b an n2 (b); c1 läuft n2 → n3
    expect(paths.get("c1")).toEqual(["s1", "s2b", "s2a", "s3"]);
    expect(paths.get("c3")).toEqual(["s3", "s2a", "s2b", "s1"]);
    expect(paths.get("c2")).toEqual(["s2a", "s2b"]);
  });
});
