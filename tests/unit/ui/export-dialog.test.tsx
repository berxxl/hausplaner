// Exportdialog (Task 6.1)
import { fireEvent, render, screen, within } from "@testing-library/react";
import { EXPORT_SETTINGS_KEY } from "../../../src/export/settings";
import { loadProject } from "../../../src/io/load";
import { createProjectStore } from "../../../src/store/history";
import { createViewStore } from "../../../src/store/view";
import { ExportDialog } from "../../../src/ui/export/ExportDialog";
import { readFixture } from "../fixtures";

function setup() {
  const r = loadProject(readFixture("m4"));
  if (r.status !== "ok") throw new Error();
  const store = createProjectStore(r.project);
  const view = createViewStore({ activeStoreyId: "e0g1k2m3" });
  render(<ExportDialog store={store} view={view} onClose={() => {}} />);
  return { store, view };
}

beforeEach(() => window.localStorage.clear());

describe("Exportdialog (6.1)", () => {
  test("Standard: Grundriss des aktiven Geschosses, 1:50, A3 quer, ein Blatt", () => {
    setup();
    const dialog = screen.getByRole("dialog", { name: "PDF exportieren" });
    expect(within(dialog).getByLabelText("Grundriss EG")).toBeChecked();
    expect(within(dialog).getByLabelText("Grundriss OG")).not.toBeChecked();
    expect(within(dialog).getByLabelText("Maßstab")).toHaveValue("50");
    expect(within(dialog).getByLabelText("Format")).toHaveValue("A3 landscape");
    expect(within(dialog).getByRole("status", { name: "Fortschritt" })).toHaveTextContent(
      "1 Blatt",
    );
    expect(within(dialog).getByRole("button", { name: "Exportieren" })).toBeEnabled();
  });

  test("passt nicht: Meldung nennt den nötigen Maßstab und sperrt „Exportieren“", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Maßstab"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Format"), { target: { value: "A4 portrait" } });
    const messages = screen.getByRole("list", { name: "Meldungen" });
    expect(messages).toHaveTextContent(
      /^Grundriss EG passt in 1:20 nicht auf A4 hoch \(braucht 1:\d+\)$/,
    );
    expect(screen.getByRole("button", { name: "Exportieren" })).toBeDisabled();
    // abwählen hebt die Sperre auf, aber ohne Blatt bleibt der Knopf aus
    fireEvent.click(screen.getByLabelText("Grundriss EG"));
    expect(screen.queryByRole("list", { name: "Meldungen" })).toBeNull();
    expect(screen.getByRole("button", { name: "Exportieren" })).toBeDisabled();
  });

  test("nur verlegt und geprüft: Hinweis „Bestandsplan“; Einstellungen bleiben im Browser", () => {
    setup();
    const status = screen.getByRole("group", { name: "Status" });
    fireEvent.click(within(status).getByRole("button", { name: "geplant" }));
    expect(screen.getByLabelText("Planart")).toHaveTextContent("Bestandsplan");
    fireEvent.change(screen.getByLabelText("Planstand"), { target: { value: "Index B" } });
    const saved = JSON.parse(window.localStorage.getItem(EXPORT_SETTINGS_KEY)!);
    expect(saved).toMatchObject({ planStatus: "Index B", statuses: ["installed", "verified"] });
  });

  test("Geschoss-Kästchen wählt alle Räume, Belegung und Listen zählen als Blätter", () => {
    setup();
    fireEvent.click(screen.getByLabelText("OG"));
    expect(screen.getByLabelText("Kind Wandansichten")).toBeChecked();
    expect(screen.getByLabelText("Kind Decke")).toBeChecked();
    fireEvent.click(screen.getByLabelText("Belegung UV OG"));
    fireEvent.click(screen.getByLabelText("Liste Stromkreise"));
    expect(screen.getByRole("status", { name: "Fortschritt" }).textContent).toMatch(
      /^\d+ Blätter$/,
    );
  });
});
