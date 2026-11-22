// Verteiler in der Oberfläche (Tasks 2.3–2.5): Werkzeug, Felder, Belegungsansicht, Baum
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { loadProject } from "../../../src/io/load";
import type { Project } from "../../../src/model/types";
import { createProjectStore } from "../../../src/store/history";
import { createViewStore } from "../../../src/store/view";
import { BoardView } from "../../../src/ui/board/BoardView";
import { slotPosition } from "../../../src/ui/board/layout";
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
