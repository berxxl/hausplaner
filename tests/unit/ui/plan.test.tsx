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

describe("Öffnungen zeichnen und verschieben (9.2.1, 9.2.2)", () => {
  const field = (name: string) => Number((screen.getByLabelText(name) as HTMLInputElement).value);
  const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(20);

  test("Aufziehen legt Abstand und Breite fest; Art wechseln ändert beide nicht", () => {
    const { store, view } = setup();
    render(<PlanView store={store} view={view} />);
    fireEvent.click(screen.getByRole("button", { name: "Öffnung" }));
    const svg = screen.getByRole("img", { name: "Grundriss" });
    fireEvent.pointerDown(svg, { button: 0, ...screenOf(5200, 0) });
    fireEvent.pointerMove(svg, screenOf(4000, 50));
    expect(screen.getByTestId("opening-preview")).toBeTruthy();
    fireEvent.pointerUp(svg);
    const dialog = screen.getByRole("dialog", { name: "Öffnung setzen" });
    const offset = field("Abstand vom Wandanfang");
    const width = field("Breite");
    near(offset, 4000);
    near(width, 1200);
    fireEvent.change(within(dialog).getByLabelText("Art"), { target: { value: "door" } });
    expect(field("Abstand vom Wandanfang")).toBe(offset);
    expect(field("Breite")).toBe(width);
    expect(field("Höhe")).toBe(2135);
    expect(field("Brüstung")).toBe(0);
    fireEvent.click(within(dialog).getByRole("button", { name: "OK" }));
    const added = store.getState().project.openings.at(-1)!;
    expect(added).toMatchObject({ wallId: "0aw1s0ud", kind: "door", offsetMm: offset });
    expect(added.widthMm).toBe(width);
  });

  test("Klick ohne Ziehen: Fenster mittig; Art wechseln lässt den Abstand stehen", () => {
    const { store, view } = setup();
    render(<PlanView store={store} view={view} />);
    fireEvent.click(screen.getByRole("button", { name: "Öffnung" }));
    const svg = screen.getByRole("img", { name: "Grundriss" });
    fireEvent.pointerDown(svg, { button: 0, ...screenOf(6000, 0) });
    fireEvent.pointerUp(svg);
    const dialog = screen.getByRole("dialog", { name: "Öffnung setzen" });
    const offset = field("Abstand vom Wandanfang");
    near(offset, 6000 - 505);
    expect(field("Breite")).toBe(1010);
    fireEvent.change(within(dialog).getByLabelText("Art"), { target: { value: "door" } });
    expect(field("Abstand vom Wandanfang")).toBe(offset);
    expect(field("Breite")).toBe(885);
  });

  test("Werkzeug „Öffnung“: Ziehen an einer vorhandenen Öffnung verschiebt sie, ohne eine neue anzulegen", () => {
    const { store, view } = setup();
    render(<PlanView store={store} view={view} />);
    fireEvent.click(screen.getByRole("button", { name: "Öffnung" }));
    const svg = screen.getByRole("img", { name: "Grundriss" });
    fireEvent.pointerDown(svg, { button: 0, ...screenOf(2000, 0) });
    expect(view.getState().selection).toEqual({ kind: "opening", id: "o1fenstr" });
    fireEvent.pointerMove(svg, screenOf(2500, 100));
    fireEvent.pointerUp(svg);
    expect(screen.queryByRole("dialog", { name: "Öffnung setzen" })).toBeNull();
    const p = store.getState().project;
    expect(p.openings).toHaveLength(2);
    near(p.openings.find((o) => o.id === "o1fenstr")!.offsetMm, 1995);
    expect(store.undoLabel()).toBe("Öffnung verschieben");
    // Klick auf freie Wand legt weiter eine neue Öffnung an
    fireEvent.pointerDown(svg, { button: 0, ...screenOf(6000, 0) });
    fireEvent.pointerUp(svg);
    expect(screen.getByRole("dialog", { name: "Öffnung setzen" })).toBeTruthy();
  });

  test("Auswahlwerkzeug: Öffnung entlang der Wand ziehen ist ein Befehl", () => {
    const { store, view } = setup();
    render(<PlanView store={store} view={view} />);
    const svg = screen.getByRole("img", { name: "Grundriss" });
    fireEvent.pointerDown(svg, { button: 0, ...screenOf(2000, 0) });
    fireEvent.pointerMove(svg, screenOf(2500, 200));
    fireEvent.pointerMove(svg, screenOf(3000, 200));
    fireEvent.pointerUp(svg);
    const o = store.getState().project.openings.find((x) => x.id === "o1fenstr")!;
    near(o.offsetMm, 2495);
    expect(store.undoLabel()).toBe("Öffnung verschieben");
    act(() => store.undo());
    expect(store.getState().project.openings.find((x) => x.id === "o1fenstr")!.offsetMm).toBe(1495);
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

describe("Nordpfeil", () => {
  test("zeigt die Nordrichtung der Projekteinstellungen, ohne den Plan zu drehen", async () => {
    const { setNorthDeg } = await import("../../../src/store/commands");
    const { store, view } = setup();
    render(<PlanView store={store} view={view} />);
    const arrow = screen.getByTestId("north-arrow");
    expect(arrow).toHaveAttribute("aria-label", "Norden (Nordrichtung 0°)");
    act(() => store.execute(setNorthDeg(30)));
    expect(arrow).toHaveAttribute("data-north-deg", "30");
    expect(arrow.querySelector("g")!.getAttribute("transform")).toBe("rotate(30)");
  });
});
