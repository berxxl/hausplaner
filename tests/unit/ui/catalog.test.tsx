// Katalogfenster (2.2)
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { loadProject } from "../../../src/io/load";
import { createProjectStore } from "../../../src/store/history";
import { createSaveController } from "../../../src/store/save";
import { DeviceTypePicker } from "../../../src/ui/catalog/DeviceTypePicker";
import { Workspace } from "../../../src/ui/Workspace";
import { readFixture } from "../fixtures";
import { mockApi } from "../mock-api";

function open() {
  const files = readFixture("m2");
  const result = loadProject(files);
  if (result.status !== "ok") throw new Error();
  const store = createProjectStore(result.project);
  render(
    <Workspace
      store={store}
      save={createSaveController(store, mockApi(files).api, result.contents)}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Katalog" }));
  return { store, dialog: screen.getByRole("dialog", { name: "Katalog" }) };
}

const option = (dialog: HTMLElement, name: string) =>
  within(within(dialog).getByRole("listbox", { name: "Typen" })).getByRole("option", {
    name: new RegExp(`^${name}$`),
  });

function commit(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: "Enter" });
}

describe("Katalogfenster (2.2)", () => {
  test("Steckdose kopieren, als „Steckdose USB-C“ mit 1050 mm speichern, steht in der Geräteauswahl (Spec-Scenario „Eigener Typ“)", () => {
    const { store, dialog } = open();
    fireEvent.click(option(dialog, "Steckdose"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Kopieren" }));
    const form = within(dialog).getByRole("group", { name: "Eigenschaften des Typs" });
    expect(within(form).getByLabelText("Name")).toHaveValue("Steckdose Kopie");
    commit(within(form).getByLabelText("Name"), "Steckdose USB-C");
    commit(within(form).getByLabelText("Standardhöhe über OKFF"), "1050");
    const created = store
      .getState()
      .project.catalog.deviceTypes.find(
        (t) => t.name === "Steckdose USB-C" && t.id !== "k7usb2c4",
      )!;
    expect(created.defaultHeightMm).toBe(1050);
    expect(created.mounting).toEqual(["wall", "floor"]);
    // Die Geräteauswahl (Werkzeug „Gerät“) bietet den neuen Typ an
    render(
      <DeviceTypePicker
        types={store.getState().project.catalog.deviceTypes}
        value={null}
        onChange={() => {}}
      />,
    );
    const select = screen.getByLabelText("Gerätetyp");
    const strom = within(select).getByRole("group", { name: "Strom" });
    expect(
      within(strom)
        .getAllByRole("option")
        .filter((o) => o.textContent === "Steckdose USB-C"),
    ).toHaveLength(2); // aus der Fixture und die neue Kopie
  });

  test("Geräteauswahl: nur platzierbare Typen, Suche filtert", () => {
    const { store } = open();
    render(
      <DeviceTypePicker
        types={store.getState().project.catalog.deviceTypes}
        value={null}
        onChange={() => {}}
      />,
    );
    const select = screen.getByLabelText("Gerätetyp");
    // Schaltaktor sitzt nur auf der Hutschiene (ab M4)
    expect(within(select).queryByRole("option", { name: "Schaltaktor" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Gerätetyp suchen"), { target: { value: "melder" } });
    expect(
      within(select)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["– wählen –", "Präsenzmelder KNX"]);
  });

  test("verwendete Montageart abwählen wird abgelehnt, ohne Undo-Schritt", () => {
    const { store, dialog } = open();
    fireEvent.click(option(dialog, "Steckdose"));
    const before = store.getState().undoStack.length;
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Boden" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Montageart Boden wird von 1 Gerät verwendet",
    );
    expect(store.getState().undoStack).toHaveLength(before);
    expect(within(dialog).getByRole("checkbox", { name: "Boden" })).toBeChecked();
  });

  test("Löschen eines verwendeten Typs nennt die Anzahl, unbenutzter wird gelöscht und Rückgängig stellt ihn her", () => {
    const { store, dialog } = open();
    fireEvent.click(option(dialog, "Schalter"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Löschen" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Typ wird von 1 Gerät verwendet");
    fireEvent.click(option(dialog, "Präsenzmelder KNX"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Löschen" }));
    expect(within(dialog).queryByRole("option", { name: /Präsenzmelder/ })).toBeNull();
    act(() => store.undo());
    expect(option(dialog, "Präsenzmelder KNX")).toBeInTheDocument();
  });

  test("SVG-Symbol importieren: bereinigt und als Symbol des Typs übernommen (Teil von Spec-Scenario „Eigenes Symbol“)", async () => {
    const { store, dialog } = open();
    fireEvent.click(option(dialog, "Schalter"));
    const file = new File(
      [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" onclick="x()"/></svg>',
      ],
      "schalter.svg",
      { type: "image/svg+xml" },
    );
    fireEvent.change(within(dialog).getByLabelText("SVG-Datei für das Symbol"), {
      target: { files: [file] },
    });
    await waitFor(() =>
      expect(
        store.getState().project.catalog.deviceTypes.find((t) => t.id === "switch")!.symbol,
      ).toBe("<circle cx='50' cy='50' r='40'/>"),
    );
    expect(
      within(dialog).getByRole("img", { name: "Symbol Schalter" }).querySelector("circle"),
    ).not.toBeNull();
  });

  test("Neu legt Leitungs- und Möbeltypen an; Möbelmaße änderbar", () => {
    const { store, dialog } = open();
    fireEvent.click(within(dialog).getByRole("tab", { name: "Möbel" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Neu" }));
    const form = within(dialog).getByRole("group", { name: "Eigenschaften des Typs" });
    commit(within(form).getByLabelText("Höhe über OKFF"), "1450");
    expect(
      store.getState().project.catalog.furnitureTypes.find((t) => t.name === "Neues Möbel")!
        .elevationMm,
    ).toBe(1450);
    fireEvent.click(within(dialog).getByRole("tab", { name: "Leitungen" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Neu" }));
    expect(store.getState().project.catalog.lineTypes.map((t) => t.name)).toContain(
      "Neuer Leitungstyp",
    );
  });
});
