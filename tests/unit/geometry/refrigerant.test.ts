// Klimaverbindung, Kältemittellänge, Kondensatgefälle (Tasks 2.1, 2.2, 3.1)
import { loadProject } from "../../../src/io/load";
import {
  acConnection,
  condensateSlopes,
  refrigerantLinks,
} from "../../../src/geometry/refrigerant";
import type { Device, Project } from "../../../src/model/types";
import { computeWarnings } from "../../../src/rules";
import { readFixture } from "../fixtures";
import { M6_IDS as I } from "../io/fixture-m6.gen.test";

function m6(change?: (p: Project) => void): Project {
  const r = loadProject(readFixture("m6"));
  if (r.status !== "ok") throw new Error(JSON.stringify(r));
  const p = structuredClone(r.project);
  change?.(p);
  return p;
}

const keys = (p: Project, prefix: string) =>
  computeWarnings(p)
    .filter((w) => w.key.startsWith(prefix))
    .map((w) => w);
const node = (p: Project, id: string) => p.routeNodes.find((n) => n.id === id)!;
const cable = (p: Project, id: string) => p.cables.find((c) => c.id === id)!;
const outdoorType = (p: Project) => p.catalog.deviceTypes.find((t) => t.id === "ac-outdoor")!;

describe("Klimaverbindung (2.1)", () => {
  test("Innengerät Schlafen mit Außengerät, Kältemittel- und Kondensatleitung (Spec-Scenario „Split-Gerät Schlafzimmer“)", () => {
    const p = m6();
    const c = acConnection(p, I.indoor)!;
    expect(c.unit).toBe("indoor");
    expect(c.links).toHaveLength(1);
    expect(c.links[0]).toMatchObject({
      cableId: I.refrigerantCable,
      indoorId: I.indoor,
      outdoorId: I.outdoor,
      limits: { minLengthM: 3, maxLengthM: 25, prechargedLengthM: 7 },
      extraLengthMm: 0,
    });
    expect(c.links[0]!.lengthMm).toBeCloseTo(5901.66, 1);
    expect(c.condensate).toEqual([
      { cableId: I.condensateCable, drain: { deviceId: I.drain }, lengthMm: expect.any(Number) },
    ]);
    const out = acConnection(p, I.outdoor)!;
    expect(out.unit).toBe("outdoor");
    expect(out.links.map((l) => l.indoorId)).toEqual([I.indoor]);
    expect(out.condensate).toEqual([]);
    expect(acConnection(p, I.spots[0])).toBeNull();
  });

  test("drei Innengeräte an einem Multisplit-Außengerät (Spec-Scenario „Multisplit“)", () => {
    const p = m6((d) => {
      const outdoor = d.devices.find((x) => x.id === I.outdoor)!;
      outdoor.typeId = "ac-outdoor-multi-3";
      const indoor = d.devices.find((x) => x.id === I.indoor)!;
      for (const n of [2, 3]) {
        const id = `dkinnen${n}`;
        d.devices.push({ ...structuredClone(indoor), id, label: `Klima ${n}` } as Device);
        d.cables.push({
          id: `ckkalt0${n}`,
          label: `Kältemittel ${n}`,
          lineTypeId: "refrigerant-pair",
          status: "planned",
          from: { deviceId: I.outdoor },
          to: { deviceId: id },
          path: [],
        });
      }
    });
    const out = acConnection(p, I.outdoor)!;
    expect(out.links.map((l) => l.indoorId).sort()).toEqual([I.indoor, "dkinnen2", "dkinnen3"]);
    // ohne Weg keine Länge
    expect(out.links.filter((l) => l.lengthMm === null)).toHaveLength(2);
    expect(out.links.find((l) => l.indoorId === "dkinnen2")!.extraLengthMm).toBeNull();
  });

  test("9,5 m bei 7 m vorgefüllt ergibt 2,5 m Mehrlänge (Spec-Scenario „Nachfüllen nötig“)", () => {
    const routed = 4765.1499962501875;
    const p = m6((d) => {
      d.settings.lengthAllowance = {
        ...d.settings.lengthAllowance,
        wastePercent: (9500 / (routed + 600) - 1) * 100,
      };
    });
    const link = refrigerantLinks(p)[0]!;
    expect(link.lengthMm).toBeCloseTo(9500, 3);
    expect(link.extraLengthMm).toBeCloseTo(2500, 3);
  });
});

describe("Kältemittelregeln (2.2)", () => {
  test("Länge über der Höchstlänge meldet (Spec-Scenario „Zu lang“)", () => {
    const p = m6((d) => void (outdoorType(d).refrigerant!.maxLengthM = 5));
    expect(keys(p, "refrigerant-").map((w) => [w.key, w.text, w.target])).toEqual([
      [
        `refrigerant-too-long:${I.refrigerantCable}`,
        "Kältemittelleitung zu lang: Kältemittel Schlafen 5,9 m (höchstens 5 m)",
        { kind: "cable", id: I.refrigerantCable },
      ],
    ]);
    expect(m6().suppressedWarnings).not.toContain(`refrigerant-too-long:${I.refrigerantCable}`);
  });

  test("unter der Mindestlänge meldet, in den Grenzen nicht", () => {
    expect(keys(m6(), "refrigerant-")).toEqual([]);
    const p = m6((d) => void (outdoorType(d).refrigerant!.minLengthM = 7.5));
    expect(keys(p, "refrigerant-").map((w) => w.text)).toEqual([
      "Kältemittelleitung zu kurz: Kältemittel Schlafen 5,9 m (mindestens 7,5 m)",
    ]);
  });

  test("ohne Weg keine Längenwarnung", () => {
    const p = m6((d) => {
      outdoorType(d).refrigerant!.maxLengthM = 1;
      cable(d, I.refrigerantCable).path = [];
    });
    expect(keys(p, "refrigerant-too")).toEqual([]);
  });

  test("Kältemittelleitung zwischen zwei Innengeräten meldet „verbindet nicht Innen- und Außengerät“", () => {
    const p = m6((d) => {
      const indoor = d.devices.find((x) => x.id === I.indoor)!;
      d.devices.push({ ...structuredClone(indoor), id: "dkinnen2", label: "Klima 2" } as Device);
      d.cables.push({
        id: "ckinnen2",
        label: "Falsch",
        lineTypeId: "refrigerant-pair",
        status: "planned",
        from: { deviceId: I.indoor },
        to: { deviceId: "dkinnen2" },
        path: [],
      });
    });
    expect(keys(p, "refrigerant-ends").map((w) => w.text)).toEqual([
      "Kältemittelleitung verbindet nicht Innen- und Außengerät: Falsch",
    ]);
    // das zweite Innengerät hat keine Kondensatleitung
    expect(keys(p, "ac-without-condensate").map((w) => w.text)).toEqual([
      "Klima-Innengerät ohne Kondensatleitung: Klima 2",
    ]);
  });
});

describe("Kondensatgefälle (3.1)", () => {
  test("Segment steigt zum Ablauf an (Spec-Scenario „Steigung“)", () => {
    // außen 2300 mm über Rohfußboden liegt höher als das Innengerät (2100 + 120 Aufbau)
    const p = m6((d) => void (node(d, I.nodeOutside).anchors[0]!.v = 2300));
    const w = keys(p, "condensate-slope");
    expect(w.map((x) => [x.key, x.text, x.target])).toEqual([
      [
        `condensate-slope:${I.segPenetration}`,
        "Kondensat ohne Gefälle: Kondensat Schlafen (steigt an, mindestens 1,0 %)",
        { kind: "route-segment", id: I.segPenetration },
      ],
    ]);
  });

  test("senkrecht nach unten ergibt keine Warnung (Spec-Scenario „Senkrecht nach unten“)", () => {
    const p = m6();
    const slopes = condensateSlopes(p, cable(p, I.condensateCable))!;
    expect(slopes.map((s) => [s.segmentId, s.ok])).toEqual([
      [I.segPenetration, true],
      [I.segDown, true],
    ]);
    expect(slopes[1]).toMatchObject({ percent: null, dropMm: 1780 });
    expect(keys(p, "condensate-")).toEqual([]);
    expect(keys(p, "ac-without-condensate")).toEqual([]);
  });

  /** Kondensat über das waagerechte Segment außen (3000 mm) zum Außengerät. */
  const along = (v: number, swap = false) =>
    m6((d) => {
      node(d, I.nodeAlong).anchors[0]!.v = v;
      const ends = [{ deviceId: I.indoor }, { deviceId: I.outdoor }];
      d.cables.push({
        id: "ckwaage1",
        label: "Kondensat waagerecht",
        lineTypeId: "condensate",
        status: "planned",
        from: ends[swap ? 1 : 0]!,
        to: ends[swap ? 0 : 1]!,
        path: swap
          ? [I.segToOutdoor, I.segAlong, I.segPenetration]
          : [I.segPenetration, I.segAlong, I.segToOutdoor],
      });
    });

  test("0,5 % bei 1 % meldet, 1 % nicht; vertauschte Enden fließen trotzdem vom Innengerät weg", () => {
    expect(keys(along(2050), "condensate-slope")).toEqual([]);
    const flat = keys(along(2065), "condensate-slope");
    expect(flat.map((w) => w.text)).toEqual([
      "Kondensat ohne Gefälle: Kondensat waagerecht (0,5 %, mindestens 1,0 %)",
    ]);
    expect(keys(along(2065, true), "condensate-slope").map((w) => w.key)).toEqual([
      `condensate-slope:${I.segAlong}`,
    ]);
    const s = condensateSlopes(along(2050, true), cable(along(2050, true), "ckwaage1"))!;
    expect(s.find((x) => x.segmentId === I.segAlong)!.percent).toBeCloseTo(1, 5);
  });

  test("waagerechte Bohrung meldet; ein Segment zweier Leitungen meldet einmal", () => {
    const p = m6((d) => {
      node(d, I.nodeOutside).anchors[0]!.v = 2220;
      d.cables.push({
        ...structuredClone(cable(d, I.condensateCable)),
        id: "ckzweit1",
        label: "Zweite",
      });
    });
    const w = keys(p, "condensate-slope");
    expect(w.map((x) => x.key)).toEqual([`condensate-slope:${I.segPenetration}`]);
    expect(w[0]!.text).toBe("Kondensat ohne Gefälle: Kondensat Schlafen (0,0 %, mindestens 1,0 %)");
  });

  test("Mindestgefälle aus den Einstellungen", () => {
    // Bohrung: 140 mm Fall auf 315 mm, außen 30 mm auf 3000 mm (1 %)
    const p = along(2050);
    p.settings.condensateMinSlopePercent = 2;
    expect(keys(p, "condensate-slope").map((w) => w.text)).toEqual([
      "Kondensat ohne Gefälle: Kondensat waagerecht (1,0 %, mindestens 2,0 %)",
    ]);
  });
});
