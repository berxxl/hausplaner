import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { loadProject } from "../../../src/io/load";
import { projectToFiles } from "../../../src/io/project-files";
import { suggestNextStorey } from "../../../src/model/factory";
import { newProject } from "../../../src/model/factory";
import { createProjectStore } from "../../../src/store/history";
import { AUTOSAVE_DELAY_MS, createSaveController } from "../../../src/store/save";
import { deleteStorey } from "../../../src/store/commands";
import { Workspace } from "../../../src/ui/Workspace";
import { readFixture } from "../fixtures";
import { mockApi } from "../mock-api";

function open(name = "klein") {
  const files = readFixture(name);
  const result = loadProject(files);
  if (result.status !== "ok") throw new Error();
  const store = createProjectStore(result.project);
  const server = mockApi(files);
  const save = createSaveController(store, server.api, result.contents);
  render(<Workspace store={store} save={save} />);
  return { store, save, server };
}

const treeNames = () =>
  within(screen.getByRole("tree", { name: "Geschosse" }))
    .getAllByRole("treeitem")
    .filter((i) => i.getAttribute("aria-level") === "1")
    .map((i) => i.getAttribute("aria-label"));

function addStorey(name: string, elevation?: string) {
  fireEvent.click(screen.getByRole("button", { name: "Geschoss hinzufügen" }));
  const dialog = screen.getByRole("dialog", { name: "Geschoss hinzufügen" });
  fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: name } });
  if (elevation !== undefined) {
    const field = within(dialog).getByLabelText("Höhenlage Rohfußboden");
    fireEvent.change(field, { target: { value: elevation } });
    fireEvent.blur(field);
  }
  fireEvent.click(within(dialog).getByRole("button", { name: "Hinzufügen" }));
}

describe("Geschosse (5.1)", () => {
  test("Vorschlag aus dem höchsten Geschoss: Höhenlage + Rohbauhöhe + 300, Werte übernommen", () => {
    const p = newProject("X");
    p.storeys[0]!.defaults = { floorBuildupMm: 100, plasterMm: 10, suspendedMm: 50 };
    expect(suggestNextStorey(p)).toEqual({
      elevationMm: 2800,
      rawHeightMm: 2500,
      defaults: { floorBuildupMm: 100, plasterMm: 10, suspendedMm: 50 },
    });
  });

  test("Dialog schlägt 2800 mm vor; Reihenfolge KG, EG, OG nach Höhenlage", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Geschoss hinzufügen" }));
    const dialog = screen.getByRole("dialog", { name: "Geschoss hinzufügen" });
    expect(within(dialog).getByLabelText("Höhenlage Rohfußboden")).toHaveValue("2800");
    expect(within(dialog).getByLabelText("Rohbauhöhe")).toHaveValue("2500");
    fireEvent.click(within(dialog).getByRole("button", { name: "Abbrechen" }));

    addStorey("OG");
    addStorey("KG", "-2600");
    expect(treeNames()).toEqual(["KG", "EG", "OG"]);
    expect(screen.getByRole("treeitem", { name: "KG" })).toHaveAttribute("aria-selected", "true");
  });

  test("gleiche Höhenlage: Sortierung nach Name", () => {
    open();
    addStorey("Zwischen", "0");
    addStorey("Anbau", "0");
    expect(treeNames()).toEqual(["Anbau", "EG", "Zwischen"]);
  });

  test("Umbenennen ändert den Dateinamen nicht", () => {
    const { store } = open();
    fireEvent.click(screen.getByRole("treeitem", { name: "EG" }));
    const props = screen.getByRole("complementary", { name: "Eigenschaften" });
    const name = within(props).getByLabelText("Name");
    fireEvent.change(name, { target: { value: "Erdgeschoss" } });
    fireEvent.keyDown(name, { key: "Enter" });
    expect(screen.getByRole("treeitem", { name: "Erdgeschoss" })).toBeInTheDocument();
    expect(props).toHaveTextContent("Datei: geschosse/eg.yaml");
    expect(Object.keys(projectToFiles(store.getState().project))).toContain("geschosse/eg.yaml");
    expect(store.undoLabel()).toBe("Geschoss umbenennen");
  });

  test("Höhen und Standardaufbauten bearbeiten; Rohbauhöhe 0 wird abgelehnt", () => {
    const { store } = open();
    fireEvent.click(screen.getByRole("treeitem", { name: "EG" }));
    const props = screen.getByRole("complementary", { name: "Eigenschaften" });
    const set = (label: string, value: string) => {
      const input = within(props).getByLabelText(label);
      fireEvent.change(input, { target: { value } });
      fireEvent.blur(input);
    };
    set("Abhängung", "40");
    set("Fußbodenaufbau", "0,14 m");
    set("Rohbauhöhe", "0");
    const eg = store.getState().project.storeys[0]!;
    expect(eg.defaults).toEqual({ floorBuildupMm: 140, plasterMm: 15, suspendedMm: 40 });
    expect(eg.rawHeightMm).toBe(2500);
  });

  test("neues Geschoss bekommt einen eindeutigen Slug", () => {
    const { store } = open();
    addStorey("EG", "3000");
    expect(
      store
        .getState()
        .project.storeys.map((s) => s.slug)
        .sort(),
    ).toEqual(["eg", "eg-2"]);
  });
});

describe("Geschoss löschen (5.2)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test("ein Befehl; Speichern löscht die Datei; nach Rückgängig wird sie wieder geschrieben", async () => {
    const { store, server } = open();
    const original = server.files()!["geschosse/eg.yaml"]!;
    act(() => store.execute(deleteStorey("e0g1k2m3")));
    const p = store.getState().project;
    expect([p.storeys, p.walls, p.rooms, p.openings].map((l) => l.length)).toEqual([0, 0, 0, 0]);
    expect(store.getState().undoStack.map((e) => e.label)).toEqual(["Geschoss löschen"]);
    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS));
    expect(server.api.putFiles).toHaveBeenLastCalledWith({ "geschosse/eg.yaml": null });
    expect(server.files()!["geschosse/eg.yaml"]).toBeUndefined();

    act(() => store.undo());
    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS));
    expect(server.files()!["geschosse/eg.yaml"]).toBe(original);
  });

  test("über die Eigenschaften; Auswahl und aktives Geschoss wechseln", () => {
    open();
    fireEvent.click(screen.getByRole("treeitem", { name: "EG" }));
    fireEvent.click(screen.getByRole("button", { name: "Geschoss löschen" }));
    expect(screen.queryByRole("treeitem")).toBeNull();
    expect(screen.getByRole("complementary", { name: "Eigenschaften" })).toHaveTextContent(
      "Nichts ausgewählt",
    );
  });
});
