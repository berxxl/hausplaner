import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { loadProject } from "../../../src/io/load";
import { createProjectStore } from "../../../src/store/history";
import { createSaveController } from "../../../src/store/save";
import { createViewStore } from "../../../src/store/view";
import { Tree } from "../../../src/ui/Tree";
import { Workspace } from "../../../src/ui/Workspace";
import { readFixture } from "../fixtures";
import { mockApi } from "../mock-api";

function open() {
  const files = readFixture("klein");
  const result = loadProject(files);
  if (result.status !== "ok") throw new Error();
  const store = createProjectStore(result.project);
  const server = mockApi(files);
  const save = createSaveController(store, server.api, result.contents);
  render(<Workspace store={store} save={save} />);
  return { store };
}

const tree = () => within(screen.getByRole("tree", { name: "Geschosse" }));
const item = (name: string) => tree().getByRole("treeitem", { name });

describe("Baum auf- und zuklappen", () => {
  test("Geschoss zuklappen blendet die Räume aus, Auswahl bleibt, Zustand übersteht das Neuladen", () => {
    open();
    expect(item("EG")).toHaveAttribute("aria-expanded", "true");
    expect(item("EG")).toHaveAttribute("aria-selected", "false");
    expect(tree().getByRole("treeitem", { name: "Küche" })).toBeInTheDocument();

    fireEvent.click(tree().getByRole("button", { name: "EG zuklappen" }));
    expect(item("EG")).toHaveAttribute("aria-expanded", "false");
    expect(item("EG")).toHaveAttribute("aria-selected", "false");
    expect(tree().queryByRole("treeitem", { name: "Küche" })).toBeNull();

    // neu laden: Zustand aus localStorage
    cleanup();
    open();
    expect(item("EG")).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(tree().getByRole("button", { name: "EG aufklappen" }));
    expect(tree().getByRole("treeitem", { name: "Küche" })).toBeInTheDocument();
  });

  test("Pfeiltasten klappen Räume auf und zu, Flächen bleiben Blätter", () => {
    open();
    const kitchen = item("Küche");
    const row = kitchen.querySelector(".tree__item")!;
    fireEvent.keyDown(row, { key: "ArrowLeft" });
    expect(kitchen).toHaveAttribute("aria-expanded", "false");
    expect(within(kitchen).queryByRole("treeitem", { name: "Decke" })).toBeNull();
    fireEvent.keyDown(row, { key: "ArrowLeft" });
    expect(kitchen).toHaveAttribute("aria-expanded", "false");
    fireEvent.keyDown(row, { key: "ArrowRight" });
    expect(kitchen).toHaveAttribute("aria-expanded", "true");
    expect(within(kitchen).getByRole("treeitem", { name: "Decke" })).not.toHaveAttribute(
      "aria-expanded",
    );
  });

  test("zugeklappter Raum ist markiert, wenn eine seiner Wände ausgewählt ist (Spec-Scenario)", () => {
    const { store } = open();
    const view = createViewStore({ activeStoreyId: "e0g1k2m3" });
    cleanup();
    render(<Tree store={store} view={view} />);
    fireEvent.click(tree().getByRole("button", { name: "Küche zuklappen" }));
    expect(item("Küche")).not.toHaveAttribute("data-marked");
    expect(item("EG")).not.toHaveAttribute("data-marked");
    // Wand Nord der Küche: wie eine Auswahl im Grundriss
    const wallId = "1bih0wst";
    act(() => view.select({ kind: "wall", id: wallId }));
    expect(item("Küche")).toHaveAttribute("data-marked", "true");
    // aufgeklappt trägt der Raum selbst keine Markierung, sondern die Wandansicht
    fireEvent.click(tree().getByRole("button", { name: "Küche aufklappen" }));
    expect(item("Küche")).not.toHaveAttribute("data-marked");
    expect(within(item("Küche")).getByRole("treeitem", { name: "Wand Nord" })).toHaveAttribute(
      "data-marked",
      "true",
    );
    // Geschoss zugeklappt: das Geschoss trägt die Markierung
    fireEvent.click(tree().getByRole("button", { name: "EG zuklappen" }));
    expect(item("EG")).toHaveAttribute("data-marked", "true");
  });
});
