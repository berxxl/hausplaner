// Grundriss als Blatt (Task 5.1)
import type { ExportOptions } from "../../../src/export/compose";
import { planSheet } from "../../../src/export/plan";
import type { Item } from "../../../src/export/sheet";
import { loadProject } from "../../../src/io/load";
import { newProject } from "../../../src/model/factory";
import type { Device, Project } from "../../../src/model/types";
import { readFixture } from "../fixtures";

const EG = "e0g1k2m3";
const ALL: ExportOptions = {
  format: { paper: "A3", orientation: "landscape" },
  scale: 50,
  project: "Test",
  date: "22.11.2026",
  planStatus: "Entwurf",
  trades: ["power", "knx", "data", "conduit", "refrigerant", "condensate", "other"],
  statuses: ["planned", "installed", "verified"],
};

function m4(mutate?: (p: Project) => void): Project {
  const r = loadProject(readFixture("m4"));
  if (r.status !== "ok") throw new Error();
  mutate?.(r.project);
  return r.project;
}

const data = (items: Item[], prefix: string) => items.filter((i) => i.data?.startsWith(prefix));
const ids = (items: Item[], prefix: string) =>
  data(items, prefix).map((i) => i.data!.slice(prefix.length));

describe("Grundriss (5.1)", () => {
  test("5 m lange Wand misst bei 1:50 auf dem Blatt 100 mm (Spec-Scenario „Maßhaltig drucken“)", () => {
    const p = newProject("Test");
    const storeyId = p.storeys[0]!.id;
    p.walls.push({
      id: "w5meter1",
      storeyId,
      kind: "interior",
      start: { x: 0, y: 0 },
      end: { x: 5000, y: 0 },
      thicknessMm: 200,
    });
    const r = planSheet(p, storeyId, ALL)!;
    const wall = data(r.sheet.items, "wall:w5meter1")[0] as Extract<Item, { kind: "poly" }>;
    const xs = wall.points.map(([x]) => x);
    const ys = wall.points.map(([, y]) => y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(100, 6);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(4, 6);
    expect(r.fit).toEqual({ ok: true, needed: 50 });
    expect(r.content).toBe("Grundriss EG");
    expect(r.sheet.widthMm).toBe(420);
  });

  test("Legende zeigt genau Steckdose, Schalter und Präsenzmelder (Spec-Scenario „Legende“)", () => {
    const p = m4((q) => {
      q.boards = [];
      q.devices = q.devices.filter((d) => ["d1steck1", "d2schalt"].includes(d.id));
      q.devices.push({
        id: "dpraes01",
        label: "Präsenz Küche",
        typeId: "presence-knx",
        status: "planned",
        storeyId: EG,
        placement: {
          kind: "surface",
          surface: "ceiling:r1kueche",
          u: -2000,
          v: 1500,
          rotationDeg: 0,
        },
      } as Device);
    });
    const items = planSheet(p, EG, ALL)!.sheet.items;
    expect(ids(items, "legend:")).toEqual(["Präsenzmelder KNX", "Schalter", "Steckdose"]);
    expect(ids(items, "device:").sort()).toEqual(["d1steck1", "d2schalt", "dpraes01"]);
  });

  test("nur verlegt und geprüft: Plankopf „Bestandsplan“, geplante Geräte fehlen (Spec-Scenario „Bestandsplan“)", () => {
    const r = planSheet(m4(), EG, { ...ALL, statuses: ["installed", "verified"] })!;
    expect(r.sheet.title.planKind).toBe("Bestandsplan");
    expect(data(r.sheet.items, "title:planKind")[0]).toMatchObject({ text: "Bestandsplan" });
    expect(ids(r.sheet.items, "device:").sort()).toEqual(["d2schalt", "d3decke1"]);
    expect(planSheet(m4(), EG, ALL)!.sheet.title.planKind).toBe("Planung");
  });

  test("nur KNX: keine Stromgeräte, Verteiler, Wände und Räume bleiben; Filter im Plankopf", () => {
    const r = planSheet(m4(), EG, { ...ALL, trades: ["knx"] })!;
    expect(ids(r.sheet.items, "device:")).toEqual([]);
    expect(ids(r.sheet.items, "board:").sort()).toEqual(["b1zaehl1", "b2uveg01", "b4medien"]);
    expect(ids(r.sheet.items, "room:").sort()).toEqual([
      "r1kueche",
      "r2wohnen",
      "r3bad00a",
      "r4schlaf",
    ]);
    expect(r.sheet.title.filter).toBe("KNX");
  });

  test("Stromkreis-Kurzname unter dem Gerät, Raum mit Fläche, Nordpfeil, Maßstabsleiste", () => {
    const items = planSheet(m4(), EG, ALL)!.sheet.items;
    expect(data(items, "circuit-label:d1steck1")[0]).toMatchObject({ text: "F1" });
    expect(data(items, "area:r1kueche")[0]).toMatchObject({
      text: expect.stringMatching(/^\d+,\d\d m²$/),
    });
    expect(data(items, "north-arrow")).toHaveLength(1);
    expect(data(items, "scale-bar")).toHaveLength(1);
  });

  test("passt nicht: meldet den nötigen Maßstab", () => {
    const r = planSheet(m4(), EG, {
      ...ALL,
      scale: 20,
      format: { paper: "A4", orientation: "portrait" },
    })!;
    expect(r.fit!.ok).toBe(false);
    expect(r.fit!.needed).toBeGreaterThan(20);
  });
});
