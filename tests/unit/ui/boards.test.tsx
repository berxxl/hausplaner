// Verteiler in der Oberfläche (Tasks 2.3–2.5): Werkzeug, Felder, Belegungsansicht, Baum
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { boardNodeAnchor } from "../../../src/geometry/boards";
import { wallSides } from "../../../src/geometry/surfaces";
import { loadProject } from "../../../src/io/load";
import type { Project } from "../../../src/model/types";
import { createProjectStore } from "../../../src/store/history";
import { createViewStore } from "../../../src/store/view";
import { BoardView } from "../../../src/ui/board/BoardView";
import { slotPosition, symbolText } from "../../../src/ui/board/layout";
import { PlanView } from "../../../src/ui/plan/PlanView";
import { Properties } from "../../../src/ui/Properties";
import { SurfaceView } from "../../../src/ui/surface/SurfaceView";
import { Tree } from "../../../src/ui/Tree";
import { readFixture } from "../fixtures";

function load(name: string) {
  const r = loadProject(readFixture(name));
  if (r.status !== "ok") throw new Error();
  return createProjectStore(r.project);
}
const P = (s: ReturnType<typeof load>): Project => s.getState().project;

function commit(label: string, value: string, scope?: HTMLElement) {
  const f = (scope ? within(scope) : screen).getByLabelText(label);
  fireEvent.change(f, { target: { value } });
  fireEvent.keyDown(f, { key: "Enter" });
}

describe("Werkzeug „Verteiler“ und Felder (2.3)", () => {
  test("Zählerschrank mit Zählerfeld, APZ-Feld und Verteilerfeld 5 × 12: drei Felder und 60 TE (Spec-Scenario „Zählerschrank aufbauen“)", () => {
    const store = load("m4");
    const view = createViewStore({
      surface: { kind: "room-wall", key: "wall:1bih0wst:R@r1kueche#0" },
      editor: "surface",
    });
    render(
      <>
        <SurfaceView store={store} view={view} />
        <Properties store={store} view={view} />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Verteiler" }));
    const svg = screen.getByRole("img", { name: "Flächenansicht" });
    fireEvent.pointerDown(svg, { button: 0, clientX: 400, clientY: 300 });
    const dialog = screen.getByRole("dialog", { name: "Verteiler anlegen" });
    fireEvent.change(within(dialog).getByLabelText("Art"), { target: { value: "meter-cabinet" } });
    expect(within(dialog).getByLabelText("Bezeichnung")).toHaveValue("Zählerschrank");
    expect(within(dialog).getByLabelText("Montage")).toHaveValue("surface");
    fireEvent.click(within(dialog).getByRole("button", { name: "OK" }));
    const board = P(store).boards.find(
      (b) => b.label === "Zählerschrank" && b.placement.surface === "wall:1bih0wst:R",
    )!;
    expect(board).toMatchObject({
      kind: "meter-cabinet",
      widthMm: 800,
      heightMm: 1100,
      depthMm: 210,
    });
    expect(view.getState().selection).toEqual({ kind: "board", id: board.id });
    expect(store.undoLabel()).toBe("Verteiler anlegen");
    // Verteilerfeld auf 5 Reihen
    const props = screen.getByRole("complementary", { name: "Eigenschaften" });
    commit("Reihen Feld 3", "5", props);
    expect(
      P(store)
        .boards.find((b) => b.id === board.id)!
        .fields.map((f) => [f.kind, f.rows, f.tePerRow]),
    ).toEqual([
      ["meter", 0, 0],
      ["apz", 1, 12],
      ["distribution", 5, 12],
    ]);
    expect(within(props).getByLabelText("TE-Belegung")).toHaveTextContent(
      "0 belegt · 0 vorgemerkt · 60 frei von 60 TE",
    );
    // Belegungsansicht: drei Felder
    fireEvent.click(within(props).getByRole("button", { name: "Belegung öffnen" }));
    render(<BoardView store={store} view={view} />);
    const belegung = screen.getByRole("img", { name: "Belegung" });
    expect(belegung.querySelectorAll("[data-field]")).toHaveLength(3);
    expect(screen.getByLabelText("Zusammenfassung")).toHaveTextContent("60 frei von 60 TE");
  });

  test("Verteiler nur auf Wandseiten; Feld mit Geräten nicht löschbar", () => {
    const store = load("m4");
    const view = createViewStore({
      surface: { kind: "ceiling", roomId: "r1kueche" },
      editor: "surface",
    });
    render(<SurfaceView store={store} view={view} />);
    fireEvent.click(screen.getByRole("button", { name: "Verteiler" }));
    fireEvent.pointerDown(screen.getByRole("img", { name: "Flächenansicht" }), {
      button: 0,
      clientX: 400,
      clientY: 300,
    });
    expect(screen.getByRole("status", { name: "Meldung" })).toHaveTextContent(
      "Verteiler nur auf Wandseiten",
    );
    act(() => view.select({ kind: "board", id: "b2uveg01" }));
    render(<Properties store={store} view={view} />);
    fireEvent.click(screen.getByRole("button", { name: "Feld 1 löschen" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Feld enthält 1 Gerät");
  });

  test("Verteiler in der Wandansicht anklicken wählt ihn aus, Ziehen verschiebt ihn", () => {
    const store = load("m4");
    const view = createViewStore({
      surface: { kind: "wall-side", ref: "wall:1cih0ost:R" },
      editor: "surface",
    });
    render(<SurfaceView store={store} view={view} />);
    const svg = screen.getByRole("img", { name: "Flächenansicht" });
    expect(svg.querySelector('[data-board="b2uveg01"]')).not.toBeNull();
    const [cx, cy, zoom] = ["data-cx", "data-cy", "data-zoom"].map((a) =>
      Number(svg.getAttribute(a)),
    );
    // UV EG: u = 2000, v = 1500 über OKFF; ganze Wandseite zeigt Rohbau (+120 mm Aufbau Wohnen)
    const at = (u: number, v: number) => ({
      clientX: 400 + (u - cx!) * zoom!,
      clientY: 300 - (v - cy!) * zoom!,
    });
    fireEvent.pointerDown(svg, { button: 0, ...at(2000, 1620) });
    expect(view.getState().selection).toEqual({ kind: "board", id: "b2uveg01" });
    fireEvent.pointerMove(svg, at(2300, 1620));
    fireEvent.pointerUp(svg, at(2300, 1620));
    expect(P(store).boards.find((b) => b.id === "b2uveg01")!.placement.u).toBe(2300);
    expect(store.undoLabel()).toBe("Verteiler verschieben");
  });
});

describe("Verteiler per Maus verschieben (R.5)", () => {
  const EG = "e0g1k2m3";
  const UV = "b2uveg01";
  const SIDE = "wall:1cih0ost:R";
  function withNode() {
    const store = load("m4");
    // Verteilerknoten der UV EG mit einem Segment (Anker setzt die Normalisierung)
    store.execute({
      label: "Knoten",
      run(d) {
        d.routeNodes.push({
          id: "nuveg001",
          storeyId: EG,
          boardId: UV,
          anchors: [{ surface: SIDE, u: 0, v: 0 }],
        });
        d.routeNodes.push({
          id: "nuveg002",
          storeyId: EG,
          anchors: [{ surface: SIDE, u: 2000, v: 2400 }],
        });
        d.routeSegments.push({
          id: "suveg001",
          storeyId: EG,
          a: "nuveg002",
          b: "nuveg001",
          kind: "surface",
          surface: SIDE,
          status: "planned",
        });
      },
    });
    return store;
  }
  const screenOf = (name: string, x: number, y: number) => {
    const svg = screen.getByRole("img", { name });
    const [cx, cy, zoom] = ["data-cx", "data-cy", "data-zoom"].map((a) =>
      Number(svg.getAttribute(a)),
    );
    return { clientX: 400 + (x - cx!) * zoom!, clientY: 300 - (y - cy!) * zoom! };
  };
  const uv = (s: ReturnType<typeof load>) => P(s).boards.find((b) => b.id === UV)!;
  const node = (s: ReturnType<typeof load>) => P(s).routeNodes.find((n) => n.id === "nuveg001")!;

  test("im Grundriss entlang der Wand ziehen: ein Befehl, Greifpunkt bleibt, v und Wandseite bleiben, Knoten folgt", () => {
    const store = withNode();
    const view = createViewStore({ activeStoreyId: EG });
    render(<PlanView store={store} view={view} />);
    const plan = screen.getByRole("img", { name: "Grundriss" });
    const undoBefore = store.undoLabel();
    // UV EG: Wand (4000,3000)→(8000,3000), u = 2000 → Mitte bei x = 6000; 100 mm rechts davon greifen
    fireEvent.pointerDown(plan, { button: 0, ...screenOf("Grundriss", 6100, 3000) });
    expect(view.getState().selection).toEqual({ kind: "board", id: UV });
    fireEvent.pointerMove(plan, screenOf("Grundriss", 6400, 2800));
    fireEvent.pointerMove(plan, screenOf("Grundriss", 6600, 3200));
    fireEvent.pointerUp(plan, screenOf("Grundriss", 6600, 3200));
    expect(uv(store).placement).toEqual({ surface: SIDE, u: 2500, v: 1500 });
    expect(node(store).anchors).toEqual([boardNodeAnchor(uv(store))]);
    expect(store.undoLabel()).toBe("Verteiler verschieben");
    store.undo();
    expect(uv(store).placement.u).toBe(2000);
    expect(store.undoLabel()).toBe(undoBefore);
  });

  test("Grundriss: über das Wandende hinaus bleibt der Verteiler ganz auf der Wandseite; Klick ohne Ziehen ändert nichts", () => {
    const store = withNode();
    const view = createViewStore({ activeStoreyId: EG });
    render(<PlanView store={store} view={view} />);
    const plan = screen.getByRole("img", { name: "Grundriss" });
    const undoBefore = store.undoLabel();
    fireEvent.pointerDown(plan, { button: 0, ...screenOf("Grundriss", 6000, 3000) });
    fireEvent.pointerUp(plan, screenOf("Grundriss", 6000, 3000));
    expect(store.undoLabel()).toBe(undoBefore);
    fireEvent.pointerDown(plan, { button: 0, ...screenOf("Grundriss", 6000, 3000) });
    fireEvent.pointerMove(plan, screenOf("Grundriss", 12000, 3000));
    fireEvent.pointerUp(plan, screenOf("Grundriss", 12000, 3000));
    const side = wallSides(P(store), EG).find((s) => s.ref === SIDE)!;
    expect(uv(store).placement.u).toBe(Math.round(side.uMax - 275));
  });

  test("Flächenansicht: Ziehen über das Wandende hinaus begrenzt u, v folgt frei; Knoten folgt", () => {
    const store = withNode();
    const view = createViewStore({ surface: { kind: "wall-side", ref: SIDE }, editor: "surface" });
    render(<SurfaceView store={store} view={view} />);
    const svg = screen.getByRole("img", { name: "Flächenansicht" });
    // ganze Wandseite in Rohbauhöhen (+120 mm Aufbau Wohnen)
    fireEvent.pointerDown(svg, { button: 0, ...screenOf("Flächenansicht", 2000, 1620) });
    fireEvent.pointerMove(svg, screenOf("Flächenansicht", -3000, 1720));
    fireEvent.pointerUp(svg, screenOf("Flächenansicht", -3000, 1720));
    const side = wallSides(P(store), EG).find((s) => s.ref === SIDE)!;
    expect(uv(store).placement).toEqual({ surface: SIDE, u: Math.round(side.uMin + 275), v: 1600 });
    expect(node(store).anchors).toEqual([boardNodeAnchor(uv(store))]);
    expect(store.undoLabel()).toBe("Verteiler verschieben");
  });

  test("Werkzeug „Verteiler“: Klick auf einen vorhandenen Verteiler wählt und verschiebt ihn statt einen neuen anzulegen (7.2)", () => {
    const store = withNode();
    const view = createViewStore({ surface: { kind: "wall-side", ref: SIDE }, editor: "surface" });
    render(<SurfaceView store={store} view={view} />);
    fireEvent.click(
      within(screen.getByRole("toolbar", { name: "Werkzeuge der Fläche" })).getByRole("button", {
        name: "Verteiler",
      }),
    );
    const svg = screen.getByRole("img", { name: "Flächenansicht" });
    fireEvent.pointerDown(svg, { button: 0, ...screenOf("Flächenansicht", 2000, 1620) });
    expect(view.getState().selection).toEqual({ kind: "board", id: UV });
    fireEvent.pointerMove(svg, screenOf("Flächenansicht", 2400, 1620));
    fireEvent.pointerUp(svg, screenOf("Flächenansicht", 2400, 1620));
    expect(screen.queryByRole("dialog", { name: "Verteiler anlegen" })).toBeNull();
    expect(P(store).boards).toHaveLength(4);
    expect(uv(store).placement.u).toBe(2400);
    expect(store.undoLabel()).toBe("Verteiler verschieben");
    // daneben auf der freien Wand: Dialog zum Anlegen
    fireEvent.pointerDown(svg, { button: 0, ...screenOf("Flächenansicht", 400, 1620) });
    expect(screen.getByRole("dialog", { name: "Verteiler anlegen" })).toBeInTheDocument();
  });
});

describe("Beschriftung in der Belegung (7.2)", () => {
  test("LS nebeneinander: senkrecht, auf das Gerät beschnitten, LS mit Typnamen zeigt den Stromkreis; alles im Tooltip", () => {
    const store = load("m4");
    store.execute({
      label: "LS und Kreis",
      run(d) {
        d.devices.push({
          id: "dls00002",
          label: "LS-Schalter",
          typeId: "mcb",
          status: "planned",
          placement: { kind: "board", boardId: "b2uveg01", fieldId: "f4vert02", row: 1, slot: 2 },
          storeyId: "e0g1k2m3",
        });
        d.circuits.push({
          id: "k3f3bad1",
          label: "F3 Bad",
          boardId: "b2uveg01",
          protectionDeviceId: "dls00002",
          lineTypeId: "nym-j-3x1-5",
        });
      },
    });
    const view = createViewStore();
    act(() => view.openBoard("b2uveg01"));
    render(<BoardView store={store} view={view} />);
    const svg = screen.getByRole("img", { name: "Belegung" });
    const ls = svg.querySelector('[data-board-device="dls00002"]')!;
    const label = ls.querySelector("[data-board-label]")!;
    expect(label).toHaveTextContent(/^F3$/);
    expect(label.getAttribute("transform")).toContain("rotate(-90)");
    // keine zweite Zeile mit dem Typnamen, Text auf das Geräterechteck beschnitten
    expect(ls.querySelectorAll("text")).toHaveLength(1);
    expect(ls.querySelector("[clip-path]")).not.toBeNull();
    expect(ls.querySelector("title")).toHaveTextContent("LS-Schalter");
    expect(ls.querySelector("title")).toHaveTextContent("F3 Bad");
    // eigene Bezeichnung bleibt
    const f1 = svg.querySelector('[data-board-device="d8lsf101"] [data-board-label]')!;
    expect(f1).toHaveTextContent("F1 LS B16");
  });

  test("Kürzel aus dem Symbol: genau ein Text, sonst keiner", () => {
    expect(symbolText("<rect/><text x='50' font-size='30'>LS</text>")).toBe("LS");
    expect(symbolText("<text>A</text><text>B</text>")).toBeNull();
    expect(symbolText(undefined)).toBeNull();
  });
});

describe("Belegungsansicht (2.4)", () => {
  function openUvOg() {
    const store = load("m4");
    const view = createViewStore({ selection: { kind: "board", id: "b3uvog01" } });
    render(
      <>
        <Properties store={store} view={view} />
        <BoardView store={store} view={view} />
      </>,
    );
    return { store, view };
  }

  test("„Belegung öffnen“ zeigt die UV OG (Spec-Scenario „Belegung öffnen“)", () => {
    const { view } = openUvOg();
    expect(screen.getByText("Kein Verteiler gewählt")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Belegung öffnen" }));
    expect(view.getState().editor).toBe("board");
    expect(screen.getByRole("heading", { name: "Belegung von" })).toHaveTextContent("UV OG");
    expect(
      screen.getByRole("img", { name: "Belegung" }).querySelectorAll("[data-row]"),
    ).toHaveLength(4);
  });

  test("Aktor auf einen Platz ziehen setzt ihn ein; auf belegtem Platz „Kein Platz …“", () => {
    const { store, view } = openUvOg();
    fireEvent.click(screen.getByRole("button", { name: "Belegung öffnen" }));
    const board = P(store).boards.find((b) => b.id === "b3uvog01")!;
    const svg = screen.getByRole("img", { name: "Belegung" });
    const drop = (row: number, slot: number) => {
      const p = slotPosition(board, { fieldId: "f5vert03", row, slot })!;
      return { clientX: p.x + 5, clientY: p.y + 10 };
    };
    fireEvent.pointerDown(screen.getByRole("button", { name: "Schaltaktor 16-fach einsetzen" }));
    fireEvent.pointerMove(svg, drop(3, 1));
    fireEvent.pointerUp(svg, drop(3, 1));
    const added = P(store).devices.find((d) => d.typeId === "knx-switch-actuator-16")!;
    expect(added.placement).toEqual({
      kind: "board",
      boardId: "b3uvog01",
      fieldId: "f5vert03",
      row: 3,
      slot: 1,
    });
    expect(store.undoLabel()).toBe("Gerät einsetzen");
    fireEvent.pointerDown(screen.getByRole("button", { name: "Jalousieaktor einsetzen" }));
    fireEvent.pointerUp(svg, drop(3, 5));
    expect(screen.getByRole("status", { name: "Meldung" })).toHaveTextContent(
      "Kein Platz: In Reihe 3 sind ab Platz 5 nur 0 TE frei",
    );
    // Umsetzen eines vorhandenen Geräts, danach Entf
    const ja = svg.querySelector('[data-board-device="d9ja0001"]')!;
    fireEvent.pointerDown(ja);
    expect(view.getState().selection).toEqual({ kind: "device", id: "d9ja0001" });
    fireEvent.pointerMove(svg, drop(2, 9));
    fireEvent.pointerUp(svg, drop(2, 9));
    expect(P(store).devices.find((d) => d.id === "d9ja0001")!.placement).toMatchObject({
      row: 2,
      slot: 9,
    });
    fireEvent.keyDown(window, { key: "Delete" });
    expect(P(store).devices.some((d) => d.id === "d9ja0001")).toBe(false);
  });
});

describe("Hierarchie im Baum (2.5)", () => {
  test("Baum zeigt die UV OG unter dem Zählerschrank; Stromkreise unter ihrem Verteiler", () => {
    const store = load("m4");
    const view = createViewStore({});
    render(<Tree store={store} view={view} />);
    const tree = screen.getByRole("tree", { name: "Verteiler" });
    const top = [...tree.querySelectorAll(':scope > [role="treeitem"]')].map((x) =>
      x.getAttribute("aria-label"),
    );
    expect(top).toEqual(["Medienverteiler", "UV EG", "Zählerschrank"]);
    const meter = within(tree).getByRole("treeitem", { name: "Zählerschrank" });
    const og = within(meter).getByRole("treeitem", { name: "UV OG" });
    expect(within(og).getByRole("treeitem", { name: "F2 Kind" })).toBeInTheDocument();
    fireEvent.click(
      within(tree).getByRole("treeitem", { name: "UV OG" }).querySelector(".tree__item")!,
    );
    expect(view.getState().selection).toEqual({ kind: "board", id: "b3uvog01" });
  });

  test("Übergeordneten Verteiler in den Eigenschaften wählen legt die Zuleitung an", () => {
    const store = load("m4");
    const view = createViewStore({ selection: { kind: "board", id: "b2uveg01" } });
    render(<Properties store={store} view={view} />);
    fireEvent.change(screen.getByLabelText("Übergeordneter Verteiler"), {
      target: { value: "b1zaehl1" },
    });
    const uv = P(store).boards.find((b) => b.id === "b2uveg01")!;
    expect(uv.parentBoardId).toBe("b1zaehl1");
    expect(P(store).cables.find((c) => c.id === uv.feedCableId)).toMatchObject({
      label: "Zuleitung UV EG",
      lineTypeId: "nym-j-5x10",
    });
    expect(screen.getByLabelText("Zuleitung")).toHaveValue("nym-j-5x10");
  });
});
