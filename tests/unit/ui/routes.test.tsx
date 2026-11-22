// Trassen und Leitungen in der Oberfläche (Tasks 3.3–3.5, 4.3, 5.3, 5.4, 6.3)
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { loadProject } from "../../../src/io/load";
import type { Project } from "../../../src/model/types";
import { createProjectStore } from "../../../src/store/history";
import { createViewStore } from "../../../src/store/view";
import { visibleSelection } from "../../../src/ui/filter";
import { ProjectSettings } from "../../../src/ui/ProjectSettings";
import { Properties } from "../../../src/ui/Properties";
import { SurfaceView } from "../../../src/ui/surface/SurfaceView";
import { WarningBar } from "../../../src/ui/WarningBar";
import { readFixture } from "../fixtures";

const KUECHE_BAD = "wall:1bih0wst:R@r1kueche#0"; // u = x, fertige Ecken 165 / 3925, Decke 2365
const W = "wall:1bih0wst:R";

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

function openWall(name: string) {
  const store = load(name);
  const view = createViewStore({
    surface: { kind: "room-wall", key: KUECHE_BAD },
    editor: "surface",
  });
  render(<SurfaceView store={store} view={view} />);
  const svg = screen.getByRole("img", { name: "Flächenansicht" });
  const click = (u: number, v: number, init: object = {}) =>
    fireEvent.pointerDown(svg, { button: 0, ...screenOf(u, v), ...init });
  return { store, view, svg, click };
}

const near = (a: number, b: number, tol = 12) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

describe("Werkzeug „Trasse“ (3.3)", () => {
  test("von der oberen Zone senkrecht zur Steckdose: endet in einem Gerätknoten (Spec-Scenario „Trasse zur Steckdose“)", () => {
    const { store, click } = openWall("m2");
    fireEvent.click(screen.getByRole("button", { name: "Trasse" }));
    click(3500, 2065);
    click(3504, 1060); // nahe der Gerätemitte des Schalters (3500 / 1050)
    const p = store.getState().project;
    expect(p.routeSegments).toHaveLength(1);
    const dev = p.routeNodes.find((n) => n.deviceId === "d2schalt")!;
    expect(dev.anchors).toEqual([{ surface: W, u: 3500, v: 1050 }]);
    const top = p.routeNodes.find((n) => n.id !== dev.id)!;
    // Winkelfang: senkrecht über dem Gerät
    expect(top.anchors[0]!.u).toBe(3500);
    near(top.anchors[0]!.v, 2065);
    expect(store.undoLabel()).toBe("Trasse zeichnen");
  });

  test("Klick auf ein bestehendes Segment teilt es (Spec-Scenario „Abzweig“); Esc beendet den Zug", () => {
    const { store, click } = openWall("m3");
    fireEvent.click(screen.getByRole("button", { name: "Trasse" }));
    // waagerechtes Segment s3zone02 (2000 → 3500 auf 2065) bei u 2800 anklicken, dann nach unten
    click(2800, 2065);
    click(2800, 1200);
    const p = store.getState().project;
    expect(p.routeSegments.some((s) => s.id === "s3zone02")).toBe(false);
    const branch = p.routeNodes.find(
      (n) =>
        n.anchors[0]!.surface === W &&
        n.anchors[0]!.v === 2065 &&
        Math.abs(n.anchors[0]!.u - 2800) < 12,
    )!;
    expect(p.routeSegments.filter((s) => s.a === branch.id || s.b === branch.id)).toHaveLength(3);
    // Leitung über das geteilte Segment hat beide Teile
    expect(p.cables.find((c) => c.id === "c1licht1")!.path).toHaveLength(5);
    fireEvent.keyDown(window, { key: "Escape" });
    click(1000, 1000);
    expect(store.getState().project.routeSegments).toHaveLength(p.routeSegments.length);
  });

  test("bis an die rechte Raumecke: Übergangsknoten mit Anker in der Nachbarwand", () => {
    const { store, click } = openWall("m2");
    fireEvent.click(screen.getByRole("button", { name: "Trasse" }));
    click(3000, 2065);
    click(3923, 2065);
    const corner = store.getState().project.routeNodes.find((n) => n.anchors.length > 1)!;
    expect(corner.anchors).toEqual([
      { surface: W, u: 3925, v: 2065 },
      { surface: "wall:1aiv0ert:L", u: 3075, v: 2065 },
    ]);
  });
});

describe("Auswahl und Eigenschaften (3.4)", () => {
  test("drei Segmente gemeinsam auf „verlegt“, ein Undo-Schritt (Spec-Scenario „Mehrere Segmente verlegt“)", () => {
    const store = load("m3");
    const view = createViewStore({
      selection: {
        kind: "route-segment",
        id: "s2zone01",
        ids: ["s2zone01", "s3zone02", "s4hoch01"],
      },
    });
    render(<Properties store={store} view={view} />);
    const props = screen.getByRole("complementary", { name: "Eigenschaften" });
    expect(props).toHaveTextContent("3 Segmente ausgewählt");
    fireEvent.change(within(props).getByLabelText("Status"), { target: { value: "installed" } });
    const st = () =>
      store
        .getState()
        .project.routeSegments.filter((s) => ["s2zone01", "s3zone02", "s4hoch01"].includes(s.id))
        .map((s) => s.status);
    expect(st()).toEqual(["installed", "installed", "installed"]);
    act(() => store.undo());
    expect(st()).toEqual(["planned", "planned", "planned"]);
  });

  test("Knoten auf 1830 mm ab Raumecke, Segment auf „verlegt“ (Spec-Scenario „Aufmaß übernehmen“)", () => {
    const store = load("m3");
    const view = createViewStore({ selection: { kind: "route-node", id: "n4zone02" } });
    render(<Properties store={store} view={view} />);
    const props = screen.getByRole("complementary", { name: "Eigenschaften" });
    const field = within(props).getByLabelText("Abstand zur linken Raumecke");
    fireEvent.change(field, { target: { value: "1830" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(
      store.getState().project.routeNodes.find((n) => n.id === "n4zone02")!.anchors[0],
    ).toEqual({
      surface: W,
      u: 165 + 1830,
      v: 2065,
    });
    act(() => view.select({ kind: "route-segment", id: "s4hoch01" }));
    fireEvent.change(within(props).getByLabelText("Status"), { target: { value: "installed" } });
    expect(store.getState().project.routeSegments.find((s) => s.id === "s4hoch01")!.status).toBe(
      "installed",
    );
  });

  test("Segment: Länge, Leerrohr, Belegung mit Leitung zum Anklicken", () => {
    const store = load("m3");
    const view = createViewStore({ selection: { kind: "route-segment", id: "s3zone02" } });
    render(<Properties store={store} view={view} />);
    const props = screen.getByRole("complementary", { name: "Eigenschaften" });
    expect(within(props).getByLabelText("Länge")).toHaveTextContent("1500 mm");
    expect(within(props).getByLabelText("Leerrohr")).toHaveValue("M20");
    const occ = within(props).getByRole("region", { name: "Belegung" });
    expect(occ).toHaveTextContent("1 Leitung, 50 mm², Füllgrad 32 %");
    fireEvent.click(within(occ).getByRole("button", { name: "Schalter Küche – Deckenauslass" }));
    expect(view.getState().selection).toEqual({ kind: "cable", id: "c1licht1" });
  });

  test("in der Flächenansicht: Knoten anklicken wählt ihn, Shift-Klick auf Segmente sammelt", () => {
    const { view, click } = openWall("m3");
    click(2000, 2065);
    expect(view.getState().selection).toEqual({ kind: "route-node", id: "n4zone02" });
    click(2700, 2065);
    click(3700, 2065, { shiftKey: true });
    expect(view.getState().selection).toMatchObject({
      kind: "route-segment",
      ids: ["s3zone02", "s2zone01"],
    });
  });
});

describe("Durchbruch (3.5)", () => {
  test("Bohrung in der Küchenwand erscheint auf der Seite zum Bad", () => {
    const { store, view, click } = openWall("m2");
    fireEvent.click(screen.getByRole("button", { name: "Durchbruch" }));
    click(2000, 1000);
    const dialog = screen.getByRole("dialog", { name: "Durchbruch anlegen" });
    expect(within(dialog).getByLabelText("Durchmesser")).toHaveValue("40");
    fireEvent.click(within(dialog).getByRole("button", { name: "OK" }));
    const p = store.getState().project;
    const seg = p.routeSegments.find((s) => s.kind === "penetration")!;
    expect(seg.penetration).toEqual({ method: "drill", diameterMm: 40 });
    const far = p.routeNodes.find((n) => n.id === seg.b)!;
    expect(far.anchors[0]!.surface).toBe("wall:1bih0wst:L");
    near(far.anchors[0]!.u, 2000);
    act(() => view.openSurface({ kind: "room-wall", key: "wall:1bih0wst:L@r3bad00a#0" }));
    expect(
      screen.getByTestId("surface-routes").querySelectorAll("[data-penetration]"),
    ).toHaveLength(1);
  });
});

describe("Leitungen (5.3, 5.4)", () => {
  test("Status „geprüft“ (Spec-Scenario „Leitung geprüft“); Länge angezeigt", () => {
    const store = load("m3");
    const view = createViewStore({ selection: { kind: "cable", id: "c1licht1" } });
    render(<Properties store={store} view={view} />);
    const props = screen.getByRole("complementary", { name: "Eigenschaften" });
    expect(within(props).getByLabelText("Leitungslänge")).toHaveTextContent("5,3 m");
    fireEvent.change(within(props).getByLabelText("Status"), { target: { value: "verified" } });
    expect(store.getState().project.cables[0]!.status).toBe("verified");
  });

  test("Weg bearbeiten: Segmente in der Flächenansicht an- und abwählen, Fertig speichert", () => {
    const store = load("m3");
    const view = createViewStore({
      selection: { kind: "cable", id: "c1licht1" },
      surface: { kind: "room-wall", key: KUECHE_BAD },
      editor: "surface",
    });
    render(
      <>
        <SurfaceView store={store} view={view} />
        <Properties store={store} view={view} />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Weg bearbeiten" }));
    const svg = screen.getByRole("img", { name: "Flächenansicht" });
    fireEvent.pointerDown(svg, { button: 0, ...screenOf(2700, 2065) }); // s3zone02 entfernen
    fireEvent.click(screen.getByRole("button", { name: "Fertig" }));
    expect(store.getState().project.cables[0]!.path).toEqual(["s1stich1", "s4hoch01", "s5decke1"]);
    expect(store.undoLabel()).toBe("Weg ändern");
  });

  test("Zuschläge in den Projekteinstellungen ändern die Länge", () => {
    const store = load("m3");
    render(<ProjectSettings store={store} onClose={() => {}} />);
    const f = screen.getByLabelText("Verschnitt (%)");
    fireEvent.change(f, { target: { value: "0" } });
    fireEvent.keyDown(f, { key: "Enter" });
    expect(store.getState().project.settings.lengthAllowance).toEqual({
      perDeviceMm: 300,
      wastePercent: 0,
    });
    expect(store.undoLabel()).toBe("Leitungszuschläge ändern");
  });
});

describe("Warnungen und Filter (4.3, 6.3)", () => {
  test("Klick auf „Leitung ohne Weg“ wählt die Leitung", () => {
    const store = load("m3");
    const view = createViewStore();
    render(<WarningBar store={store} view={view} />);
    fireEvent.click(screen.getByRole("button", { name: /Warnung/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Leitung ohne Weg: Schalter Küche – Steckdose" }),
    );
    expect(view.getState().selection).toEqual({ kind: "cable", id: "c3ohne01" });
  });

  test("Klick auf eine Trassenwarnung öffnet die Raumansicht und wählt das Segment", () => {
    const store = load("m3", (p) => {
      // n4zone02 aus der Zone nach unten verschieben: Aufstieg beginnt nicht mehr in der Zone
      p.routeNodes.find((n) => n.id === "n4zone02")!.anchors[0]!.v = 1500;
    });
    const view = createViewStore();
    render(<WarningBar store={store} view={view} />);
    fireEvent.click(screen.getByRole("button", { name: /Warnung/ }));
    const rows = screen.getAllByRole("button", { name: "Trasse außerhalb Installationszone" });
    fireEvent.click(rows[0]!);
    expect(view.getState().selection?.kind).toBe("route-segment");
    expect(view.getState().surface).toEqual({ kind: "room-wall", key: KUECHE_BAD });
  });

  test("Kategorie „Trassen“ ausgeblendet: Auswahl von Knoten und Segmenten wird aufgehoben, Leitungen folgen ihrem Gewerk", () => {
    const p = load("m3").getState().project;
    const filter = { hiddenTrades: [], furnitureHidden: false, routesHidden: true };
    expect(visibleSelection(p, filter, { kind: "route-segment", id: "s1stich1" })).toBeNull();
    expect(visibleSelection(p, filter, { kind: "cable", id: "c1licht1" })).toEqual({
      kind: "cable",
      id: "c1licht1",
    });
    expect(
      visibleSelection(
        p,
        { hiddenTrades: ["power"], furnitureHidden: false },
        { kind: "cable", id: "c1licht1" },
      ),
    ).toBeNull();
  });
});

describe("Baum und Grundriss bei ausgewählter Leitung (5.4)", () => {
  test("Baum markiert die Flächen, über die die Leitung läuft", async () => {
    const { Tree } = await import("../../../src/ui/Tree");
    const store = load("m3");
    const view = createViewStore({ selection: { kind: "cable", id: "c2og0001" } });
    render(<Tree store={store} view={view} />);
    const marked = screen
      .getAllByRole("treeitem")
      .filter((x) => x.getAttribute("data-marked") === "true")
      .map((x) => x.querySelector(".tree__item")?.textContent ?? x.textContent);
    // Küchendecke (EG) und Boden im Kinderzimmer (OG, auch für den Deckendurchbruch)
    expect(marked).toEqual(["Decke", "Boden"]);
  });

  test("Weg bearbeiten: Klick auf ein Deckensegment im Grundriss nimmt es heraus", async () => {
    const { PlanView } = await import("../../../src/ui/plan/PlanView");
    const store = load("m3");
    const view = createViewStore({
      activeStoreyId: "e0g1k2m3",
      selection: { kind: "cable", id: "c1licht1" },
      pathEdit: {
        cableId: "c1licht1",
        segmentIds: ["s1stich1", "s3zone02", "s4hoch01", "s5decke1"],
      },
    });
    render(<PlanView store={store} view={view} />);
    const svg = screen.getByRole("img", { name: "Grundriss" });
    const [cx, cy, zoom] = ["data-cx", "data-cy", "data-zoom"].map((a) =>
      Number(svg.getAttribute(a)),
    );
    // s5decke1 läuft im Grundriss von (2000, 2925) nach (2000, 1500)
    fireEvent.pointerDown(svg, {
      button: 0,
      clientX: 400 + (2000 - cx!) * zoom!,
      clientY: 300 - (2200 - cy!) * zoom!,
    });
    expect(view.getState().pathEdit!.segmentIds).toEqual(["s1stich1", "s3zone02", "s4hoch01"]);
  });
});
