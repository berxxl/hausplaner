// Gedachte Raumgrenze und Folge-Tasks (m4 R.1–R.3)
import { loadProject } from "../../../src/io/load";
import { projectToFiles } from "../../../src/io/project-files";
import { deriveRoomViews } from "../../../src/geometry/surfaces";
import { edgeAnchors } from "../../../src/geometry/routes";
import type { Project } from "../../../src/model/types";
import { computeWarnings } from "../../../src/rules";
import { addRoomBoundary, deleteRoomBoundaries, deleteWall } from "../../../src/store/building";
import { createProjectStore, type ProjectStore } from "../../../src/store/history";
import { readFixture } from "../fixtures";

const EG = "e0g1k2m3";

function klein(): ProjectStore {
  const r = loadProject(readFixture("klein"));
  if (r.status !== "ok") throw new Error();
  return createProjectStore(r.project);
}
const P = (s: ProjectStore): Project => s.getState().project;
const room = (s: ProjectStore, name: string) => P(s).rooms.find((r) => r.name === name)!;
const ys = (s: ProjectStore, name: string) => room(s, name).polygon.map((p) => p.y);

/** Wand Wohnen/Schlafen (y = 3000) entfernen und durch eine Raumgrenze ersetzen. */
function withBoundary(): ProjectStore {
  const s = klein();
  s.execute(deleteWall("1cih0ost"));
  expect(computeWarnings(P(s)).map((w) => w.key)).toContain(`room-merged:${room(s, "Wohnen").id}`);
  s.execute(
    addRoomBoundary({
      id: "g1grenz1",
      start: { x: 4000, y: 3000 },
      end: { x: 8000, y: 3000 },
      storeyId: EG,
    }),
  );
  return s;
}

describe("Gedachte Raumgrenze (R.1)", () => {
  test("Flur abgrenzen: zwei Räume, die an der Linie aneinandergrenzen, ohne Wandansicht entlang der Linie (Spec-Scenario „Flur abgrenzen“)", () => {
    const s = withBoundary();
    expect(s.undoLabel()).toBe("Raumgrenze zeichnen");
    expect(Math.max(...ys(s, "Wohnen"))).toBe(2999);
    expect(Math.min(...ys(s, "Schlafen"))).toBe(3001);
    expect(computeWarnings(P(s)).filter((w) => w.key.startsWith("room-"))).toEqual([]);
    const views = deriveRoomViews(P(s)).get(room(s, "Wohnen").id)!;
    // Nord, Ost, West aus Wänden; entlang der Grenze keine Ansicht
    expect(views.map((v) => v.name).sort()).toEqual(["Wand Ost", "Wand Süd", "Wand West"]);
  });

  test("Datei: roomBoundaries nach walls, Rundreise unverändert", () => {
    const s = withBoundary();
    const files = projectToFiles(P(s));
    expect(files["geschosse/eg.yaml"]).toContain(
      'roomBoundaries:\n  - id: "g1grenz1"\n    start: {x: 4000, y: 3000}\n    end: {x: 8000, y: 3000}\nrooms:',
    );
    const r = loadProject(files);
    if (r.status !== "ok") throw new Error();
    expect(r.project.roomBoundaries).toEqual([
      { id: "g1grenz1", start: { x: 4000, y: 3000 }, end: { x: 8000, y: 3000 }, storeyId: EG },
    ]);
    expect(projectToFiles(r.project)).toEqual(files);
  });

  test("Trasse über die Raumgrenze: Knoten am Deckenrand hat einen Anker im Nachbarraum (Spec-Scenario „Trasse über die Raumgrenze“)", () => {
    const s = withBoundary();
    const wohnen = room(s, "Wohnen").id;
    const schlafen = room(s, "Schlafen").id;
    // fertiger Rand der Wohnen-Decke an der Grenze: y = 2999 − 15 Putz = 2984; Decke u = −x
    expect(edgeAnchors(P(s), { surface: `ceiling:${wohnen}`, u: -6000, v: 2984 })).toEqual([
      { surface: `ceiling:${schlafen}`, u: -6000, v: 3016 },
    ]);
    expect(edgeAnchors(P(s), { surface: `floor:${schlafen}`, u: 5000, v: 3016 })).toEqual([
      { surface: `floor:${wohnen}`, u: 5000, v: 2984 },
    ]);
    // nicht am Rand: kein Übergang
    expect(edgeAnchors(P(s), { surface: `ceiling:${wohnen}`, u: -6000, v: 2900 })).toEqual([]);
  });

  test("Raumgrenze löschen: Räume als verschmolzen gemeldet, Rückgängig stellt her (Spec-Scenario „Raumgrenze löschen“)", () => {
    const s = withBoundary();
    const before = P(s);
    s.execute(deleteRoomBoundaries(["g1grenz1"]));
    expect(P(s).roomBoundaries).toEqual([]);
    expect(computeWarnings(P(s)).map((w) => w.key)).toContain(
      `room-merged:${room(s, "Wohnen").id}`,
    );
    s.undo();
    expect(P(s)).toEqual(before);
  });
});

describe("Keine Wandansichten ≤ 1 mm (R.3)", () => {
  test("Kerbe von 2 mm zwischen nicht verbundenen Wänden erzeugt keine Ansicht", () => {
    const s = klein();
    // Westwand der Küche um 2 mm versetzt, aber als eigene Wand: Kerbe in der Raumkontur
    s.execute({
      label: "Kerbe",
      run(d) {
        const w = d.walls.find((x) => x.id === "0dw4w0st")!;
        w.end = { x: 0, y: 1500 };
        d.walls.push({ ...w, id: "0dw4w0s2", start: { x: 2, y: 1500 }, end: { x: 2, y: 0 } });
      },
    });
    for (const views of deriveRoomViews(P(s)).values())
      for (const v of views) expect(v.finished.uTo - v.finished.uFrom).toBeGreaterThan(1);
  });
});
