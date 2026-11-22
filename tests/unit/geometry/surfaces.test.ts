import {
  DEFAULT_LENGTH_ALLOWANCE,
  DEFAULT_INSTALL_ZONES,
} from "../../../src/model/default-catalog";
import {
  bearing,
  deriveRoomViews,
  deriveSurfaces,
  directionName,
  freeSurfaces,
  sections,
  sector,
  viewOpenings,
  wallSides,
} from "../../../src/geometry/surfaces";
import { loadProject } from "../../../src/io/load";
import type { Project, Room, Wall } from "../../../src/model/types";
import { readFixture } from "../fixtures";

const EG = "e0g1k2m3";

function klein(): Project {
  const r = loadProject(readFixture("klein"));
  if (r.status !== "ok") throw new Error();
  return r.project;
}

function wall(
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  kind: Wall["kind"] = "exterior",
  t = 240,
): Wall {
  return {
    id,
    storeyId: "st000001",
    kind,
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thicknessMm: t,
  };
}

function project(walls: Wall[], rooms: Room[] = [], northDeg = 0): Project {
  return {
    schemaVersion: 4,
    name: "T",
    settings: {
      northDeg,
      installZones: structuredClone(DEFAULT_INSTALL_ZONES),
      lengthAllowance: { ...DEFAULT_LENGTH_ALLOWANCE },
      teReservePercent: 25,
      actuatorReservePercent: 20,
    },
    catalog: { deviceTypes: [], lineTypes: [], furnitureTypes: [] },
    devices: [],
    furniture: [],
    routeNodes: [],
    routeSegments: [],
    cables: [],
    boards: [],
    circuits: [],
    knxLines: [],
    knxAssignments: [],
    suppressedWarnings: [],
    storeys: [
      {
        id: "st000001",
        name: "EG",
        slug: "eg",
        elevationMm: 0,
        rawHeightMm: 2500,
        defaults: { floorBuildupMm: 120, plasterMm: 15, suspendedMm: 0 },
      },
    ],
    walls,
    rooms,
    openings: [],
  };
}

const viewsOf = (p: Project, roomId: string) => deriveRoomViews(p).get(roomId)!;
const names = (p: Project, roomId: string) => viewsOf(p, roomId).map((v) => v.name);

describe("Flächen (7.1)", () => {
  test("je Wand zwei Seiten über die ganze Länge, dazu Decke und Boden je Raum", () => {
    const p = klein();
    const surfaces = deriveSurfaces(p);
    expect(surfaces.filter((s) => s.kind === "wall-side")).toHaveLength(14);
    expect(surfaces.filter((s) => s.kind === "floor")).toHaveLength(4);
    expect(surfaces.filter((s) => s.kind === "ceiling")).toHaveLength(4);
    expect(surfaces.find((s) => s.ref === "ceiling:r1kueche")!.contour[0]).toEqual({
      u: -150,
      v: 150,
    });
    expect(surfaces.find((s) => s.ref === "floor:r1kueche")!.contour[0]).toEqual({
      u: 150,
      v: 150,
    });
  });

  test("u-Richtung: R beginnt am Achsanfang, L am Achsende", () => {
    const sides = wallSides(project([wall("a", 0, 0, 4000, 0)]), "st000001");
    const r = sides.find((s) => s.side === "R")!;
    const l = sides.find((s) => s.side === "L")!;
    expect(r.origin).toEqual({ x: 0, y: -120 });
    expect(r.uDir).toEqual({ x: 1, y: 0 });
    expect(l.origin).toEqual({ x: 4000, y: 120 });
    expect(l.uDir).toEqual({ x: -1, y: 0 });
    expect([r.uMin, r.uMax, l.uMin, l.uMax]).toEqual([0, 4000, 0, 4000]);
  });

  test("Innenwand zwischen zwei Räumen: je Seite ein Raum", () => {
    const secs = sections(klein(), EG).filter((s) => s.ref.startsWith("wall:1bih0wst"));
    expect(secs.map((s) => [s.ref, s.roomId]).sort()).toEqual([
      ["wall:1bih0wst:L", "r3bad00a"],
      ["wall:1bih0wst:R", "r1kueche"],
    ]);
  });

  test("Außenwand mit Raum: Seite ohne Raum ist außen; ohne Raum: L, umschaltbar", () => {
    const p = klein();
    const free = freeSurfaces(p, EG);
    expect(free.find((f) => f.wallId === "0aw1s0ud")).toMatchObject({
      ref: "wall:0aw1s0ud:R",
      name: "Süd außen",
      outside: true,
    });
    const lone = project([wall("a", 0, 0, 4000, 0)]);
    expect(freeSurfaces(lone, "st000001").find((f) => f.outside)?.ref).toBe("wall:a:L");
    lone.walls[0]!.outsideSide = "R";
    expect(freeSurfaces(lone, "st000001").find((f) => f.outside)?.ref).toBe("wall:a:R");
  });

  test("geteilter Raum behält die Flächen-IDs der bestehenden Wände", () => {
    const p = klein();
    const before = deriveSurfaces(p)
      .filter((s) => s.kind === "wall-side")
      .map((s) => s.ref);
    p.walls.push(wall("split001", 150, 1500, 3940, 1500, "interior", 100));
    p.walls[p.walls.length - 1]!.storeyId = EG;
    const after = deriveSurfaces(p)
      .filter((s) => s.kind === "wall-side")
      .map((s) => s.ref);
    expect(after).toEqual(expect.arrayContaining(before));
  });

  test("Überlappung 0,5 mm grenzt nicht an, 1 mm schon", () => {
    const walls = [wall("a", 0, 0, 4000, 0)];
    const room = (x: number): Room => ({
      id: "ro000001",
      storeyId: "st000001",
      name: "R",
      seed: { x: 0, y: 0 },
      polygon: [
        { x: x, y: 120 },
        { x: x + 2000, y: 120 },
        { x: x + 2000, y: 2000 },
        { x: x, y: 2000 },
      ],
    });
    expect(sections(project(walls, [room(3999.5)]), "st000001")).toHaveLength(0);
    expect(sections(project(walls, [room(3999)]), "st000001")).toHaveLength(1);
  });
});

describe("Raumansichten (7.2)", () => {
  test("Rechteck: Wand Nord, Ost, Süd, West; Nachbarn links/rechts wie im Raum", () => {
    const p = klein();
    expect(names(p, "r1kueche")).toEqual(["Wand Nord", "Wand Ost", "Wand Süd", "Wand West"]);
    const v = Object.fromEntries(viewsOf(p, "r1kueche").map((x) => [x.name, x]));
    expect(v["Wand Süd"]!.left).toBe(v["Wand Ost"]!.key);
    expect(v["Wand Süd"]!.right).toBe(v["Wand West"]!.key);
    expect(v["Wand Ost"]!.left).toBe(v["Wand Nord"]!.key);
  });

  test("Wandseite an zwei Räumen: zwei Ansichten derselben Fläche", () => {
    const p = klein();
    // Südseite der Mittelwand (1aiv0ert läuft nach +y; L zeigt nach −x, R nach +x)
    const kitchenEast = viewsOf(p, "r1kueche").find((v) => v.name === "Wand Ost")!;
    const bathEast = viewsOf(p, "r3bad00a").find((v) => v.name === "Wand Ost")!;
    expect(kitchenEast.ref).toBe(bathEast.ref);
    // L-Seite: u läuft vom Achsende (y = 6000) her, das Bad liegt daher vor der Küche
    expect(bathEast.section.uTo).toBeLessThanOrEqual(kitchenEast.section.uFrom);
  });

  test("unterschiedlicher Fußbodenaufbau (Spec-Scenario): v je Abschnitt ab OKFF", () => {
    const p = klein();
    p.rooms.find((r) => r.id === "r1kueche")!.floorBuildupMm = 100;
    const bath = viewsOf(p, "r3bad00a").find((v) => v.name === "Wand Ost")!;
    const kitchen = viewsOf(p, "r1kueche").find((v) => v.name === "Wand Ost")!;
    expect(1000 + bath.floorBuildupMm).toBe(1140);
    expect(1000 + kitchen.floorBuildupMm).toBe(1100);
  });

  test("L-förmiger Raum: Wand Nord 1 und 2, im Uhrzeigersinn um den Schwerpunkt ab Nord", () => {
    const walls = [
      wall("s", 0, 0, 8000, 0),
      wall("e", 8000, 0, 8000, 6000),
      wall("n", 8000, 6000, 0, 6000),
      wall("w", 0, 6000, 0, 0),
      wall("i1", 4000, 6000, 4000, 3000, "interior", 115),
      wall("i2", 4000, 3000, 8000, 3000, "interior", 115),
    ];
    const L: Room = {
      id: "roomlll1",
      storeyId: "st000001",
      name: "L",
      seed: { x: 1000, y: 1000 },
      polygon: [
        { x: 120, y: 120 },
        { x: 7880, y: 120 },
        { x: 7880, y: 2943 },
        { x: 3943, y: 2943 },
        { x: 3943, y: 5880 },
        { x: 120, y: 5880 },
      ],
    };
    const views = viewsOf(project(walls, [L]), "roomlll1");
    expect(views.map((v) => v.name)).toEqual([
      "Wand Nord 1",
      "Wand Nord 2",
      "Wand Ost 1",
      "Wand Ost 2",
      "Wand Süd",
      "Wand West",
    ]);
    expect(views[0]!.base[0].y).toBeCloseTo(2942.5, 6); // der rechte, niedrigere Abschnitt kommt zuerst
  });

  test("Sektoren halboffen: genau 22,5° gehört zum nächsten Sektor", () => {
    expect(sector(bearing({ x: 0, y: 1 }, 0))).toBe(0);
    expect(sector(bearing({ x: 0, y: 1 }, -22.5))).toBe(1); // Peilung 22,5° → Nordost
    expect(sector(bearing({ x: 0, y: 1 }, -22.4))).toBe(0);
    expect(sector(bearing({ x: 0, y: 1 }, 22.5))).toBe(0); // Peilung 337,5° → Nord
    expect(directionName(4)).toBe("Süd");
  });

  test("Nordrichtung 90°: bisherige Wand Ost heißt Wand Nord", () => {
    const p = klein();
    const eastRef = viewsOf(p, "r1kueche").find((v) => v.name === "Wand Ost")!.ref;
    p.settings.northDeg = 90;
    expect(viewsOf(p, "r1kueche").find((v) => v.ref === eastRef)!.name).toBe("Wand Nord");
  });

  test("Außenseite und Innenwand ohne Raum (Spec-Scenario)", () => {
    // Südwand eines Gebäudes: Außenseite zeigt nach Süden (hier über outsideSide, da kein Raum angelegt ist)
    const p = project([
      { ...wall("s", 0, 0, 4000, 0), outsideSide: "R" },
      wall("i", 6000, 0, 6000, 3000, "interior", 115),
    ]);
    const free = freeSurfaces(p, "st000001");
    expect(free.map((f) => f.name)).toEqual([
      "Wandseite Nord",
      "Wandseite Ost",
      "Süd außen",
      "Wandseite West",
    ]);
    expect(free.filter((f) => f.outside).map((f) => f.name)).toEqual(["Süd außen"]);
  });

  test("frei stehende Wand: beide Seiten gehören zum Raum, keine Nachbarn", () => {
    const walls = [
      wall("s", 0, 0, 6000, 0),
      wall("e", 6000, 0, 6000, 4000),
      wall("n", 6000, 4000, 0, 4000),
      wall("w", 0, 4000, 0, 0),
      wall("f", 2000, 2000, 3500, 2000, "interior", 115),
    ];
    const room: Room = {
      id: "ro000001",
      storeyId: "st000001",
      name: "W",
      seed: { x: 1000, y: 1000 },
      polygon: [
        { x: 120, y: 120 },
        { x: 5880, y: 120 },
        { x: 5880, y: 3880 },
        { x: 120, y: 3880 },
      ],
    };
    const views = viewsOf(project(walls, [room]), "ro000001");
    const free = views.filter((v) => v.freeStanding);
    expect(free).toHaveLength(2);
    expect(free.every((v) => v.left === null && v.right === null)).toBe(true);
    expect(views).toHaveLength(6);
  });
});

describe("Wandansicht: fertige Maße (7.3)", () => {
  test("Fenster 1010 × 1385, Brüstung 900, Aufbau 120, Putz 15: Breite 980, Brüstung 780, Sturz 2150", () => {
    const p = klein();
    const o = p.openings.find((x) => x.id === "o1fenstr")!;
    o.heightMm = 1385;
    const side = wallSides(p, EG).find((s) => s.ref === "wall:0aw1s0ud:L")!;
    const [v] = viewOpenings(p, side, 120, 15, false);
    expect(v!.uTo - v!.uFrom).toBe(980);
    expect(v!.vFrom).toBe(780);
    expect(v!.vTo).toBe(2150);
    expect(v!.raw.widthMm).toBe(1010);
  });

  test("Estrich wird dicker (Spec-Scenario): Brüstung 820 → 780 über OKFF, roh bleibt 900", () => {
    const p = klein();
    const side = wallSides(p, EG).find((s) => s.ref === "wall:0aw1s0ud:L")!;
    expect(viewOpenings(p, side, 80, 15, false)[0]!.vFrom).toBe(820);
    expect(viewOpenings(p, side, 120, 15, false)[0]!.vFrom).toBe(780);
    expect(p.openings.find((x) => x.id === "o1fenstr")!.sillMm).toBe(900);
  });

  test("Aufsatzkasten 250 mm direkt über dem Fenster in der Innenansicht; Vorbaukasten nur außen", () => {
    const p = klein();
    const o = p.openings.find((x) => x.id === "o1fenstr")!;
    o.shutterBox = { position: "top", heightMm: 250 };
    const kitchenSouth = viewsOf(p, "r1kueche").find((v) => v.name === "Wand Süd")!;
    const win = kitchenSouth.openings[0]!;
    expect(win.shutter).toEqual({
      uFrom: win.raw.uFrom,
      uTo: win.raw.uTo,
      vFrom: win.raw.vTo,
      vTo: win.raw.vTo + 250,
      position: "top",
    });
    o.shutterBox = { position: "outside", heightMm: 300 };
    expect(
      viewsOf(p, "r1kueche").find((v) => v.name === "Wand Süd")!.openings[0]!.shutter,
    ).toBeUndefined();
    const outside = freeSurfaces(p, EG).find((f) => f.name === "Süd außen")!;
    expect(outside.openings[0]!.shutter).toMatchObject({
      position: "outside",
      vFrom: 2150,
      vTo: 2450,
    });
  });

  test("Kniestock (Spec-Scenario): Traufwand endet 900 mm über OKFF, Giebelwand mit schrägem Anschnitt", () => {
    const r = loadProject(readFixture("dg"));
    if (r.status !== "ok") throw new Error();
    const p = r.project;
    const room = p.rooms[0]!;
    room.plasterMm = 0;
    const views = viewsOf(p, room.id);
    const eave = views.find((v) => v.name === "Wand Süd")!;
    expect(eave.top.every((t) => Math.abs(t.v - 900) < 1e-6)).toBe(true);
    const gable = views.find((v) => v.name === "Wand Ost")!;
    // Blick nach Osten: links Norden mit flacher Decke (2450 − 100 = 2350), rechts die Traufe bei 900
    expect(gable.top[0]!.v).toBeCloseTo(2350, 6);
    expect(gable.top.at(-1)!.v).toBeCloseTo(900, 6);
    expect(gable.top).toHaveLength(3);
    expect(deriveSurfaces(p).some((s) => s.ref === `slope:${room.id}:${room.slopes![0]!.id}`)).toBe(
      true,
    );
  });
});

describe("Niedrige Wand (6.2, Spec-Scenario)", () => {
  test("Brüstungswand 1100 mm endet in der Wandansicht 1100 mm über Rohfußboden", () => {
    const walls = [
      wall("s", 0, 0, 6000, 0),
      wall("e", 6000, 0, 6000, 4000),
      wall("n", 6000, 4000, 0, 4000),
      wall("w", 0, 4000, 0, 0),
      { ...wall("f", 2000, 2000, 3500, 2000, "interior", 115), rawHeightMm: 1100 },
    ];
    const room: Room = {
      id: "ro000001",
      storeyId: "st000001",
      name: "W",
      seed: { x: 1000, y: 1000 },
      polygon: [
        { x: 120, y: 120 },
        { x: 5880, y: 120 },
        { x: 5880, y: 3880 },
        { x: 120, y: 3880 },
      ],
    };
    const p = project(walls, [room]);
    const low = viewsOf(p, "ro000001").filter((v) => v.wallId === "f");
    expect(low).toHaveLength(2);
    for (const v of low) expect(v.top.every((t) => t.v + v.floorBuildupMm === 1100)).toBe(true);
    // ganze Wandseite und Fläche bis 1100 über Rohfußboden
    expect(
      deriveSurfaces(p)
        .find((s) => s.ref === "wall:f:L")!
        .contour.map((c) => c.v),
    ).toContain(1100);
    // die hohen Wände reichen bis zur fertigen Decke 2500 − 15 − 120
    expect(viewsOf(p, "ro000001").find((v) => v.wallId === "s")!.top[0]!.v).toBe(2365);
  });
});
