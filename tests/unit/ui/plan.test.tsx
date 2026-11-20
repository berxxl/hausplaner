import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { loadProject } from "../../../src/io/load";
import { createProjectStore } from "../../../src/store/history";
import { createViewStore } from "../../../src/store/view";
import { PlanView } from "../../../src/ui/plan/PlanView";
import { RoomProperties } from "../../../src/ui/BuildingProperties";
import { readFixture } from "../fixtures";

function setup() {
  const result = loadProject(readFixture("klein"));
  if (result.status !== "ok") throw new Error();
  const store = createProjectStore(result.project);
  const view = createViewStore({ activeStoreyId: "e0g1k2m3" });
  return { store, view };
}

/** Bildschirmpunkt eines Weltpunkts nach der Kamera im SVG. */
function screenOf(x: number, y: number) {
  const svg = screen.getByRole("img", { name: "Grundriss" });
  const [cx, cy, zoom] = ["data-cx", "data-cy", "data-zoom"].map((a) =>
    Number(svg.getAttribute(a)),
  );
  return { clientX: 400 + (x - cx!) * zoom!, clientY: 300 - (y - cy!) * zoom! };
}

describe("Grundriss (6.1)", () => {
  test("Messwerkzeug zeigt den Abstand zweier Punkte", () => {
    const { store, view } = setup();
    render(<PlanView store={store} view={view} />);
    fireEvent.click(screen.getByRole("button", { name: "Messen" }));
    const svg = screen.getByRole("img", { name: "Grundriss" });
    fireEvent.pointerDown(svg, { button: 0, ...screenOf(1000, 1000) });
    fireEvent.pointerDown(svg, { button: 0, ...screenOf(4000, 5000) });
    const label = screen.getByTestId("measure-label").textContent!;
    const mm = Number(/^(\d+) mm/.exec(label)?.[1]);
    expect(Math.abs(mm - 5000)).toBeLessThanOrEqual(20); // Pixelrundung
    expect(label).toMatch(/^\d+ mm \(\d+,\d{2} m\)$/);
  });

  test("Raster: Linien alle 1 m, bei genug Zoom alle 100 mm", () => {
    const { store, view } = setup();
    render(<PlanView store={store} view={view} />);
    const svg = screen.getByRole("img", { name: "Grundriss" });
    // Start: 100 mm = 8 px → feine Linien sichtbar
    expect(svg.querySelectorAll(".grid__major").length).toBeGreaterThan(5);
    expect(svg.querySelectorAll(".grid__minor").length).toBeGreaterThan(0);
    // herauszoomen: 100 mm < 6 px → nur Meterlinien
    fireEvent.wheel(svg.parentElement!, { deltaY: 300, clientX: 400, clientY: 300 });
    expect(svg.querySelectorAll(".grid__minor").length).toBe(0);
    expect(svg.querySelectorAll(".grid__major").length).toBeGreaterThan(5);
  });

  test("Klick wählt Wand, Öffnung und Raum; Entf löscht die Auswahl", () => {
    const { store, view } = setup();
    render(<PlanView store={store} view={view} />);
    const svg = screen.getByRole("img", { name: "Grundriss" });
    fireEvent.pointerDown(svg, { button: 0, ...screenOf(4000, 4500) });
    expect(view.getState().selection).toEqual({ kind: "wall", id: "1aiv0ert" });
    fireEvent.pointerUp(svg);
    fireEvent.pointerDown(svg, { button: 0, ...screenOf(2000, 0) });
    expect(view.getState().selection).toEqual({ kind: "opening", id: "o1fenstr" });
    fireEvent.pointerUp(svg);
    fireEvent.pointerDown(svg, { button: 0, ...screenOf(6000, 4500) });
    expect(view.getState().selection).toEqual({ kind: "room", id: "r4schlaf" });
    fireEvent.pointerUp(svg);
    fireEvent.keyDown(window, { key: "Delete" });
    expect(store.getState().project.rooms.map((r) => r.id)).not.toContain("r4schlaf");
    expect(store.undoLabel()).toBe("Raum löschen");
  });
});

describe("Raumeigenschaften (6.6)", () => {
  test("Name, Werte mit Standard aus dem Geschoss, fertige Fläche", () => {
    const { store, view } = setup();
    const Panel = () => {
      const project = store.getState().project;
      return (
        <RoomProperties
          room={project.rooms.find((r) => r.id === "r3bad00a")!}
          project={project}
          store={store}
          view={view}
        />
      );
    };
    const { rerender } = render(<Panel />);
    expect(screen.getByLabelText("Fläche")).toHaveTextContent("10,38 m²");
    const floor = screen.getByLabelText("Fußbodenaufbau");
    expect(floor).toHaveValue("140");
    const plaster = screen.getByLabelText("Putzstärke");
    expect(plaster).toHaveValue("");
    expect(plaster).toHaveAttribute("placeholder", "15 (Standard)");
    fireEvent.change(plaster, { target: { value: "0" } });
    fireEvent.blur(plaster);
    rerender(<Panel />);
    expect(screen.getByLabelText("Fläche")).toHaveTextContent("10,57 m²"); // 3790 × 2790 roh
    fireEvent.change(floor, { target: { value: "" } });
    fireEvent.blur(floor);
    expect(
      store.getState().project.rooms.find((r) => r.id === "r3bad00a")!.floorBuildupMm,
    ).toBeUndefined();
    const name = screen.getByLabelText("Name");
    fireEvent.change(name, { target: { value: "Gästebad" } });
    fireEvent.keyDown(name, { key: "Enter" });
    expect(store.undoLabel()).toBe("Raum umbenennen");
    act(() => store.undo());
    expect(store.getState().project.rooms.find((r) => r.id === "r3bad00a")!.name).toBe("Bad");
    void within;
  });
});

test("„Parallel verschieben um“ springt nach Enter auf 0 zurück und wirkt beim Verlassen nicht noch einmal", async () => {
  const { WallProperties } = await import("../../../src/ui/BuildingProperties");
  const { store } = setup();
  const p = store.getState().project;
  render(
    <WallProperties wall={p.walls.find((w) => w.id === "0bw2o0st")!} project={p} store={store} />,
  );
  const field = screen.getByLabelText("Parallel verschieben um (positiv nach links)");
  fireEvent.change(field, { target: { value: "-200" } });
  fireEvent.keyDown(field, { key: "Enter" });
  expect(field).toHaveValue("0");
  fireEvent.blur(field);
  expect(store.getState().undoStack.map((e) => e.label)).toEqual(["Wand verschieben"]);
  expect(store.getState().project.walls.find((w) => w.id === "0bw2o0st")!.start.x).toBe(8200);
});
