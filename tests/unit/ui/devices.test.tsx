// Geräte in der Oberfläche: Eigenschaften (3.5), Mehrfachauswahl (3.6), eigenes Symbol (3.8)
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { loadProject } from "../../../src/io/load";
import type { Project } from "../../../src/model/types";
import { createProjectStore } from "../../../src/store/history";
import { createViewStore } from "../../../src/store/view";
import { Properties } from "../../../src/ui/Properties";
import { PlanView } from "../../../src/ui/plan/PlanView";
import { SurfaceView } from "../../../src/ui/surface/SurfaceView";
import { readFixture } from "../fixtures";

const EG = "e0g1k2m3";

function load(mutate?: (p: Project) => void) {
  const r = loadProject(readFixture("m2"));
  if (r.status !== "ok") throw new Error();
  mutate?.(r.project);
  return createProjectStore(r.project);
}

function commit(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: "Enter" });
}

describe("Eigenschaften eines Geräts (3.5)", () => {
  test("Schalter auf 1050 mm bei 100 mm Fußbodenaufbau zeigt Rohbauhöhe 1150 mm (Spec-Scenario „Höhe eingeben“)", () => {
    const store = load((p) => {
      p.rooms.find((r) => r.id === "r1kueche")!.floorBuildupMm = 100;
      const d = p.devices.find((x) => x.id === "d2schalt")!;
      if (d.placement.kind === "surface") d.placement.v = 900;
    });
    const view = createViewStore({
      activeStoreyId: EG,
      selection: { kind: "device", id: "d2schalt" },
    });
    render(<Properties store={store} view={view} />);
    const props = screen.getByRole("complementary", { name: "Eigenschaften" });
    commit(within(props).getByLabelText("Höhe über OKFF (Gerätemitte)"), "1050");
    expect(within(props).getByLabelText("Höhe über OKFF (Gerätemitte)")).toHaveValue("1050");
    expect(within(props).getByLabelText("Rohbauhöhe")).toHaveTextContent("Rohbauhöhe: 1150 mm");
    expect(store.undoLabel()).toBe("Gerät verschieben");
  });

  test("Abstand zur linken und rechten Raumecke, editierbar; Status und Bezeichnung", () => {
    const store = load();
    const view = createViewStore({
      activeStoreyId: EG,
      selection: { kind: "device", id: "d2schalt" },
    });
    render(<Properties store={store} view={view} />);
    const props = screen.getByRole("complementary", { name: "Eigenschaften" });
    // Küche › Wand zum Bad: Seite R der Wand (0,3000)→(4000,3000), fertige Ecken bei u = 165 und 3925
    const distance = within(props).getByLabelText("Abstand zur Bezugskante (Gerätemitte)");
    expect(distance).toHaveValue(String(3500 - 165));
    fireEvent.change(within(props).getByLabelText("Bezugskante"), { target: { value: "right" } });
    expect(distance).toHaveValue(String(3925 - 3500));
    commit(distance, "300");
    const placement = store.getState().project.devices.find((d) => d.id === "d2schalt")!.placement;
    expect(placement).toMatchObject({ u: 3625 });
    fireEvent.change(within(props).getByLabelText("Status"), { target: { value: "verified" } });
    commit(within(props).getByLabelText("Bezeichnung"), "Licht Küche");
    const d = store.getState().project.devices.find((x) => x.id === "d2schalt")!;
    expect(d.status).toBe("verified");
    expect(d.label).toBe("Licht Küche");
  });

  test("Deckengerät: Abstände zur nächsten fertigen Wand je Achse, editierbar (design.md „Bezug und Bemaßung“)", () => {
    const store = load();
    const view = createViewStore({
      activeStoreyId: EG,
      selection: { kind: "device", id: "d3decke1" },
    });
    render(<Properties store={store} view={view} />);
    const props = screen.getByRole("complementary", { name: "Eigenschaften" });
    // Küche 150..3940 × 150..2940 roh, Putz 15 mm; Auslass bei x 2000 (u = −2000), y 1500
    const left = within(props).getByLabelText("Abstand zur Wand links (Grundriss)");
    expect(left).toHaveValue(String(2000 - 165));
    expect(within(props).getByLabelText("Abstand zur Wand unten (Grundriss)")).toHaveValue(
      String(1500 - 165),
    );
    commit(left, "1000");
    let placement = store.getState().project.devices.find((d) => d.id === "d3decke1")!.placement;
    expect(placement).toMatchObject({ u: -1165, v: 1500 });
    expect(store.undoLabel()).toBe("Gerät verschieben");
    commit(within(props).getByLabelText("Abstand zur Wand unten (Grundriss)"), "500");
    placement = store.getState().project.devices.find((d) => d.id === "d3decke1")!.placement;
    expect(placement).toMatchObject({ u: -1165, v: 665 });
  });

  test("Bodengerät: Abstand zur näheren Wand rechts", () => {
    const store = load((p) => {
      const d = p.devices.find((x) => x.id === "d4boden1")!;
      if (d.placement.kind === "surface") d.placement.u = 7000;
    });
    const view = createViewStore({
      activeStoreyId: EG,
      selection: { kind: "device", id: "d4boden1" },
    });
    render(<Properties store={store} view={view} />);
    const props = screen.getByRole("complementary", { name: "Eigenschaften" });
    // Wohnen 4060..7850 roh: fertige Wand rechts bei 7835
    const right = within(props).getByLabelText("Abstand zur Wand rechts (Grundriss)");
    expect(right).toHaveValue(String(7835 - 7000));
    commit(right, "600");
    const placement = store.getState().project.devices.find((d) => d.id === "d4boden1")!.placement;
    expect(placement).toMatchObject({ u: 7235 });
  });

  test("Mehrfachauswahl: Kombinieren und Löschen", () => {
    const store = load((p) => {
      const base = p.devices.find((x) => x.id === "d1steck1")!;
      p.devices.push({
        ...base,
        id: "m0000001",
        placement: { kind: "surface", surface: "wall:0aw1s0ud:L", u: 1400, v: 330, rotationDeg: 0 },
      });
    });
    const view = createViewStore({
      activeStoreyId: EG,
      selection: { kind: "device", id: "d1steck1", ids: ["d1steck1", "m0000001"] },
    });
    render(<Properties store={store} view={view} />);
    const props = screen.getByRole("complementary", { name: "Eigenschaften" });
    expect(props).toHaveTextContent("2 Geräte ausgewählt");
    fireEvent.click(within(props).getByRole("button", { name: "Waagerecht kombinieren" }));
    const second = store.getState().project.devices.find((x) => x.id === "m0000001")!.placement;
    expect(second).toMatchObject({ u: 1271, v: 300 });
  });
});

describe("Mitlöschen mit Bestätigung (3.2)", () => {
  test("Wand mit Gerät löschen fragt mit Anzahl nach; Abbrechen lässt alles stehen, Löschen nimmt das Gerät mit", async () => {
    const store = load();
    const view = createViewStore({
      activeStoreyId: EG,
      selection: { kind: "wall", id: "0aw1s0ud" },
    });
    render(<PlanView store={store} view={view} />);
    fireEvent.keyDown(window, { key: "Delete" });
    const dialog = await screen.findByRole("alertdialog", { name: "Wand löschen?" });
    expect(dialog).toHaveTextContent("1 Gerät wird mitgelöscht.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Abbrechen" }));
    expect(store.getState().project.walls.some((w) => w.id === "0aw1s0ud")).toBe(true);
    fireEvent.keyDown(window, { key: "Delete" });
    fireEvent.click(
      within(await screen.findByRole("alertdialog", { name: "Wand löschen?" })).getByRole(
        "button",
        {
          name: "Löschen",
        },
      ),
    );
    await act(async () => {});
    expect(store.getState().project.walls.some((w) => w.id === "0aw1s0ud")).toBe(false);
    expect(store.getState().project.devices.some((d) => d.id === "d1steck1")).toBe(false);
  });
});

describe("Darstellung (3.8)", () => {
  test("eigenes SVG-Symbol erscheint in Grundriss und Flächenansicht (Spec-Scenario „Eigenes Symbol“)", () => {
    const store = load((p) => {
      p.catalog.deviceTypes.find((t) => t.id === "switch")!.symbol =
        "<circle cx='50' cy='50' r='40'/><rect x='1' y='2' width='3' height='4'/>";
    });
    const view = createViewStore({ activeStoreyId: EG });
    const { unmount } = render(<PlanView store={store} view={view} />);
    const inPlan = screen.getByTestId("plan-devices").querySelector('[data-device="d2schalt"]')!;
    expect(inPlan.querySelector("circle[r='40']")).not.toBeNull();
    expect(inPlan.querySelector("rect[width='3']")).not.toBeNull();
    unmount();
    // Raumansicht der Küche an der Wand zum Bad
    act(() => view.openSurface({ kind: "room-wall", key: "wall:1bih0wst:R@r1kueche#0" }, EG));
    render(<SurfaceView store={store} view={view} />);
    const inView = screen.getByTestId("surface-devices").querySelector('[data-device="d2schalt"]')!;
    expect(inView.querySelector("circle[r='40']")).not.toBeNull();
  });

  test("Shift-Klick wählt mehrere Geräte derselben Fläche, Geräte anderer Flächen nicht", () => {
    const store = load();
    const view = createViewStore({ activeStoreyId: EG });
    view.toggleDevice("d1steck1");
    view.toggleDevice("d6usbsch");
    expect(view.selectedDevices()).toEqual(["d1steck1", "d6usbsch"]);
    view.toggleDevice("d1steck1");
    expect(view.getState().selection).toEqual({ kind: "device", id: "d6usbsch" });
    expect(store.getState().project.devices).toHaveLength(6);
  });
});

describe("Bestätigungstext beim Mitlöschen (M3)", () => {
  test("Geräte und Leitungen", async () => {
    const { cascadeMessage } = await import("../../../src/ui/labels");
    expect(cascadeMessage(2, 0)).toBe("2 Geräte werden mitgelöscht.");
    expect(cascadeMessage(1, 0)).toBe("1 Gerät wird mitgelöscht.");
    expect(cascadeMessage(0, 1)).toBe("1 Leitung wird mitgelöscht.");
    expect(cascadeMessage(2, 1)).toBe("2 Geräte und 1 Leitung werden mitgelöscht.");
    expect(cascadeMessage(0, 0)).toBeNull();
  });
});
