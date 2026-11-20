import { canonicalPolygon, pointInPolygon } from "../../../src/geometry/polygon";
import {
  detectRoom,
  finishedArea,
  isFreeStandingIn,
  roomStatuses,
} from "../../../src/geometry/rooms";
import type { WallGeom } from "../../../src/geometry/walls";

const w = (id: string, x1: number, y1: number, x2: number, y2: number, t = 240): WallGeom => ({
  id,
  start: { x: x1, y: y1 },
  end: { x: x2, y: y2 },
  thicknessMm: t,
});

/** Rechteck aus vier Wänden (Achsen), Ecke unten links bei (x0, y0). */
function box(x0: number, y0: number, wd: number, h: number, t = 240, prefix = "") {
  return [
    w(prefix + "s", x0, y0, x0 + wd, y0, t),
    w(prefix + "e", x0 + wd, y0, x0 + wd, y0 + h, t),
    w(prefix + "n", x0 + wd, y0 + h, x0, y0 + h, t),
    w(prefix + "w", x0, y0 + h, x0, y0, t),
  ];
}

describe("Raumerkennung (6.4)", () => {
  test("geschlossen: Kontur der Wandinnenseiten im Rohbau, kanonisch", () => {
    const d = detectRoom(box(0, 0, 4000, 3000), { x: 2000, y: 1500 });
    expect(d.status).toBe("closed");
    if (d.status !== "closed") return;
    expect(d.polygon).toEqual([
      { x: 120, y: 120 },
      { x: 3880, y: 120 },
      { x: 3880, y: 2880 },
      { x: 120, y: 2880 },
    ]);
  });

  test("Lücke 15 mm gilt als geschlossen", () => {
    const walls = box(0, 0, 4000, 3000);
    // Innenkante der Westwand bei x = 120; die Südwand beginnt mit ihrer Stirn 15 mm daneben
    walls[0] = w("s", 135, 0, 4000, 0);
    expect(detectRoom(walls, { x: 2000, y: 1500 }).status).toBe("closed");
  });

  test("Lücke 30 mm: offen, genau die beiden Endpunkte an der Lücke werden markiert", () => {
    const walls = box(0, 0, 4000, 3000);
    // Nordwand in zwei Teile mit 30 mm Lücke
    walls[2] = w("n1", 4000, 3000, 2015, 3000);
    walls.push(w("n2", 1985, 3000, 0, 3000));
    // frei stehender Stummel in einem anderen, geschlossenen Raum: grenzt nicht an die offene Region
    walls.push(...box(10000, 0, 3000, 3000, 240, "b"), w("stub", 11000, 1500, 12000, 1500));
    const d = detectRoom(walls, { x: 2000, y: 1500 });
    expect(d.status).toBe("open");
    if (d.status !== "open") return;
    expect(d.openEnds.sort((a, b) => a.wallId.localeCompare(b.wallId))).toEqual([
      { wallId: "n1", end: "end" },
      { wallId: "n2", end: "start" },
    ]);
  });

  test("Saatpunkt im Wandkörper", () => {
    expect(detectRoom(box(0, 0, 4000, 3000), { x: 0, y: 1500 }).status).toBe("in-wall");
  });

  test("Klick in bestehenden Raum: Punkt im gespeicherten Polygon", () => {
    const d = detectRoom(box(0, 0, 4000, 3000), { x: 2000, y: 1500 });
    if (d.status !== "closed") throw new Error();
    expect(pointInPolygon({ x: 500, y: 500 }, d.polygon)).toBe(true);
    expect(pointInPolygon({ x: 5000, y: 500 }, d.polygon)).toBe(false);
  });

  test("frei stehende Wand gehört zum Raum und ändert die Kontur nicht", () => {
    const walls = [...box(0, 0, 6000, 4000), w("free", 2000, 2000, 3500, 2000, 115)];
    const d = detectRoom(walls, { x: 1000, y: 1000 });
    expect(d.status).toBe("closed");
    if (d.status !== "closed") return;
    expect(d.polygon).toHaveLength(4);
    expect(isFreeStandingIn(walls, walls[4]!, d.polygon)).toBe(true);
    expect(isFreeStandingIn(walls, walls[0]!, d.polygon)).toBe(false);
  });

  test("T-Innenwand teilt in zwei Räume; L-Raum hat sechs Ecken", () => {
    const walls = [
      ...box(0, 0, 8000, 6000),
      w("i1", 4000, 0, 4000, 3000, 115),
      w("i2", 4000, 3000, 8000, 3000, 115),
    ];
    const left = detectRoom(walls, { x: 1000, y: 1000 });
    const right = detectRoom(walls, { x: 6000, y: 1000 });
    expect(left.status === "closed" && left.polygon).toHaveLength(6);
    expect(right.status === "closed" && right.polygon).toEqual([
      { x: 4058, y: 120 },
      { x: 7880, y: 120 },
      { x: 7880, y: 2943 },
      { x: 4058, y: 2943 },
    ]);
  });
});

describe("Zustand der Räume (6.5)", () => {
  const seeds = { a: { x: 1000, y: 1000 }, b: { x: 6000, y: 1000 } };
  const base = () => [...box(0, 0, 8000, 3000), w("mid", 4000, 0, 4000, 3000, 115)];

  test("Trennwand gelöscht: beide verschmolzen; zusätzlich Außenwand weg: nur offen", () => {
    const rooms = [
      { id: "a", seed: seeds.a, polygon: [] },
      { id: "b", seed: seeds.b, polygon: [] },
    ];
    const merged = roomStatuses(
      base().filter((x) => x.id !== "mid"),
      rooms,
    );
    expect(merged.get("a")).toEqual({ status: "merged", with: ["b"] });
    expect(merged.get("b")).toEqual({ status: "merged", with: ["a"] });
    const open = roomStatuses(
      base().filter((x) => x.id !== "mid" && x.id !== "n"),
      rooms,
    );
    expect(open.get("a")?.status).toBe("open");
    expect(open.get("b")?.status).toBe("open");
  });

  test("Änderung an Raum A lässt die Kontur von Raum B unverändert", () => {
    const rooms = [
      { id: "a", seed: seeds.a, polygon: [] },
      { id: "b", seed: seeds.b, polygon: [] },
    ];
    const before = roomStatuses(base(), rooms).get("b");
    const walls = base();
    walls[3] = w("w", -200, 3000, -200, 0); // Westwand von A verschoben
    walls[0] = w("s", -200, 0, 8000, 0);
    walls[2] = w("n", 8000, 3000, -200, 3000);
    const after = roomStatuses(walls, rooms);
    expect(after.get("b")).toEqual(before);
    expect(after.get("a")).not.toEqual(roomStatuses(base(), rooms).get("a"));
  });
});

describe("Kanonische Form und Fläche", () => {
  test("Umlauf, Startpunkt, doppelte und kollineare Punkte", () => {
    const messy = [
      { x: 0, y: 3000.4 },
      { x: 4000, y: 3000 },
      { x: 4000, y: 1500 },
      { x: 4000.2, y: 0 },
      { x: 2000, y: 0 },
      { x: 2000, y: 0 },
      { x: 0, y: 0 },
    ];
    expect(canonicalPolygon(messy)).toEqual([
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 3000 },
      { x: 0, y: 3000 },
    ]);
  });

  test("fertige Fläche: 4000 × 3000 roh mit 15 mm Putz = 3970 × 2970", () => {
    const poly = [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 3000 },
      { x: 0, y: 3000 },
    ];
    expect(finishedArea(poly, 15)).toBeCloseTo(3970 * 2970, 0);
    expect(finishedArea(poly, 0)).toBe(12e6);
  });
});
