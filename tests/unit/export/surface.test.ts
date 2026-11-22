// Flächen als Blatt mit Maßketten (Task 5.2)
import type { ExportOptions } from "../../../src/export/compose";
import type { Item } from "../../../src/export/sheet";
import { surfaceSheet } from "../../../src/export/surface";
import { deriveRoomViews } from "../../../src/geometry/surfaces";
import { loadProject } from "../../../src/io/load";
import type { Device, Project } from "../../../src/model/types";
import { readFixture } from "../fixtures";

const EG = "e0g1k2m3";
const KUECHE_WALL = "wall:1bih0wst:R";
const OPTS: ExportOptions = {
  format: { paper: "A3", orientation: "landscape" },
  scale: 20,
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

const socket = (id: string, u: number): Device =>
  ({
    id,
    label: id,
    typeId: "socket",
    status: "planned",
    storeyId: EG,
    placement: { kind: "surface", surface: KUECHE_WALL, u, v: 300, rotationDeg: 0 },
  }) as Device;

const dims = (items: Item[], axis: "u" | "v") =>
  items
    .filter(
      (i): i is Extract<Item, { kind: "text" }> =>
        i.kind === "text" && !!i.data?.startsWith(`dim-${axis}:`),
    )
    .map((i) => ({ ids: i.data!.slice(6).split(","), text: i.text }));

describe("Wandansicht mit Maßketten (5.2)", () => {
  test("drei Steckdosen je mit Abstand zur Ecke und Höhe über OKFF (Spec-Scenario „Dose bemaßt“)", () => {
    const p = m4((q) => {
      q.devices.push(socket("dsa00001", 1000), socket("dsa00002", 1500), socket("dsa00003", 2500));
    });
    const view = deriveRoomViews(p)
      .get("r1kueche")!
      .find((v) => v.ref === KUECHE_WALL)!;
    const r = surfaceSheet(p, { kind: "room-wall", key: view.key }, OPTS)!;
    expect(r.content).toBe(`Küche › ${view.name}`);
    expect(r.fit).toEqual({ ok: true, needed: 20 });
    const u = dims(r.sheet.items, "u");
    for (const [id, at] of [
      ["dsa00001", 1000],
      ["dsa00002", 1500],
      ["dsa00003", 2500],
    ] as const) {
      const d = u.find((x) => x.ids.includes(id));
      expect(d?.text).toBe(String(Math.round(at - view.finished.uFrom)));
    }
    // gleiche Höhe: ein Strich für alle drei, Wert über OKFF
    const v = dims(r.sheet.items, "v").find((x) => x.ids.includes("dsa00001"))!;
    expect(v.text).toBe("300");
    expect(v.ids).toEqual(expect.arrayContaining(["dsa00001", "dsa00002", "dsa00003"]));
    expect(r.sheet.items.some((i) => i.kind === "text" && i.text === "±0 OKFF")).toBe(true);
    expect(r.sheet.items.filter((i) => i.data?.startsWith("device:"))).toHaveLength(4);
  });

  test("Trassenknoten der Wand sind bemaßt", () => {
    const p = m4();
    const view = deriveRoomViews(p)
      .get("r1kueche")!
      .find((v) => v.ref === KUECHE_WALL)!;
    const r = surfaceSheet(p, { kind: "room-wall", key: view.key }, OPTS)!;
    const nodeIds = r.sheet.items
      .filter((i) => i.data?.startsWith("node:"))
      .map((i) => i.data!.slice(5));
    expect(nodeIds.length).toBeGreaterThan(0);
    const u = dims(r.sheet.items, "u").flatMap((d) => d.ids);
    const v = dims(r.sheet.items, "v").flatMap((d) => d.ids);
    for (const id of nodeIds) {
      expect(u).toContain(id);
      expect(v).toContain(id);
    }
  });

  test("Decke: bemaßt ab kleinster u und v der Kontur", () => {
    const r = surfaceSheet(m4(), { kind: "ceiling", roomId: "r1kueche" }, OPTS)!;
    expect(r.content).toBe("Küche › Decke");
    // Küche roh 150..3940 × 150..2940, Deckenspiegel u = −x; Auslass bei x 2000, y 1500
    expect(dims(r.sheet.items, "u").find((d) => d.ids.includes("d3decke1"))?.text).toBe("1940");
    expect(dims(r.sheet.items, "v").find((d) => d.ids.includes("d3decke1"))?.text).toBe("1350");
    expect(r.sheet.items.some((i) => i.kind === "text" && i.text.includes("OKFF"))).toBe(false);
  });
});
