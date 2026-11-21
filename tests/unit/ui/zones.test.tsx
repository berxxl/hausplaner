// Installationszonen in der Flächenansicht und in den Projekteinstellungen (4.3)
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { loadProject } from "../../../src/io/load";
import type { Project } from "../../../src/model/types";
import { createProjectStore } from "../../../src/store/history";
import { createViewStore } from "../../../src/store/view";
import { ProjectSettings } from "../../../src/ui/ProjectSettings";
import { SurfaceView } from "../../../src/ui/surface/SurfaceView";
import { readFixture } from "../fixtures";

const EG = "e0g1k2m3";
const KITCHEN_BATH = "wall:1bih0wst:R@r1kueche#0";
const KITCHEN_SOUTH = "wall:0aw1s0ud:L@r1kueche#0";

function setup(mutate?: (p: Project) => void) {
  const r = loadProject(readFixture("m2"));
  if (r.status !== "ok") throw new Error();
  mutate?.(r.project);
  const store = createProjectStore(r.project);
  const view = createViewStore({
    activeStoreyId: EG,
    editor: "surface",
    surface: { kind: "room-wall", key: KITCHEN_BATH },
  });
  render(
    <>
      <SurfaceView store={store} view={view} />
      <ProjectSettings store={store} onClose={() => {}} />
    </>,
  );
  return { store, view };
}

const toolbar = () => screen.getByRole("toolbar", { name: "Werkzeuge der Fläche" });
const topZoneVs = () =>
  screen
    .getByTestId("install-zones")
    .querySelector('[data-zone="top"]')!
    .getAttribute("points")!
    .split(" ")
    .map((p) => Number(p.split(",")[1]));

function commit(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: "Enter" });
}

describe("Installationszonen (4.3)", () => {
  test("Zonen ein- und ausblenden; Schalter fehlt außerhalb von Raumansichten", () => {
    const { view } = setup();
    expect(screen.queryByTestId("install-zones")).toBeNull();
    fireEvent.click(within(toolbar()).getByRole("button", { name: "Zonen" }));
    const zones = screen.getByTestId("install-zones");
    expect(zones.querySelector('[data-zone="bottom"]')).not.toBeNull();
    expect(zones.querySelector('[data-zone="corner-left"]')).not.toBeNull();
    expect(zones.querySelector('[data-zone="corner-right"]')).not.toBeNull();
    // gilt für alle Wandansichten
    act(() => view.openSurface({ kind: "room-wall", key: KITCHEN_SOUTH }));
    expect(screen.getByTestId("install-zones")).toBeInTheDocument();
    act(() => view.openSurface({ kind: "wall-side", ref: "wall:0aw1s0ud:R" }));
    expect(screen.queryByTestId("install-zones")).toBeNull();
    expect(within(toolbar()).queryByRole("button", { name: "Zonen" })).toBeNull();
    act(() => view.openSurface({ kind: "room-wall", key: KITCHEN_BATH }));
    fireEvent.click(within(toolbar()).getByRole("button", { name: "Zonen" }));
    expect(screen.queryByTestId("install-zones")).toBeNull();
  });

  test("Obere Zone auf 200–500 geändert (Spec-Scenario) wirkt in allen Wandansichten, Undo", () => {
    const { store, view } = setup();
    fireEvent.click(within(toolbar()).getByRole("button", { name: "Zonen" }));
    const ceiling = Math.max(...topZoneVs()) + 150;
    const dialog = screen.getByRole("dialog", { name: "Projekteinstellungen" });
    const row = within(dialog).getByRole("group", { name: "Obere Zone unter der Decke" });
    commit(within(row).getByLabelText(/von$/), "200");
    commit(within(row).getByLabelText(/bis$/), "500");
    expect(store.getState().project.settings.installZones.horizontalTop).toEqual([200, 500]);
    expect(store.undoLabel()).toBe("Installationszonen ändern");
    expect(Math.max(...topZoneVs())).toBe(ceiling - 200);
    expect(Math.min(...topZoneVs())).toBe(ceiling - 500);
    act(() => view.openSurface({ kind: "room-wall", key: KITCHEN_SOUTH }));
    const south = topZoneVs();
    act(() => store.undo());
    act(() => store.undo());
    // obere Kante wieder 150 statt 200, untere 450 statt 500 unter der Decke
    expect(Math.max(...topZoneVs())).toBe(Math.max(...south) + 50);
    expect(Math.min(...topZoneVs())).toBe(Math.min(...south) + 50);
  });

  test("von ≥ bis wird abgelehnt, Wert bleibt, kein Undo-Schritt", () => {
    const { store } = setup();
    const dialog = screen.getByRole("dialog", { name: "Projekteinstellungen" });
    const row = within(dialog).getByRole("group", { name: "Untere Zone über OKFF" });
    commit(within(row).getByLabelText(/von$/), "450");
    expect(within(dialog).getByRole("alert")).toHaveTextContent("0 ≤ von < bis");
    expect(store.canUndo()).toBe(false);
    expect(store.getState().project.settings.installZones.horizontalBottom).toEqual([150, 450]);
    expect(
      within(within(dialog).getByRole("group", { name: "Untere Zone über OKFF" })).getByLabelText(
        /von$/,
      ),
    ).toHaveValue("150");
  });

  test("Zuführungen: Schalter mitten auf der Wand hervorgehoben, neben der Ecke nicht", () => {
    const { store } = setup((p) => {
      const d = p.devices.find((x) => x.id === "d2schalt")!;
      if (d.placement.kind === "surface") {
        d.placement.u = 2000;
        d.placement.v = 1050;
      }
    });
    expect(screen.queryByTestId("device-feeds")).toBeNull();
    fireEvent.click(within(toolbar()).getByRole("button", { name: "Zuführungen" }));
    const line = () => screen.getByTestId("device-feeds").querySelector('[data-feed="d2schalt"]')!;
    expect(line()).toHaveClass("surface__feed--outside");
    expect(line().getAttribute("data-from")).toBe("top");
    // 200 mm neben der fertigen rechten Raumecke (u = 3925)
    act(() =>
      store.execute({
        label: "Gerät verschieben",
        run: (d) => {
          const x = d.devices.find((y) => y.id === "d2schalt")!;
          if (x.placement.kind === "surface") x.placement.u = 3725;
        },
      }),
    );
    expect(line()).not.toHaveClass("surface__feed--outside");
  });
});
