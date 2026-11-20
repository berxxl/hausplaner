import { roomPolygons, visibleStoreys, wallSolids } from "../../../src/geometry/model3d";
import { sortedStoreys } from "../../../src/io/project-files";
import { loadProject } from "../../../src/io/load";
import type { Project } from "../../../src/model/types";
import { readFixture } from "../fixtures";

function load(name: string): Project {
  const r = loadProject(readFixture(name));
  if (r.status !== "ok") throw new Error();
  return r.project;
}

describe("3D-Geometrie (8.1)", () => {
  test("Giebelwand unter der Schräge: schräger Abschluss, über die ganze Dicke", () => {
    const p = load("dg");
    const east = wallSolids(p, p.storeys[0]!.id).find((w) => w.wallId === "4kq9m2xa")!;
    // Achse (4000,0) → (4000,3000); Innenseite x = 3850; Schräge 1000 mm an y = 150, 45°, gekappt bei 2450
    expect(east.sMin).toBe(-150);
    expect(east.sMax).toBe(3150);
    const z = (s: number) => {
      const t = east.top;
      for (let i = 0; i < t.length - 1; i++)
        if (s >= t[i]!.s && s <= t[i + 1]!.s)
          return t[i]!.z + ((t[i + 1]!.z - t[i]!.z) * (s - t[i]!.s)) / (t[i + 1]!.s - t[i]!.s);
      return NaN;
    };
    expect(z(150)).toBeCloseTo(1000, 6);
    expect(z(1000)).toBeCloseTo(1850, 6);
    expect(z(1600)).toBeCloseTo(2450, 6);
    expect(z(3000)).toBe(2450);
    expect(east.top.map((t) => t.s)).toEqual([-150, 1600, 3150]);
  });

  test("Traufwand wird auf Kniestockhöhe gekappt; Nordwand bleibt voll hoch", () => {
    const p = load("dg");
    const solids = wallSolids(p, p.storeys[0]!.id);
    expect(
      solids.find((w) => w.wallId === "1c8e0v5r")!.top.every((t) => Math.abs(t.z - 1000) < 1e-6),
    ).toBe(true);
    expect(solids.find((w) => w.wallId === "a81kd0x2")!.top.every((t) => t.z === 2450)).toBe(true);
  });

  test("Fenster als Aussparung in Rohbaumaßen (6.7), niedrige Wand endet bei 1100 mm (6.2)", () => {
    const p = load("klein");
    const eg = p.storeys[0]!.id;
    const south = wallSolids(p, eg).find((w) => w.wallId === "0aw1s0ud")!;
    expect(south.holes).toEqual([{ openingId: "o1fenstr", s1: 1495, s2: 2505, z1: 900, z2: 2150 }]);
    p.walls.find((w) => w.id === "1bih0wst")!.rawHeightMm = 1100;
    expect(
      wallSolids(p, eg)
        .find((w) => w.wallId === "1bih0wst")!
        .top.every((t) => t.z === 1100),
    ).toBe(true);
  });

  test("Boden, flache Decke und Schräge des DG-Raums", () => {
    const p = load("dg");
    const polys = roomPolygons(p.rooms[0]!, p.storeys[0]!);
    expect(polys.map((x) => x.kind)).toEqual(["floor", "ceiling", "slope"]);
    const ceiling = polys.find((x) => x.kind === "ceiling")!;
    expect(Math.min(...ceiling.outline.map((q) => q.y))).toBeCloseTo(1600, 6); // ab hier ist die Decke flach
    const slope = polys.find((x) => x.kind === "slope")!;
    expect(slope.z({ x: 2000, y: 150 })).toBeCloseTo(1000, 6);
    expect(slope.z({ x: 2000, y: 1600 })).toBeCloseTo(2450, 6);
  });

  test("Geschosse nach Höhenlage gestapelt; „bis EG“ blendet höhere aus", () => {
    const p = load("klein");
    const eg = p.storeys[0]!;
    p.storeys.push(
      { ...eg, id: "og000001", name: "OG", slug: "og", elevationMm: 2800 },
      { ...eg, id: "kg000001", name: "KG", slug: "kg", elevationMm: -2600 },
      { ...eg, id: "dg000001", name: "DG", slug: "dg", elevationMm: 5600 },
    );
    expect(sortedStoreys(p).map((s) => s.name)).toEqual(["KG", "EG", "OG", "DG"]);
    expect(
      visibleStoreys(p, eg.id)
        .map((s) => s.name)
        .sort(),
    ).toEqual(["EG", "KG"]);
    expect(visibleStoreys(p, null)).toHaveLength(4);
  });
});
