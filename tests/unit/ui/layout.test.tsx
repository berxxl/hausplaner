import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { loadProject } from "../../../src/io/load";
import { createProjectStore } from "../../../src/store/history";
import { createSaveController } from "../../../src/store/save";
import { Workspace } from "../../../src/ui/Workspace";
import { readFixture } from "../fixtures";
import { mockApi } from "../mock-api";

function open(mutate?: (files: Record<string, string>) => void) {
  const files = readFixture("klein");
  mutate?.(files);
  const result = loadProject(files);
  if (result.status !== "ok") throw new Error();
  const store = createProjectStore(result.project);
  const save = createSaveController(store, mockApi(files).api, result.contents);
  render(<Workspace store={store} save={save} />);
  return store;
}

describe("Layout-Gerüst (4.5)", () => {
  test("Baum, Editor mit Umschaltung, Eigenschaften, Warnungsleiste auf Deutsch", () => {
    open();
    expect(
      within(screen.getByRole("tree", { name: "Geschosse" })).getByRole("treeitem", { name: "EG" }),
    ).toBeInTheDocument();
    const tabs = within(screen.getByRole("tablist", { name: "Ansicht" })).getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Grundriss", "Fläche", "3D"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.click(tabs[2]!);
    expect(tabs[2]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("3D");
    expect(screen.getByRole("complementary", { name: "Eigenschaften" })).toHaveTextContent(
      "Nichts ausgewählt",
    );
    expect(screen.getByRole("contentinfo", { name: "Warnungen" })).toHaveTextContent(
      "Keine Warnungen",
    );
  });

  test("Klick auf Geschoss im Baum wählt es aus und zeigt seine Eigenschaften", () => {
    open();
    fireEvent.click(screen.getByRole("treeitem", { name: "EG" }));
    expect(screen.getByRole("treeitem", { name: "EG" })).toHaveAttribute("aria-selected", "true");
    const props = screen.getByRole("complementary", { name: "Eigenschaften" });
    expect(within(props).getByLabelText("Rohbauhöhe")).toHaveValue("2500");
  });

  test("Warnungsleiste: Anzahl, Liste, Aktion „Löschen“ für Öffnung ohne Wand, rückgängig machbar", () => {
    const store = open((files) => {
      files["geschosse/eg.yaml"] = files["geschosse/eg.yaml"]!.replace(
        'wallId: "0aw1s0ud"',
        'wallId: "zzzzzzzz"',
      );
    });
    const bar = screen.getByRole("contentinfo", { name: "Warnungen" });
    const toggle = within(bar).getByRole("button", { name: "1 Warnung" });
    fireEvent.click(toggle);
    const list = within(bar).getByRole("list", { name: "Warnungsliste" });
    expect(list).toHaveTextContent("Öffnung ohne Wand (zzzzzzzz)");
    fireEvent.click(
      within(list).getByRole("button", { name: "Löschen: Öffnung ohne Wand (zzzzzzzz)" }),
    );
    expect(within(bar).getByRole("button", { name: "Keine Warnungen" })).toBeInTheDocument();
    expect(store.getState().project.openings.map((o) => o.id)).toEqual(["o2tuer00"]);
    expect(store.undoLabel()).toBe("Öffnung löschen");
    act(() => store.undo());
    expect(within(bar).getByRole("button", { name: "1 Warnung" })).toBeInTheDocument();
  });
});
