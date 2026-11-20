import { createViewStore } from "../../../src/store/view";
import { activateWarning } from "../../../src/ui/warnings";
import { createProjectStore } from "../../../src/store/history";
import { loadProject } from "../../../src/io/load";
import { readFixture } from "../fixtures";

describe("Auswahlmodell (4.7)", () => {
  test("eine gemeinsame Auswahl für Geschoss, Wand, Raum, Öffnung, Schräge", () => {
    const view = createViewStore();
    const seen: unknown[] = [];
    view.subscribe((s) => seen.push(s.selection)); // alle Ansichten lesen denselben Zustand
    for (const kind of ["storey", "wall", "room", "opening", "slope"] as const) {
      view.select({ kind, id: `${kind}0001`.slice(0, 8) });
      expect(view.isSelected(kind, `${kind}0001`.slice(0, 8))).toBe(true);
    }
    expect(view.isSelected("wall", "wall0001")).toBe(false);
    view.select(null);
    expect(view.getState().selection).toBeNull();
    expect(seen).toHaveLength(6);
  });

  test("Auswahl wird verworfen, wenn das Objekt verschwindet", () => {
    const view = createViewStore();
    view.select({ kind: "wall", id: "0aw1s0ud" });
    view.prune(() => true);
    expect(view.getState().selection).not.toBeNull();
    view.prune(() => false);
    expect(view.getState().selection).toBeNull();
  });

  test("Klick auf eine Raumwarnung wählt den Raum im Grundriss seines Geschosses", () => {
    const result = loadProject(readFixture("klein"));
    if (result.status !== "ok") throw new Error();
    const store = createProjectStore(result.project);
    const view = createViewStore({ editor: "3d" });
    activateWarning(
      {
        key: "room-open:r1kueche",
        text: "Raum nicht geschlossen: Küche",
        target: { kind: "room", id: "r1kueche" },
      },
      store,
      view,
    );
    expect(view.getState()).toMatchObject({
      selection: { kind: "room", id: "r1kueche" },
      editor: "plan",
      activeStoreyId: "e0g1k2m3",
    });
  });
});
