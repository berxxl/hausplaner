// Warnungsübersicht (6.3): Regel, Element, Ort, Abschnitt „übergangen“, Klickziele
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { loadProject } from "../../../src/io/load";
import type { Project } from "../../../src/model/types";
import { createProjectStore } from "../../../src/store/history";
import { createSaveController } from "../../../src/store/save";
import { Workspace } from "../../../src/ui/Workspace";
import { readFixture } from "../fixtures";
import { mockApi } from "../mock-api";

function open(mutate?: (p: Project) => void) {
  const files = readFixture("m2");
  const result = loadProject(files);
  if (result.status !== "ok") throw new Error();
  mutate?.(result.project);
  const store = createProjectStore(result.project);
  render(
    <Workspace
      store={store}
      save={createSaveController(store, mockApi(files).api, result.contents)}
    />,
  );
  return { store, bar: screen.getByRole("contentinfo", { name: "Warnungen" }) };
}

const COVERED = "Gerät durch Möbel verdeckt: USB-C Schlafen (Kleiderschrank)";

describe("Warnungsübersicht (6.3)", () => {
  test("übergangene Warnung zählt nicht, steht unter „übergangen“; Wieder aktivieren und Übergehen", () => {
    const { store, bar } = open();
    fireEvent.click(within(bar).getByRole("button", { name: "Keine Warnungen · 1 übergangen" }));
    expect(within(bar).queryByRole("table", { name: "Warnungsliste" })).toBeNull();
    fireEvent.click(within(bar).getByRole("button", { name: "übergangen (1)" }));
    const suppressed = within(bar).getByRole("table", { name: "Übergangene Warnungen" });
    const [, row] = within(suppressed).getAllByRole("row");
    expect(
      within(row!)
        .getAllByRole("cell")
        .map((c) => c.textContent),
    ).toEqual([COVERED, "USB-C Schlafen", "EG › Schlafen › Wand Nord", "Wieder aktivieren"]);
    fireEvent.click(within(row!).getByRole("button", { name: `Wieder aktivieren: ${COVERED}` }));
    expect(store.undoLabel()).toBe("Warnung wieder aktivieren");
    expect(within(bar).getByRole("button", { name: "1 Warnung" })).toBeInTheDocument();
    const list = within(bar).getByRole("table", { name: "Warnungsliste" });
    fireEvent.click(within(list).getByRole("button", { name: `Übergehen: ${COVERED}` }));
    expect(store.getState().project.suppressedWarnings).toEqual(["device-covered:d6usbsch"]);
    expect(within(bar).getByRole("button", { name: /Keine Warnungen/ })).toBeInTheDocument();
  });

  test("Zur Ursache springen (Spec-Scenario): Klick öffnet die Ansicht und wählt das Element", () => {
    const { bar } = open((p) => (p.suppressedWarnings = []));
    fireEvent.click(within(bar).getByRole("button", { name: "1 Warnung" }));
    fireEvent.click(
      within(within(bar).getByRole("table", { name: "Warnungsliste" })).getByRole("button", {
        name: COVERED,
      }),
    );
    expect(screen.getByRole("heading", { name: "Fläche" })).toHaveTextContent(
      "Schlafen › Wand Nord",
    );
    const glyph = screen.getByTestId("surface-devices").querySelector('[data-device="d6usbsch"]')!;
    expect(glyph).toHaveAttribute("data-selected", "true");
    expect(glyph).toHaveAttribute("data-warned", "true");
    const props = screen.getByRole("complementary", { name: "Eigenschaften" });
    expect(within(props).getByLabelText("Bezeichnung")).toHaveValue("USB-C Schlafen");
  });

  test("Verweis ins Leere: nur „Löschen“, kein „Übergehen“; Löschen ist ein Befehl", () => {
    const { store, bar } = open((p) => {
      p.devices.find((d) => d.id === "d2schalt")!.typeId = "weg";
    });
    fireEvent.click(within(bar).getByRole("button", { name: "1 Warnung · 1 übergangen" }));
    const list = within(bar).getByRole("table", { name: "Warnungsliste" });
    const text = "Gerät mit unbekanntem Typ (weg)";
    expect(within(list).queryByRole("button", { name: `Übergehen: ${text}` })).toBeNull();
    expect(list).toHaveTextContent("Schalter Küche");
    fireEvent.click(within(list).getByRole("button", { name: `Löschen: ${text}` }));
    expect(store.getState().project.devices.some((d) => d.id === "d2schalt")).toBe(false);
    expect(store.undoLabel()).toBe("Gerät löschen");
    act(() => store.undo());
    expect(
      within(bar).getByRole("button", { name: "1 Warnung · 1 übergangen" }),
    ).toBeInTheDocument();
  });

  test("Sortierung nach Geschoss, Raum, Text", () => {
    const { bar } = open((p) => {
      p.suppressedWarnings = [];
      const move = (id: string, u: number) => {
        const d = p.devices.find((x) => x.id === id)!;
        if (d.placement.kind === "surface") d.placement.u = u;
      };
      move("d1steck1", 9000); // Küche, außerhalb
      move("d2schalt", 9000);
    });
    fireEvent.click(within(bar).getByRole("button", { name: "3 Warnungen" }));
    const rows = within(within(bar).getByRole("table", { name: "Warnungsliste" })).getAllByRole(
      "row",
    );
    expect(rows.slice(1).map((r) => r.getAttribute("data-warning"))).toEqual([
      "device-off-surface:d2schalt",
      "device-off-surface:d1steck1",
      "device-covered:d6usbsch",
    ]);
  });
});
