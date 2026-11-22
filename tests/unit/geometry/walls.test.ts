import {
  axisFromDrawn,
  chainCorner,
  cornerNeighbors,
  isConnected,
  snapPoint,
  tConnections,
  wallBody,
  type WallGeom,
} from "../../../src/geometry/walls";

const w = (id: string, x1: number, y1: number, x2: number, y2: number, t = 240): WallGeom => ({
  id,
  start: { x: x1, y: y1 },
  end: { x: x2, y: y2 },
  thicknessMm: t,
});

const round = (pts: { x: number; y: number }[]) =>
  pts.map((p) => ({ x: Math.round(p.x * 1000) / 1000, y: Math.round(p.y * 1000) / 1000 }));

describe("Anschlüsse", () => {
  const south = w("s", 0, 0, 4000, 0);
  const east = w("e", 4005, 10, 4000, 3000); // Ecke mit 11 mm Abstand
  const inner = w("i", 2000, 3000, 2000, 15); // T an Süd
  const walls = [south, east, inner];

  test("Eckanschluss ≤ 20 mm", () => {
    expect(cornerNeighbors(walls, south, "end")).toEqual([{ wallId: "e", end: "start" }]);
    expect(cornerNeighbors(walls, south, "start")).toEqual([]);
  });

  test("T-Anschluss: Endpunkt auf fremder Achse, nicht an deren Enden", () => {
    expect(tConnections(walls, south)).toEqual([{ wallId: "i", end: "end" }]);
    expect(isConnected(walls, inner, "end")).toBe(true);
    expect(isConnected(walls, inner, "start")).toBe(false);
  });
});

describe("Wandkörper mit Gehrungen (6.2)", () => {
  test("freie Wand: Rechteck um die Achse", () => {
    expect(wallBody([w("a", 0, 0, 4000, 0)], w("a", 0, 0, 4000, 0))).toEqual([
      { x: 0, y: -120 },
      { x: 4000, y: -120 },
      { x: 4000, y: 120 },
      { x: 0, y: 120 },
    ]);
  });

  test("L-Anschluss: Gehrung an Innen- und Außenecke, auch bei unterschiedlicher Dicke", () => {
    const a = w("a", 0, 0, 4000, 0, 240);
    const b = w("b", 4000, 0, 4000, 3000, 365);
    expect(round(wallBody([a, b], a))).toEqual([
      { x: 0, y: -120 },
      { x: 4182.5, y: -120 },
      { x: 3817.5, y: 120 },
      { x: 0, y: 120 },
    ]);
    expect(round(wallBody([a, b], b))).toEqual([
      { x: 4182.5, y: -120 },
      { x: 4182.5, y: 3000 },
      { x: 3817.5, y: 3000 },
      { x: 3817.5, y: 120 },
    ]);
  });

  test("T-Anschluss: anschließende Wand endet rechtwinklig an der Achse", () => {
    const a = w("a", 0, 0, 4000, 0);
    const t = w("t", 2000, 3000, 2000, 0, 115);
    expect(round(wallBody([a, t], t))).toEqual([
      { x: 1942.5, y: 3000 },
      { x: 1942.5, y: 0 },
      { x: 2057.5, y: 0 },
      { x: 2057.5, y: 3000 },
    ]);
  });

  test("Kreuzanschluss: zwei durchgehende Wände bleiben Rechtecke", () => {
    const a = w("a", 0, 1000, 4000, 1000);
    const b = w("b", 2000, 0, 2000, 3000);
    expect(wallBody([a, b], a)).toEqual(wallBody([a], a));
    expect(wallBody([a, b], b)).toEqual(wallBody([b], b));
  });

  test("kollineare Fortsetzung: rechtwinklige Stoßfuge", () => {
    const a = w("a", 0, 0, 2000, 0);
    const b = w("b", 2000, 0, 4000, 0);
    expect(wallBody([a, b], a)).toEqual(wallBody([a], a));
  });

  test("drei Wände an einem Punkt: jede Kante trifft die zugewandte Kante der Nachbarwand", () => {
    const a = w("a", 0, 0, -3000, 0);
    const b = w("b", 0, 0, 3000, 0);
    const c = w("c", 0, 0, 0, 3000);
    const body = round(wallBody([a, b, c], c));
    expect(body).toEqual([
      { x: 120, y: 120 },
      { x: 120, y: 3000 },
      { x: -120, y: 3000 },
      { x: -120, y: 120 },
    ]);
  });
});

describe("Zeichenmodi (6.2)", () => {
  test("linke Kante (Spec-Scenario): Achse 120 mm rechts davon", () => {
    expect(axisFromDrawn({ x: 0, y: 0 }, { x: 4000, y: 0 }, 240, "left")).toEqual({
      start: { x: 0, y: -120 },
      end: { x: 4000, y: -120 },
    });
    expect(axisFromDrawn({ x: 0, y: 0 }, { x: 4000, y: 0 }, 240, "right").start).toEqual({
      x: 0,
      y: 120,
    });
    expect(axisFromDrawn({ x: 0, y: 0 }, { x: 4000, y: 0 }, 240, "axis").start).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe("Fang (6.2)", () => {
  const walls = [w("a", 0, 0, 4000, 0)];

  test("Wandende bis halbe Dicke + Fangradius hat Vorrang (R.2)", () => {
    expect(snapPoint({ x: 4012, y: 10 }, walls, 20)).toMatchObject({
      point: { x: 4000, y: 0 },
      kind: "endpoint",
    });
    // 240 mm dick: bis 120 + 20 mm
    expect(snapPoint({ x: 4130, y: 0 }, walls, 20).kind).toBe("endpoint");
    expect(snapPoint({ x: 4150, y: 0 }, walls, 20).kind).not.toBe("endpoint");
  });

  test("Achse aus dem Wandkörper heraus bis halbe Dicke + Fangradius (R.2)", () => {
    expect(snapPoint({ x: 1500, y: 19 }, walls, 20)).toMatchObject({
      point: { x: 1500, y: 0 },
      kind: "axis",
    });
    expect(snapPoint({ x: 1500, y: 139 }, walls, 20)).toMatchObject({
      point: { x: 1500, y: 0 },
      kind: "axis",
    });
    expect(snapPoint({ x: 1500, y: 141 }, walls, 20).kind).toBe("none");
  });

  test("Wand bis an die Oberfläche gezeichnet endet auf der Achse (Spec-Scenario „Wand bis an die Oberfläche gezeichnet“)", () => {
    // Innenseite der 240-mm-Wand bei y = 120; Zug von (2000, 3000) nach unten bis an die Oberfläche
    const s = snapPoint({ x: 2000, y: 120 }, walls, 20, { x: 2000, y: 3000 });
    expect(s).toMatchObject({ kind: "axis", orthogonal: true });
    expect(s.point.x).toBeCloseTo(2000, 9);
    expect(s.point.y).toBeCloseTo(0, 9);
  });

  test("orthogonal bis 5°: 4,9° rastet, 5,1° nicht", () => {
    const from = { x: 0, y: 1000 };
    const at = (deg: number) => ({
      x: 3000 * Math.cos((deg * Math.PI) / 180),
      y: 1000 + 3000 * Math.sin((deg * Math.PI) / 180),
    });
    const snapped = snapPoint(at(4.9), walls, 20, from);
    expect(snapped.kind).toBe("orthogonal");
    expect(snapped.point.y).toBeCloseTo(1000, 9);
    expect(snapPoint(at(5.1), walls, 20, from).kind).toBe("none");
  });

  test("orthogonal und Achse zusammen: Schnitt der waagerechten/senkrechten mit der Achse", () => {
    const from = { x: 1000, y: 3000 };
    const s = snapPoint({ x: 1010, y: 12 }, walls, 20, from);
    expect(s).toMatchObject({ kind: "axis", orthogonal: true });
    expect(s.point.x).toBeCloseTo(1000, 9);
    expect(s.point.y).toBeCloseTo(0, 9);
  });
});

describe("Ecken im Wandzug (Kantenmodus)", () => {
  const a = { x: 0, y: 0 };
  const b = { x: 4000, y: 0 };
  const c = { x: 4000, y: 3000 };

  test("Achsen treffen sich im Schnittpunkt statt stumpf zu stoßen", () => {
    const first = axisFromDrawn(a, b, 240, "left");
    const second = axisFromDrawn(b, c, 240, "left");
    expect(first.end).toEqual({ x: 4000, y: -120 });
    expect(second.start).toEqual({ x: 4120, y: 0 });
    expect(chainCorner(first, second, b, 480)).toEqual({ x: 4120, y: -120 });
  });

  test("unterschiedliche Dicken: Schnittpunkt der versetzten Achsen", () => {
    const first = axisFromDrawn(a, b, 240, "left");
    const second = axisFromDrawn(b, c, 100, "left");
    expect(chainCorner(first, second, b, 340)).toEqual({ x: 4050, y: -120 });
  });

  test("Achsmodus: Ecke bleibt der Klickpunkt", () => {
    const first = axisFromDrawn(a, b, 240, "axis");
    const second = axisFromDrawn(b, c, 240, "axis");
    expect(chainCorner(first, second, b, 480)).toEqual(b);
  });

  test("gerade Fortsetzung oder sehr spitzer Winkel: keine Anpassung", () => {
    const first = axisFromDrawn(a, b, 240, "left");
    expect(chainCorner(first, axisFromDrawn(b, { x: 8000, y: 0 }, 240, "left"), b, 480)).toBeNull();
    // Rückwärts mit 2° Abweichung: Schnittpunkt läge weit hinter der Ecke
    const back = axisFromDrawn(b, { x: 0, y: 140 }, 240, "left");
    expect(chainCorner(first, back, b, 480)).toBeNull();
  });
});
