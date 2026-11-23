// Kamerapositionen (Task 6.2)
import { loadProject } from "../../../src/io/load";
import { projectToFiles } from "../../../src/io/project-files";
import { createProjectStore } from "../../../src/store/history";
import {
  cameraViewByName,
  deleteCameraView,
  nextViewName,
  saveCameraView,
} from "../../../src/store/views3d";
import { readFixture } from "../fixtures";

function store() {
  const r = loadProject(readFixture("m6"));
  if (r.status !== "ok") throw new Error();
  return createProjectStore(r.project);
}
const P = (s: ReturnType<typeof store>) => s.getState().project;
const cam = { position: { x: 1000.4, y: -200.6, z: 1600 }, target: { x: 0, y: 0, z: 900 } };

test("speichern rundet auf mm, überschreiben behält die ID, löschen; alles mit Undo", () => {
  const s = store();
  expect(nextViewName(P(s))).toBe("Ansicht 1");
  const r = saveCameraView(P(s), { name: " Wohnen ", ...cam, upToStoreyId: null });
  if (!r.ok) throw new Error();
  s.execute(r.command);
  const v = cameraViewByName(P(s), "wohnen")!;
  expect(v).toEqual({
    id: r.id,
    name: "Wohnen",
    position: { x: 1000, y: -201, z: 1600 },
    target: { x: 0, y: 0, z: 900 },
  });
  expect(s.getState().undoStack.at(-1)!.label).toBe("Ansicht speichern");
  const again = saveCameraView(P(s), {
    name: "Wohnen",
    position: { x: 1, y: 2, z: 3 },
    target: { x: 4, y: 5, z: 6 },
    upToStoreyId: "e0g1k2m3",
  });
  if (!again.ok) throw new Error();
  expect(again.id).toBe(r.id);
  s.execute(again.command);
  expect(s.getState().undoStack.at(-1)!.label).toBe("Ansicht ändern");
  expect(P(s).cameraViews).toHaveLength(2);
  expect(cameraViewByName(P(s), "Wohnen")!.upToStoreyId).toBe("e0g1k2m3");
  s.execute(deleteCameraView(r.id));
  expect(P(s).cameraViews.map((x) => x.name)).toEqual(["Küche vom Esstisch"]);
  s.undo();
  s.undo();
  expect(cameraViewByName(P(s), "Wohnen")!.position).toEqual({ x: 1000, y: -201, z: 1600 });
  s.undo();
  expect(projectToFiles(P(s))).toEqual(readFixture("m6"));
});

test("leerer Name wird abgelehnt", () => {
  expect(saveCameraView(P(store()), { name: "  ", ...cam, upToStoreyId: null })).toEqual({
    ok: false,
    error: "Name fehlt",
  });
});
