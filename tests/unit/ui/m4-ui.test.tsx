// M4 in der Oberfläche (Tasks 3.1, 3.3, 4.4, 5.7, 6.2)
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { loadProject } from "../../../src/io/load";
import { planSymbol } from "../../../src/geometry/devices";
import type { Device, Project } from "../../../src/model/types";
import { createProjectStore, type ProjectStore } from "../../../src/store/history";
import { createViewStore } from "../../../src/store/view";
import { ProjectSettings } from "../../../src/ui/ProjectSettings";
import { Properties } from "../../../src/ui/Properties";
import { SurfaceView } from "../../../src/ui/surface/SurfaceView";
import { Tree } from "../../../src/ui/Tree";
import { readFixture } from "../fixtures";

function load(mutate?: (p: Project) => void): ProjectStore {
  const r = loadProject(readFixture("m4"));
  if (r.status !== "ok") throw new Error();
  mutate?.(r.project);
  return createProjectStore(r.project);
}
const P = (s: ProjectStore) => s.getState().project;
const OG = "o9g1k2m3";

function screenOf(svg: Element, x: number, y: number) {
  const [cx, cy, zoom] = ["data-cx", "data-cy", "data-zoom"].map((a) =>
    Number(svg.getAttribute(a)),
  );
  return { clientX: 400 + (x - cx!) * zoom!, clientY: 300 - (y - cy!) * zoom! };
}

describe("Trasse zum Verteiler (3.1)", () => {
  test("Trasse bis an die UV endet in deren Knoten (Spec-Scenario „Trasse zum Verteiler“)", () => {
    const store = load();
    const view = createViewStore({
      surface: { kind: "room-wall", key: "wall:1cih0ost:R@r2wohnen#0" },
      editor: "surface",
    });
    render(<SurfaceView store={store} view={view} />);
    fireEvent.click(screen.getByRole("button", { name: "Trasse" }));
    const svg = screen.getByRole("img", { name: "Flächenansicht" });
    // UV EG: u = 2000, v = 1500, 550 × 1100 → Oberkante 2050
    fireEvent.pointerDown(svg, { button: 0, ...screenOf(svg, 2000, 2300) });
    fireEvent.pointerDown(svg, { button: 0, ...screenOf(svg, 2100, 1400) });
    const node = P(store).routeNodes.find((n) => n.boardId === "b2uveg01")!;
    expect(node.anchors).toEqual([{ surface: "wall:1cih0ost:R", u: 2000, v: 2050 }]);
    const seg = P(store).routeSegments.find((s) => s.a === node.id || s.b === node.id)!;
    expect(seg.surface).toBe("wall:1cih0ost:R");
    // zweite Trasse verwendet denselben Verteilerknoten
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerDown(svg, { button: 0, ...screenOf(svg, 1500, 2300) });
    fireEvent.pointerDown(svg, { button: 0, ...screenOf(svg, 1900, 1200) });
    expect(P(store).routeNodes.filter((n) => n.boardId === "b2uveg01")).toHaveLength(1);
  });
});

describe("Mehrfachauswahl über Flächen (3.3)", () => {
  test("zwei Rollladenmotoren an verschiedenen Wänden per Shift-Klick (Spec-Scenario „Geräte verschiedener Wände“)", async () => {
    const { PlanView } = await import("../../../src/ui/plan/PlanView");
    const second: Device = {
      id: "dmotost1",
      label: "Rollladen Ost",
      typeId: "shutter-motor",
      status: "planned",
      storeyId: OG,
      placement: { kind: "surface", surface: "wall:0bw2o0og:L", u: 4500, v: 2300, rotationDeg: 0 },
    };
    const store = load((p) => p.devices.push(second));
    const view = createViewStore({ activeStoreyId: OG });
    render(
      <>
        <PlanView store={store} view={view} />
        <Properties store={store} view={view} />
      </>,
    );
    const svg = screen.getByRole("img", { name: "Grundriss" });
    const at = (id: string) =>
      planSymbol(
        P(store),
        P(store).devices.find((d) => d.id === id)!,
      )!;
    const a = at("daroll01");
    const b = at("dmotost1");
    fireEvent.pointerDown(svg, { button: 0, ...screenOf(svg, a.x, a.y) });
    fireEvent.pointerUp(svg, { button: 0, ...screenOf(svg, a.x, a.y) });
    fireEvent.pointerDown(svg, { button: 0, shiftKey: true, ...screenOf(svg, b.x, b.y) });
    expect(view.getState().selection).toEqual({
      kind: "device",
      id: "daroll01",
      ids: ["daroll01", "dmotost1"],
    });
    const props = screen.getByRole("complementary", { name: "Eigenschaften" });
    expect(within(props).getByText("2 Geräte ausgewählt")).toBeInTheDocument();
    expect(within(props).getByRole("button", { name: "Waagerecht kombinieren" })).toBeDisabled();
    // „Gleiche im Geschoss auswählen“ und „Leitungen zu Verteiler …“
    fireEvent.click(within(props).getByRole("button", { name: "Gleiche im Geschoss auswählen" }));
    expect(view.selectedDevices().sort()).toEqual(["daroll01", "dmotost1"]);
    fireEvent.click(within(props).getByRole("button", { name: "Leitungen zu Verteiler …" }));
    const dialog = screen.getByRole("dialog", { name: "Leitungen zu Verteiler" });
    fireEvent.change(within(dialog).getByLabelText("Verteiler"), { target: { value: "b3uvog01" } });
    fireEvent.change(within(dialog).getByLabelText("Leitungstyp"), {
      target: { value: "nym-j-5x1-5" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "OK" }));
    expect(within(props).getByRole("status", { name: "Meldung" })).toHaveTextContent(
      "1 Leitungen angelegt, 1 übersprungen",
    );
    expect(P(store).cables.filter((c) => c.from.deviceId === "dmotost1")).toHaveLength(1);
  });
});

describe("Stromkreise in der Oberfläche (4.4)", () => {
  test("Stromkreis im Baum anklicken (Spec-Scenario „Stromkreis im Baum“)", () => {
    const store = load();
    const view = createViewStore({});
    render(
      <>
        <Tree store={store} view={view} />
        <Properties store={store} view={view} />
      </>,
    );
    const tree = screen.getByRole("tree", { name: "Verteiler" });
    fireEvent.click(within(tree).getByRole("treeitem", { name: "F1 Küche Steckdosen" }));
    expect(view.getState().selection).toEqual({ kind: "circuit", id: "k1f1kuec" });
    const props = screen.getByRole("complementary", { name: "Eigenschaften" });
    expect(within(props).getByRole("heading", { name: "Stromkreis" })).toBeInTheDocument();
    expect(within(props).getByLabelText("Schutzgerät")).toHaveValue("d8lsf101");
    expect(within(props).getByLabelText("Leitungen des Stromkreises")).toHaveTextContent(
      "1 Leitung",
    );
    expect(within(tree).getByRole("treeitem", { name: "UV EG" })).toHaveAttribute(
      "data-marked",
      "true",
    );
  });

  test("F2 auswählen markiert Geräte und Leitungen in den Ansichten (Spec-Scenario „Stromkreis hervorheben“)", async () => {
    const { PlanView } = await import("../../../src/ui/plan/PlanView");
    const store = load();
    const view = createViewStore({
      activeStoreyId: OG,
      selection: { kind: "circuit", id: "k2f2kind" },
    });
    render(<PlanView store={store} view={view} />);
    const svg = screen.getByRole("img", { name: "Grundriss" });
    const highlighted = [...svg.querySelectorAll('[data-device][data-highlighted="true"]')].map(
      (x) => x.getAttribute("data-device"),
    );
    expect(highlighted.sort()).toEqual(["d7bodog1", "daroll01"]);
    // Kurzname am Gerät
    expect(svg.querySelector('[data-circuit-label="daroll01"]')).toHaveTextContent("F2");
  });

  test("Stromkreis anlegen und Geräte zuweisen über die Eigenschaften", () => {
    const store = load();
    const view = createViewStore({ selection: { kind: "board", id: "b2uveg01" } });
    render(<Properties store={store} view={view} />);
    fireEvent.click(screen.getByRole("button", { name: "Stromkreis hinzufügen" }));
    const dialog = screen.getByRole("dialog", { name: "Stromkreis hinzufügen" });
    expect(within(dialog).getByLabelText("Bezeichnung")).toHaveValue("F3");
    fireEvent.change(within(dialog).getByLabelText("Bezeichnung"), {
      target: { value: "F3 Wohnen" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "OK" }));
    const circuit = P(store).circuits.find((c) => c.label === "F3 Wohnen")!;
    expect(view.getState().selection).toEqual({ kind: "circuit", id: circuit.id });
    act(() => view.select({ kind: "device", id: "d4boden1", ids: ["d4boden1", "d2schalt"] }));
    fireEvent.change(screen.getByLabelText("Stromkreis"), { target: { value: circuit.id } });
    expect(
      P(store)
        .devices.filter((d) => d.circuitId === circuit.id)
        .map((d) => d.id)
        .sort(),
    ).toEqual(["d2schalt", "d4boden1"]);
    act(() => view.select({ kind: "cable", id: "c5steck1" }));
    expect(screen.getByLabelText("Stromkreis")).toHaveTextContent("F1 Küche Steckdosen");
  });
});

describe("KNX in der Oberfläche (5.7)", () => {
  test("Vorschlag übernehmen und Kanäle automatisch zuordnen; Kanal am Verbraucher und Kanalliste am Aktor", () => {
    const store = load((p) => {
      for (let i = 1; i <= 4; i++)
        p.devices.push({
          id: `dmot000${i}`,
          label: `Rollladen ${i}`,
          typeId: "shutter-motor",
          status: "planned",
          storeyId: OG,
          placement: {
            kind: "surface",
            surface: "wall:0aw1s0og:L",
            u: 4500 + i * 200,
            v: 2300,
            rotationDeg: 0,
          },
        });
      for (let i = 1; i <= 4; i++)
        p.cables.push({
          id: `cmot000${i}`,
          label: "x",
          lineTypeId: "nym-j-5x1-5",
          status: "planned",
          from: { deviceId: `dmot000${i}` },
          to: { boardId: "b3uvog01" },
          path: [],
        });
    });
    const view = createViewStore({ selection: { kind: "board", id: "b3uvog01" } });
    render(<Properties store={store} view={view} />);
    const knx = screen.getByRole("table", { name: "KNX" });
    expect(within(knx).getByRole("row", { name: "Jalousie" })).toHaveTextContent(
      "Jalousie5641 × Jalousieaktor4",
    );
    fireEvent.click(screen.getByRole("button", { name: "Vorschlag übernehmen" }));
    expect(P(store).devices.some((d) => d.label === "JA2")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Kanäle automatisch zuordnen" }));
    expect(P(store).knxAssignments).toHaveLength(5);
    act(() => view.select({ kind: "device", id: "dmot0001" }));
    expect(screen.getByLabelText("KNX-Kanal")).toHaveDisplayValue(/^JA1\./);
    act(() => view.select({ kind: "device", id: "d9ja0001" }));
    expect(screen.getByRole("list", { name: "Kanäle" })).toHaveTextContent(
      "JA1.A → Rollladen Kind",
    );
  });
});

describe("Projekteinstellungen (6.2)", () => {
  test("TE-Reserve 30 % ändert die Prüfung, Rückgängig stellt 25 % her (Spec-Scenario „TE-Reserve ändern“)", () => {
    // UV EG: 48 TE, LS belegt 1, Schaltaktor-Vorschlag 4 → 43 frei (89 %); mit 34 TE belegt knapp
    const store = load((p) => {
      const uv = p.boards.find((b) => b.id === "b2uveg01")!;
      for (let i = 0; i < 8; i++)
        p.devices.push({
          id: `drcd000${i}`,
          label: `RCD ${i}`,
          typeId: "rcd",
          status: "planned",
          storeyId: uv.storeyId,
          placement: {
            kind: "board",
            boardId: uv.id,
            fieldId: "f4vert02",
            row: 2 + Math.floor(i / 3),
            slot: 1 + (i % 3) * 4,
          },
        });
    });
    // belegt 1 + 32 = 33, vorgemerkt 4 → frei 11 von 48 = 22,9 % < 25 %
    const reserveKeys = () =>
      import("../../../src/rules").then(({ computeWarnings }) =>
        computeWarnings(P(store))
          .filter((w) => w.key.startsWith("board-reserve-low"))
          .map((w) => w.key),
      );
    render(<ProjectSettings store={store} onClose={() => {}} />);
    const f = screen.getByLabelText("TE-Reserve (%)");
    fireEvent.change(f, { target: { value: "20" } });
    fireEvent.keyDown(f, { key: "Enter" });
    expect(P(store).settings.teReservePercent).toBe(20);
    expect(store.undoLabel()).toBe("Reserven ändern");
    return reserveKeys().then(async (none) => {
      expect(none).toEqual([]);
      fireEvent.change(screen.getByLabelText("TE-Reserve (%)"), { target: { value: "30" } });
      fireEvent.keyDown(screen.getByLabelText("TE-Reserve (%)"), { key: "Enter" });
      expect(await reserveKeys()).toEqual(["board-reserve-low:b2uveg01"]);
      act(() => store.undo());
      act(() => store.undo());
      expect(P(store).settings.teReservePercent).toBe(25);
      expect(await reserveKeys()).toEqual(["board-reserve-low:b2uveg01"]);
    });
  });

  test("KNX-Linie hinzufügen, Verteiler wählen, Teilnehmerzahl", () => {
    const store = load();
    render(<ProjectSettings store={store} onClose={() => {}} />);
    expect(screen.getByLabelText("Teilnehmer Linie 1.1")).toHaveTextContent("1 Teilnehmer");
    fireEvent.click(screen.getByRole("button", { name: "Linie hinzufügen" }));
    expect(P(store).knxLines.map((l) => l.label)).toEqual(["1.1", "1.2"]);
    fireEvent.change(screen.getByLabelText("Verteiler Linie 1.2"), {
      target: { value: "b2uveg01" },
    });
    expect(P(store).knxLines[1]!.boardId).toBe("b2uveg01");
  });
});
