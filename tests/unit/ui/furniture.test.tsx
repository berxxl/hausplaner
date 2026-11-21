// Möbel in der Oberfläche: Werkzeug, Ziehen, Drehen, Eigenschaften, Silhouette (5.2)
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { loadProject } from "../../../src/io/load";
import type { Project } from "../../../src/model/types";
import { createProjectStore } from "../../../src/store/history";
import { createViewStore } from "../../../src/store/view";
import { PlanView } from "../../../src/ui/plan/PlanView";
import { Properties } from "../../../src/ui/Properties";
import { SurfaceView } from "../../../src/ui/surface/SurfaceView";
import { readFixture } from "../fixtures";

const EG = "e0g1k2m3";

function load(mutate?: (p: Project) => void) {
  const r = loadProject(readFixture("m2"));
  if (r.status !== "ok") throw new Error();
  mutate?.(r.project);
  return createProjectStore(r.project);
}

function screenOf(name: string, x: number, y: number) {
  const svg = screen.getByRole("img", { name });
  const [cx, cy, zoom] = ["data-cx", "data-cy", "data-zoom"].map((a) =>
    Number(svg.getAttribute(a)),
  );
  return { clientX: 400 + (x - cx!) * zoom!, clientY: 300 - (y - cy!) * zoom! };
}

const plan = () => screen.getByRole("img", { name: "Grundriss" });
const at = (x: number, y: number) => screenOf("Grundriss", x, y);
const added = (store: ReturnType<typeof load>) => store.getState().project.furniture.at(-1)!;

function commit(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: "Enter" });
}

describe("Werkzeug „Möbel“ (5.2)", () => {
  test("Küchenunterschrank an der Nordwand der Küche rastet ein; mit Shift nicht", () => {
    const store = load();
    const view = createViewStore({ activeStoreyId: EG });
    render(<PlanView store={store} view={view} />);
    fireEvent.click(screen.getByRole("button", { name: "Möbel" }));
    fireEvent.pointerDown(plan(), { button: 0, ...at(2000, 2600) });
    expect(screen.getByLabelText("Meldung")).toHaveTextContent("Zuerst einen Möbeltyp wählen.");
    const options = screen.getByRole("group", { name: "Möbeloptionen" });
    fireEvent.change(within(options).getByLabelText("Möbeltyp"), {
      target: { value: "kitchen-base" },
    });
    fireEvent.pointerDown(plan(), { button: 0, ...at(2000, 2600) });
    expect(added(store)).toMatchObject({
      typeId: "kitchen-base",
      x: 2000,
      y: 2925 - 300,
      rotationDeg: 0,
      widthMm: 600,
      depthMm: 600,
      heightMm: 900,
      elevationMm: 0,
      storeyId: EG,
    });
    expect(store.undoLabel()).toBe("Möbel setzen");
    expect(view.getState().selection).toEqual({ kind: "furniture", id: added(store).id });
    fireEvent.pointerDown(plan(), { button: 0, shiftKey: true, ...at(2000, 2600) });
    expect(added(store)).toMatchObject({ x: 2000, y: 2600 });
    expect(plan().querySelectorAll("[data-furniture]")).toHaveLength(3);
  });

  test("Ziehen rastet ein, Shift schaltet ab; ein Befehl beim Loslassen", () => {
    const store = load((p) => {
      p.furniture[0]!.y = 4500; // Schrank mitten im Schlafzimmer
    });
    const view = createViewStore({ activeStoreyId: EG });
    render(<PlanView store={store} view={view} />);
    fireEvent.pointerDown(plan(), { button: 0, ...at(6000, 4500) });
    expect(view.getState().selection).toEqual({ kind: "furniture", id: "f1schrnk" });
    fireEvent.pointerMove(plan(), at(6100, 5400));
    fireEvent.pointerUp(plan());
    expect(store.getState().project.furniture[0]).toMatchObject({ x: 6100, y: 5835 - 300 });
    expect(store.undoLabel()).toBe("Möbel verschieben");
    fireEvent.pointerDown(plan(), { button: 0, ...at(6100, 5535) });
    fireEvent.pointerMove(plan(), { shiftKey: true, ...at(6100, 5400) });
    fireEvent.pointerUp(plan());
    expect(store.getState().project.furniture[0]).toMatchObject({ y: 5400 });
    act(() => store.undo());
    expect(store.getState().project.furniture[0]).toMatchObject({ y: 5535 });
  });

  test("R dreht um 90°, Entf löscht", () => {
    const store = load();
    const view = createViewStore({
      activeStoreyId: EG,
      selection: { kind: "furniture", id: "f1schrnk" },
    });
    render(<PlanView store={store} view={view} />);
    fireEvent.keyDown(window, { key: "r" });
    expect(store.getState().project.furniture[0]!.rotationDeg).toBe(90);
    expect(store.undoLabel()).toBe("Möbel ändern");
    fireEvent.keyDown(window, { key: "Delete" });
    expect(store.getState().project.furniture).toEqual([]);
    expect(store.undoLabel()).toBe("Möbel löschen");
  });
});

describe("Eigenschaften eines Möbels (5.2)", () => {
  test("alle Maße editierbar; Typwechsel übernimmt die Maße des Typs", () => {
    const store = load();
    const view = createViewStore({
      activeStoreyId: EG,
      selection: { kind: "furniture", id: "f1schrnk" },
    });
    render(<Properties store={store} view={view} />);
    const props = screen.getByRole("complementary", { name: "Eigenschaften" });
    expect(within(props).getByRole("heading")).toHaveTextContent("Möbel");
    commit(within(props).getByLabelText("Höhe über OKFF"), "1450");
    commit(within(props).getByLabelText("Breite"), "1800");
    commit(within(props).getByLabelText("x (Mitte)"), "5900");
    expect(store.getState().project.furniture[0]).toMatchObject({
      elevationMm: 1450,
      widthMm: 1800,
      x: 5900,
    });
    expect(store.undoLabel()).toBe("Möbel verschieben");
    fireEvent.change(within(props).getByLabelText("Typ"), { target: { value: "kitchen-base" } });
    expect(store.getState().project.furniture[0]).toMatchObject({
      typeId: "kitchen-base",
      widthMm: 600,
      depthMm: 600,
      heightMm: 900,
      elevationMm: 0,
    });
  });
});

describe("Wandansicht (5.2)", () => {
  test("Hängeschrank in 1450 mm erscheint halbtransparent über dem Boden; Klick wählt ihn", () => {
    const store = load((p) => {
      p.furniture.push({
        id: "f2haeng0",
        typeId: "kitchen-wall",
        x: 2000,
        y: 2925 - 175,
        rotationDeg: 0,
        widthMm: 600,
        depthMm: 350,
        heightMm: 700,
        elevationMm: 1450,
        storeyId: EG,
      });
    });
    const view = createViewStore({
      activeStoreyId: EG,
      editor: "surface",
      surface: { kind: "room-wall", key: "wall:1bih0wst:R@r1kueche#0" },
    });
    render(<SurfaceView store={store} view={view} />);
    const rect = screen
      .getByTestId("surface-furniture")
      .querySelector('[data-furniture="f2haeng0"]')!;
    expect([rect.getAttribute("y"), rect.getAttribute("height")]).toEqual(["1450", "700"]);
    const svg = screen.getByRole("img", { name: "Flächenansicht" });
    const u = Number(rect.getAttribute("x")) + 300;
    fireEvent.pointerDown(svg, { button: 0, ...screenOf("Flächenansicht", u, 1800) });
    expect(view.getState().selection).toEqual({ kind: "furniture", id: "f2haeng0" });
  });

  test("verdeckte Dose hat einen roten Rand, übergangene nicht", () => {
    const store = load();
    const view = createViewStore({
      activeStoreyId: EG,
      editor: "surface",
      surface: { kind: "room-wall", key: "wall:0cw3n0rd:L@r4schlaf#0" },
    });
    render(<SurfaceView store={store} view={view} />);
    const glyph = () =>
      screen.getByTestId("surface-devices").querySelector('[data-device="d6usbsch"]')!;
    // in der Fixture übergangen
    expect(glyph()).not.toHaveAttribute("data-warned");
    act(() => store.execute({ label: "x", run: (d) => void (d.suppressedWarnings = []) }));
    expect(glyph()).toHaveAttribute("data-warned", "true");
  });
});
