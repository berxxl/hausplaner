// Leitungen im Trassennetz (Tasks 5.1, 5.3, 6.1)
import {
  cableLength,
  compatibleLineTypes,
  formatCableLength,
  isPathConnected,
  occupancy,
  orderChain,
  routedLength,
  suggestPath,
} from "../../../src/geometry/cables";
import { moveParallel } from "../../../src/geometry/wall-edit";
import { loadProject } from "../../../src/io/load";
import type { Cable, Project } from "../../../src/model/types";
import { applyWallEdit, wallGeoms } from "../../../src/store/building";
import { createProjectStore } from "../../../src/store/history";
import { drawSegment, makeNode } from "../../../src/store/routes";
import { readFixture } from "../fixtures";

const EG = "e0g1k2m3";

function m3(): Project {
  const r = loadProject(readFixture("m3"));
  if (r.status !== "ok") throw new Error();
  return r.project;
}

const cable = (p: Project, id: string) => p.cables.find((c) => c.id === id)!;
const C1 = ["s1stich1", "s3zone02", "s4hoch01", "s5decke1"];

describe("Wegvorschlag (5.1)", () => {
  test("kürzester Weg zwischen zusammenhängenden Geräten (Spec-Scenario „Automatischer Weg“)", () => {
    const p = m3();
    expect(suggestPath(p, "d2schalt", "d3decke1")).toEqual(C1);
    expect(suggestPath(p, "d3decke1", "d2schalt")).toEqual([...C1].reverse());
  });

  test("Weg über den Deckendurchbruch ins OG", () => {
    expect(suggestPath(m3(), "d3decke1", "d7bodog1")).toEqual(["s8decke2", "s9kern01", "saboden1"]);
  });

  test("ohne Verbindung kein Weg (Spec-Scenario „Kein Weg“)", () => {
    expect(suggestPath(m3(), "d2schalt", "d1steck1")).toEqual([]);
  });

  test("gleich lange Wege: lexikografisch kleinere Segmentfolge", () => {
    const store = createProjectStore(m3());
    const p = () => store.getState().project;
    const W = "wall:1bih0wst:R";
    // zweites Segment parallel zu s1stich1 zwischen denselben Knoten, gleich lang, kleinere ID
    store.execute(
      drawSegment({ segment: { id: "s0paral1", a: "n2zone01", b: "n1schalt", surface: W } }),
    );
    expect(suggestPath(p(), "d2schalt", "d3decke1")[0]).toBe("s0paral1");
  });

  test("Zusammenhang und Kette ordnen", () => {
    const p = m3();
    expect(isPathConnected(p, cable(p, "c1licht1"))).toBe(true);
    expect(isPathConnected(p, { ...cable(p, "c1licht1"), path: ["s1stich1", "s4hoch01"] })).toBe(
      false,
    );
    expect(isPathConnected(p, cable(p, "c3ohne01"))).toBe(false);
    expect(
      orderChain(p, cable(p, "c1licht1"), ["s5decke1", "s1stich1", "s4hoch01", "s3zone02"]),
    ).toEqual(C1);
    expect(orderChain(p, cable(p, "c1licht1"), ["s5decke1", "s1stich1"])).toBeNull();
  });
});

describe("Länge (5.3)", () => {
  test("Trasse + Zuschläge + Verschnitt; Anzeige in m", () => {
    const p = m3();
    // 1015 + 1500 + 300 + 1425 = 4240 mm Trasse
    expect(routedLength(p, cable(p, "c1licht1"))).toBe(4240);
    expect(cableLength(p, cable(p, "c1licht1"))).toBeCloseTo((4240 + 600) * 1.1, 6);
    expect(formatCableLength(cableLength(p, cable(p, "c1licht1")))).toBe("5,3 m");
    expect(cableLength(p, cable(p, "c3ohne01"))).toBeNull();
    expect(formatCableLength(null)).toBe("–");
  });

  test("8,4 m Trasse von einer Dose zu einem Schalter ergibt 9,9 m (Spec-Scenario „Längenberechnung“)", () => {
    const p = m3();
    const W = "wall:0aw1s0ud:L";
    p.devices.push({
      id: "d8schal2",
      storeyId: EG,
      label: "Schalter Süd",
      typeId: "switch",
      status: "planned",
      placement: { kind: "surface", surface: W, u: 7800, v: 2100, rotationDeg: 0 },
    });
    const n = (id: string, u: number, v: number, deviceId?: string) =>
      makeNode(p, id, [{ surface: W, u, v }], deviceId);
    p.routeNodes.push(
      n("nsteck01", 1200, 300, "d1steck1"),
      n("nknick01", 1200, 2100),
      n("nschal02", 7800, 2100, "d8schal2"),
    );
    const seg = (id: string, a: string, b: string) => ({
      id,
      storeyId: EG,
      a,
      b,
      kind: "surface" as const,
      surface: W,
      status: "planned" as const,
    });
    p.routeSegments.push(
      seg("ssued001", "nsteck01", "nknick01"),
      seg("ssued002", "nknick01", "nschal02"),
    );
    const c: Cable = {
      id: "cs000001",
      label: "x",
      lineTypeId: "nym-j-3x1-5",
      status: "planned",
      from: { deviceId: "d1steck1" },
      to: { deviceId: "d8schal2" },
      path: ["ssued001", "ssued002"],
    };
    expect(routedLength(p, c)).toBe(8400);
    expect(formatCableLength(cableLength(p, c))).toBe("9,9 m");
    p.settings.lengthAllowance = { perDeviceMm: 500, wastePercent: 0 };
    expect(cableLength(p, c)).toBe(9400);
  });

  test("Wand verschoben: Deckensegment am Übergang wird länger, Leitungslänge folgt (Spec-Scenario „Wand verschoben“)", () => {
    const store = createProjectStore(m3());
    const before = routedLength(
      store.getState().project,
      cable(store.getState().project, "c1licht1"),
    )!;
    const p = store.getState().project;
    // Wand Küche/Bad (läuft nach +x) um 200 mm nach Norden
    store.execute(
      applyWallEdit(EG, moveParallel(wallGeoms(p, EG), "1bih0wst", 200), "Wand verschieben"),
    );
    const q = store.getState().project;
    expect(q.routeNodes.find((x) => x.id === "n5decke1")!.anchors[1]).toEqual({
      surface: "ceiling:r1kueche",
      u: -2000,
      v: 3125,
    });
    expect(routedLength(q, cable(q, "c1licht1"))).toBe(before + 200);
  });
});

describe("Typen und Belegung (5.2, 6.1)", () => {
  test("Leitungstypen passend zu beiden Geräten", () => {
    const p = m3();
    const ids = compatibleLineTypes(p, "d2schalt", "d3decke1").map((t) => t.id);
    expect(ids).toContain("nym-j-3x1-5");
    expect(ids).not.toContain("cat-7");
  });

  test("Belegung: Anzahl, Querschnittssumme, Füllgrad im Leerrohr M20", () => {
    const p = m3();
    const o = occupancy(p, "s3zone02");
    expect(o.cables.map((c) => c.id)).toEqual(["c1licht1"]);
    // NYM-J 3×1,5 mit 8 mm Außendurchmesser in M20 (14,1 mm innen)
    expect(o.areaMm2).toBeCloseTo(Math.PI * 16, 6);
    expect(o.fill).toBeCloseTo(64 / (14.1 * 14.1), 6);
    expect(occupancy(p, "s1stich1").fill).toBeNull();
  });
});
