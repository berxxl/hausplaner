// Editor „Listen“ (Task 3.1)
import { fireEvent, render, screen, within } from "@testing-library/react";
import { loadProject } from "../../../src/io/load";
import type { Project } from "../../../src/model/types";
import { createProjectStore } from "../../../src/store/history";
import { createViewStore } from "../../../src/store/view";
import { EditorArea } from "../../../src/ui/EditorArea";
import { ListsView } from "../../../src/ui/lists/ListsView";
import { Properties } from "../../../src/ui/Properties";
import { readFixture } from "../fixtures";

function setup(mutate?: (p: Project) => void) {
  const r = loadProject(readFixture("m4"));
  if (r.status !== "ok") throw new Error();
  mutate?.(r.project);
  const store = createProjectStore(r.project);
  const view = createViewStore({ editor: "lists" });
  return { store, view };
}

const rowTexts = (table: HTMLElement, col: number) =>
  within(table)
    .getAllByRole("row")
    .slice(1)
    .map((tr) => tr.querySelectorAll("td")[col]!.textContent);

describe("Editor „Listen“ (3.1)", () => {
  test("Tab „Listen“ zeigt die Geräteliste; Zeile „Rollladen Bad“ wählt das Gerät (Spec-Scenario „Gerät aus der Liste auswählen“)", () => {
    const { store, view } = setup((p) => {
      p.devices.find((d) => d.id === "daroll01")!.label = "Rollladen Bad";
    });
    render(
      <>
        <EditorArea store={store} view={view} />
        <Properties store={store} view={view} />
      </>,
    );
    expect(screen.getByRole("tab", { name: "Listen" })).toHaveAttribute("aria-selected", "true");
    const table = screen.getByRole("table", { name: "Geräte" });
    fireEvent.click(within(table).getByRole("cell", { name: "Rollladen Bad" }));
    expect(view.getState().selection).toEqual({ kind: "device", id: "daroll01" });
    const props = screen.getByRole("complementary", { name: "Eigenschaften" });
    expect(within(props).getByLabelText("Bezeichnung")).toHaveValue("Rollladen Bad");
  });

  test("Spaltenkopf sortiert auf- und absteigend", () => {
    const { store, view } = setup();
    render(<ListsView store={store} view={view} />);
    const table = screen.getByRole("table", { name: "Geräte" });
    fireEvent.click(within(table).getByRole("button", { name: "Bezeichnung" }));
    const asc = rowTexts(table, 0);
    expect(asc).toEqual([...asc].sort((a, b) => a!.localeCompare(b!, "de", { numeric: true })));
    expect(within(table).getByRole("columnheader", { name: /Bezeichnung/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    fireEvent.click(within(table).getByRole("button", { name: "Bezeichnung" }));
    expect(rowTexts(table, 0)).toEqual([...asc].reverse());
  });

  test("Filter „nur nicht angeschlossene“ und Geschoss", () => {
    const { store, view } = setup();
    render(<ListsView store={store} view={view} />);
    fireEvent.click(screen.getByLabelText("nur nicht angeschlossene"));
    const table = screen.getByRole("table", { name: "Geräte" });
    const conn = rowTexts(table, 8);
    expect(conn.length).toBeGreaterThan(0);
    expect(new Set(conn)).toEqual(new Set(["nicht angeschlossen"]));
    // im OG sind alle Geräte angeschlossen
    fireEvent.click(screen.getByLabelText("nur nicht angeschlossene"));
    fireEvent.change(screen.getByLabelText("Geschoss"), { target: { value: "o9g1k2m3" } });
    expect(new Set(rowTexts(table, 3))).toEqual(new Set(["OG"]));
  });

  test("Leitungsliste: Status „verlegt“ allein, Summen je Typ", () => {
    const { store, view } = setup();
    render(<ListsView store={store} view={view} />);
    fireEvent.change(screen.getByLabelText("Liste"), { target: { value: "cables" } });
    const status = screen.getByRole("group", { name: "Status" });
    fireEvent.click(within(status).getByRole("button", { name: "geplant" }));
    fireEvent.click(within(status).getByRole("button", { name: "geprüft" }));
    const table = screen.getByRole("table", { name: "Leitungen" });
    expect(rowTexts(table, 0)).toEqual(["Deckenauslass Küche – Bodendose Kind"]);
    expect(screen.getByRole("list", { name: "Summen" })).toHaveTextContent(
      /^NYM-J 3×1,5: 1 Leitung, \d+,\d m$/,
    );
  });

  test("Materialliste hat Abschnitte ohne Zeilenauswahl; KNX-Kanäle mit Verteilerfilter", () => {
    const { store, view } = setup();
    render(<ListsView store={store} view={view} />);
    fireEvent.change(screen.getByLabelText("Liste"), { target: { value: "material" } });
    const rail = screen.getByRole("table", { name: "Reiheneinbaugeräte" });
    expect(within(rail).getAllByRole("row")[1]).not.toHaveAttribute("tabindex");
    fireEvent.change(screen.getByLabelText("Liste"), { target: { value: "knx" } });
    fireEvent.change(screen.getByLabelText("Verteiler"), { target: { value: "b2uveg01" } });
    expect(screen.getByText("Keine Einträge")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Verteiler"), { target: { value: "b3uvog01" } });
    expect(screen.getByRole("list", { name: "Summen" })).toHaveTextContent(
      "1 Zuordnungen, 3 freie Kanäle",
    );
  });
});
