import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { slopeFrame, slopeOutline } from "../../../src/geometry/surfaces";
import { loadProject } from "../../../src/io/load";
import type { Project } from "../../../src/model/types";
import { createProjectStore } from "../../../src/store/history";
import { createViewStore } from "../../../src/store/view";
import { SurfaceView } from "../../../src/ui/surface/SurfaceView";
import { Tree } from "../../../src/ui/Tree";
import { readFixture } from "../fixtures";

function load(name: string, mutate?: (p: Project) => void) {
  const r = loadProject(readFixture(name));
  if (r.status !== "ok") throw new Error();
  mutate?.(r.project);
  return createProjectStore(r.project);
}

function screenOf(u: number, v: number) {
  const svg = screen.getByRole("img", { name: "Flächenansicht" });
  const [cx, cy, zoom] = ["data-cx", "data-cy", "data-zoom"].map((a) =>
    Number(svg.getAttribute(a)),
  );
  return { clientX: 400 + (u - cx!) * zoom!, clientY: 300 - (v - cy!) * zoom! };
}

function measure(points: [number, number][]) {
  fireEvent.click(screen.getByRole("button", { name: "Messen" }));
  const svg = screen.getByRole("img", { name: "Flächenansicht" });
  for (const [u, v] of points) fireEvent.pointerDown(svg, { button: 0, ...screenOf(u, v) });
  return screen.getByTestId("measure-label").textContent;
}

describe("Ansicht einer ganzen Wandseite (7.4)", () => {
  test("Außenansicht zeigt alle Fenster der Wand; Vorbaukasten nur außen", () => {
    const store = load("klein", (p) => {
      p.openings.push({ ...p.openings[0]!, id: "o3fenst2", offsetMm: 5000 });
      p.openings[0]!.shutterBox = { position: "outside", heightMm: 300 };
      p.openings[1]!.shutterBox = undefined;
      delete p.openings[1]!.shutterBox;
    });
    const view = createViewStore({
      surface: { kind: "wall-side", ref: "wall:0aw1s0ud:R" },
      editor: "surface",
    });
    render(<SurfaceView store={store} view={view} />);
    expect(screen.getByRole("heading", { name: "Fläche" })).toHaveTextContent("Süd außen");
    const svg = screen.getByRole("img", { name: "Flächenansicht" });
    expect(svg.querySelectorAll("[data-opening]")).toHaveLength(2);
    expect(screen.getAllByTestId("shutter-outside")).toHaveLength(1);
    // Rohbau ab Oberkante Rohfußboden bis Wandoberkante 2500
    const contour = screen.getByTestId("surface-contour").getAttribute("points")!;
    expect(contour).toContain(",2500");
    // dieselbe Öffnung in der Innenansicht: kein Vorbaukasten
    act(() => view.openSurface({ kind: "room-wall", key: "wall:0aw1s0ud:L@r1kueche#0" }));
    expect(screen.queryByTestId("shutter-outside")).toBeNull();
  });
});

describe("Decke, Boden, Schräge (7.5)", () => {
  test("Schräge in wahrer Größe: Breite 3700, Höhe 1450 / cos 45°", () => {
    const store = load("dg");
    const p = store.getState().project;
    const room = p.rooms[0]!;
    const slope = room.slopes![0]!;
    const uv = slopeOutline(room, p.storeys[0]!, slope).map((q) => slopeFrame(room, slope).toUV(q));
    const us = uv.map((q) => q.u);
    const vs = uv.map((q) => q.v);
    expect(Math.max(...us) - Math.min(...us)).toBeCloseTo(3700, 6);
    expect(Math.max(...vs)).toBeCloseTo(1450 / Math.cos(Math.PI / 4), 6);
    expect(Math.min(...vs)).toBeCloseTo(0, 6);
  });

  test("Messen in Decken-, Boden- und Schrägenansicht ergibt wahre Maße", () => {
    const store = load("dg");
    const room = store.getState().project.rooms[0]!;
    const view = createViewStore({
      surface: { kind: "floor", roomId: room.id },
      editor: "surface",
    });
    const { unmount } = render(<SurfaceView store={store} view={view} />);
    expect(
      measure([
        [150, 150],
        [3850, 150],
      ]),
    ).toBe("3700 mm (3,70 m)");
    unmount();
    view.openSurface({ kind: "ceiling", roomId: room.id });
    const c = render(<SurfaceView store={store} view={view} />);
    expect(
      measure([
        [-150, 150],
        [-150, 2850],
      ]),
    ).toBe("2700 mm (2,70 m)");
    c.unmount();
    view.openSurface({ kind: "slope", roomId: room.id, slopeId: room.slopes![0]!.id });
    render(<SurfaceView store={store} view={view} />);
    expect(
      measure([
        [0, 0],
        [0, 1450 / Math.cos(Math.PI / 4)],
      ]),
    ).toBe("2051 mm (2,05 m)");
  });

  test("beschriftete Wandkanten im Deckenspiegel öffnen die Wandansicht", () => {
    const store = load("klein");
    const view = createViewStore({
      surface: { kind: "ceiling", roomId: "r1kueche" },
      editor: "surface",
    });
    render(<SurfaceView store={store} view={view} />);
    fireEvent.click(screen.getByRole("button", { name: "Kante Wand Nord" }));
    expect(view.getState().surface).toEqual({
      kind: "room-wall",
      key: "wall:1bih0wst:R@r1kueche#0",
    });
    expect(screen.getByRole("heading", { name: "Fläche" })).toHaveTextContent("Küche › Wand Nord");
  });
});

describe("Strukturbaum (7.6)", () => {
  function open() {
    const store = load("klein");
    const view = createViewStore({ activeStoreyId: "e0g1k2m3" });
    render(<Tree store={store} view={view} />);
    return { store, view };
  }
  const item = (name: string, scope?: HTMLElement) =>
    within(scope ?? screen.getByRole("tree")).getAllByRole("treeitem", { name })[0]!;
  const children = (el: HTMLElement) =>
    [...el.querySelectorAll(':scope > [role="group"] > [role="treeitem"]')].map((x) =>
      x.getAttribute("aria-label"),
    );
  const marked = () =>
    [...screen.getByRole("tree").querySelectorAll('[role="treeitem"][data-marked="true"]')].map(
      (x) =>
        `${x.parentElement!.closest('[role="treeitem"]')!.getAttribute("aria-label")} › ${x.getAttribute("aria-label")}`,
    );

  test("Räume mit Wandansichten in Reihenfolge, Decke, Boden; Flächen ohne Raum", () => {
    open();
    const eg = item("EG");
    expect(children(eg)).toEqual(["Bad", "Küche", "Schlafen", "Wohnen", "Flächen ohne Raum"]);
    expect(children(item("Küche", eg))).toEqual([
      "Wand Nord",
      "Wand Ost",
      "Wand Süd",
      "Wand West",
      "Decke",
      "Boden",
    ]);
    expect(children(item("Flächen ohne Raum", eg))).toEqual([
      "Nord außen",
      "Ost außen",
      "Süd außen",
      "West außen",
    ]);
  });

  test("Wandauswahl markiert alle Wandansichten der Wand (Spec-Scenario)", () => {
    const { view } = open();
    act(() => view.select({ kind: "wall", id: "1bih0wst" })); // Trennwand Küche/Bad
    expect(marked()).toEqual(["Bad › Wand Süd", "Küche › Wand Nord"]);
    act(() => view.select({ kind: "wall", id: "0aw1s0ud" })); // Südwand: Küche, Wohnen, Außenseite
    expect(marked()).toEqual([
      "Küche › Wand Süd",
      "Wohnen › Wand Süd",
      "Flächen ohne Raum › Süd außen",
    ]);
  });

  test("Klick auf eine Wandansicht öffnet sie im Editor „Fläche“", () => {
    const { view } = open();
    fireEvent.click(item("Wand Ost", item("Küche")));
    expect(view.getState()).toMatchObject({
      editor: "surface",
      surface: { kind: "room-wall", key: "wall:1aiv0ert:L@r1kueche#0" },
    });
    expect(item("Wand Ost", item("Küche"))).toHaveAttribute("aria-selected", "true");
  });
});
