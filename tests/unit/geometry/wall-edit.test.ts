import {
  collinearChain,
  moveEndpoint,
  moveParallel,
  setWallLength,
} from "../../../src/geometry/wall-edit";
import type { WallGeom } from "../../../src/geometry/walls";

const w = (id: string, x1: number, y1: number, x2: number, y2: number, t = 240): WallGeom => ({
  id,
  start: { x: x1, y: y1 },
  end: { x: x2, y: y2 },
  thicknessMm: t,
});

const rect = () => [
  w("S", 0, 0, 4000, 0),
  w("E", 4000, 0, 4000, 3000),
  w("N", 4000, 3000, 0, 3000),
  w("W", 0, 3000, 0, 0),
];

describe("Wände bearbeiten (6.3)", () => {
  test("Länge 4180 → 4260: Endpunkt wandert, Eck-Nachbar übernimmt ihn, sein anderes Ende bleibt", () => {
    const walls = [w("a", 0, 0, 4180, 0), w("b", 4180, 0, 4180, 3000)];
    const r = setWallLength(walls, "a", 4260);
    expect(r.changes.get("a")).toEqual({ start: { x: 0, y: 0 }, end: { x: 4260, y: 0 } });
    expect(r.changes.get("b")).toEqual({ start: { x: 4260, y: 0 }, end: { x: 4180, y: 3000 } });
  });

  test("Rechteck: Ostwand 200 mm nach außen (Spec-Scenario)", () => {
    // Ostwand läuft nach +y, links ist −x: „nach außen“ = −200
    const r = moveParallel(rect(), "E", -200);
    expect(r.changes.get("E")).toEqual({ start: { x: 4200, y: 0 }, end: { x: 4200, y: 3000 } });
    expect(r.changes.get("S")).toEqual({ start: { x: 0, y: 0 }, end: { x: 4200, y: 0 } });
    expect(r.changes.get("N")).toEqual({ start: { x: 4200, y: 3000 }, end: { x: 0, y: 3000 } });
    expect(r.changes.has("W")).toBe(false);
    expect(r.released).toEqual([]);
  });

  test("T-Anschluss beim Parallelverschieben: Innenwand verlängert sich bis zur neuen Achse", () => {
    const walls = [w("S", 0, 0, 4000, 0), w("I", 2000, 3000, 2000, 0, 115)];
    const r = moveParallel(walls, "S", -50);
    expect(r.changes.get("I")).toEqual({ start: { x: 2000, y: 3000 }, end: { x: 2000, y: -50 } });
  });

  test("T-Anschluss beim Endpunkt verschieben: (2000, 250), Innenwand bleibt senkrecht", () => {
    const walls = [w("S", 0, 0, 4000, 0), w("I", 2000, 3000, 2000, 0, 115)];
    const r = moveEndpoint(walls, "S", "end", { x: 4000, y: 500 });
    expect(r.changes.get("I")).toEqual({ start: { x: 2000, y: 3000 }, end: { x: 2000, y: 250 } });
    expect(r.released).toEqual([]);
  });

  test("T-Anschluss gelöst: Südwand auf 1500 mm gekürzt", () => {
    const walls = [w("S", 0, 0, 4000, 0), w("I", 2000, 3000, 2000, 0, 115)];
    const r = setWallLength(walls, "S", 1500);
    expect(r.changes.has("I")).toBe(false);
    expect(r.released).toEqual([{ wallId: "I", end: "end" }]);
  });

  test("T-Anschluss beim Parallelverschieben gelöst (Spec-Scenario): 45°-Wand 50 mm vor dem Achsende, 100 mm verschoben", () => {
    // Außenwand von (0,0) nach (4000,0); schräge Innenwand endet bei (3950, 0) unter 45°
    const walls = [w("A", 0, 0, 4000, 0), w("I", 2950, 1000, 3950, 0, 115)];
    const r = moveParallel(walls, "A", -100); // nach −y: Schnitt wandert zu x = 4050, 50 mm hinter dem Ende
    expect(r.changes.has("I")).toBe(false);
    expect(r.released).toEqual([{ wallId: "I", end: "end" }]);
  });

  test("kollineare Kette aus drei Wänden wird mitverschoben; 0,6° gilt nicht als kollinear", () => {
    const walls = [
      w("a", 0, 0, 2000, 0),
      w("b", 2000, 0, 4000, 0),
      w("c", 4000, 0, 6000, 0),
      w("x", 6000, 0, 6000, 3000),
    ];
    expect(collinearChain(walls, "b")).toEqual(["a", "b", "c"]);
    const r = moveParallel(walls, "b", 100);
    expect(r.changes.get("a")).toEqual({ start: { x: 0, y: 100 }, end: { x: 2000, y: 100 } });
    expect(r.changes.get("c")).toEqual({ start: { x: 4000, y: 100 }, end: { x: 6000, y: 100 } });
    expect(r.changes.get("x")).toEqual({ start: { x: 6000, y: 100 }, end: { x: 6000, y: 3000 } });

    const tilt = 2000 * Math.tan((0.6 * Math.PI) / 180);
    const kinked = [w("a", 0, 0, 2000, 0), w("b", 2000, 0, 4000, tilt)];
    expect(collinearChain(kinked, "a")).toEqual(["a"]);
  });
});
