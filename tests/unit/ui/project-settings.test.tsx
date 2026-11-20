import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { loadProject } from "../../../src/io/load";
import { createProjectStore } from "../../../src/store/history";
import { createSaveController } from "../../../src/store/save";
import { Workspace } from "../../../src/ui/Workspace";
import { readFixture } from "../fixtures";
import { mockApi } from "../mock-api";

function open() {
  const files = readFixture("klein");
  const result = loadProject(files);
  if (result.status !== "ok") throw new Error();
  const store = createProjectStore(result.project);
  render(
    <Workspace
      store={store}
      save={createSaveController(store, mockApi(files).api, result.contents)}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Projekteinstellungen" }));
  return { store, dialog: screen.getByRole("dialog", { name: "Projekteinstellungen" }) };
}

describe("Projekteinstellungen (4.8)", () => {
  test("Projektname ändern, rückgängig", () => {
    const { store, dialog } = open();
    const input = within(dialog).getByLabelText("Projektname");
    fireEvent.change(input, { target: { value: "Banat" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Banat");
    expect(store.undoLabel()).toBe("Projekt umbenennen");
    act(() => store.undo());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Kleines Projekt");
    expect(input).toHaveValue("Kleines Projekt");
  });

  test("Nordrichtung mit Komma oder Punkt, normalisiert auf 0–360°, rückgängig", () => {
    const { store, dialog } = open();
    const input = within(dialog).getByLabelText(/Nordrichtung/);
    expect(input).toHaveValue("0,0");
    fireEvent.change(input, { target: { value: "90.04" } });
    fireEvent.blur(input);
    expect(store.getState().project.settings.northDeg).toBe(90);
    expect(input).toHaveValue("90,0");
    fireEvent.change(input, { target: { value: "-45,5" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(store.getState().project.settings.northDeg).toBe(314.5);
    act(() => store.undo());
    expect(store.getState().project.settings.northDeg).toBe(90);
    expect(store.undoLabel()).toBe("Nordrichtung ändern");
  });

  test("ungültige Eingabe wird verworfen, Escape stellt den Wert her", () => {
    const { store, dialog } = open();
    const input = within(dialog).getByLabelText(/Nordrichtung/);
    fireEvent.change(input, { target: { value: "Nord" } });
    fireEvent.blur(input);
    expect(input).toHaveValue("0,0");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(store.canUndo()).toBe(false);
    fireEvent.change(input, { target: { value: "12" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveValue("0,0");
  });
});

test("Nordrichtung 90°: die Namen der Wandansichten im Baum folgen, Rückgängig stellt sie her (4.8)", () => {
  const { store, dialog } = open();
  const kitchen = () =>
    within(screen.getByRole("tree")).getAllByRole("treeitem", { name: "Küche" })[0]!;
  const doorView = () =>
    [...kitchen().querySelectorAll('[role="treeitem"]')]
      .find((x) => {
        fireEvent.click(x);
        return screen
          .getByRole("img", { name: "Flächenansicht" })
          .querySelector('[data-opening="o2tuer00"]');
      })
      ?.getAttribute("aria-label");
  fireEvent.click(within(dialog).getByRole("button", { name: "Schließen" }));
  expect(doorView()).toBe("Wand Ost");
  act(() =>
    store.execute({ label: "Nordrichtung ändern", run: (d) => void (d.settings.northDeg = 90) }),
  );
  expect(doorView()).toBe("Wand Nord");
  act(() => store.undo());
  expect(doorView()).toBe("Wand Ost");
});
