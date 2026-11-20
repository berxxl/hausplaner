import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { calibrate, newUnderlay } from "../../../src/geometry/underlay";
import { loadProject } from "../../../src/io/load";
import { createProjectStore } from "../../../src/store/history";
import { setUnderlay } from "../../../src/store/commands";
import { createSaveController } from "../../../src/store/save";
import { Workspace } from "../../../src/ui/Workspace";
import { readFixture } from "../fixtures";
import { mockApi } from "../mock-api";

function open() {
  const files = readFixture("klein");
  const result = loadProject(files);
  if (result.status !== "ok") throw new Error();
  const store = createProjectStore(result.project);
  const server = mockApi(files);
  render(
    <Workspace
      store={store}
      save={createSaveController(store, server.api, result.contents)}
      api={server.api}
    />,
  );
  fireEvent.click(screen.getByRole("treeitem", { name: "EG" }));
  return { store, server, section: () => screen.getByRole("region", { name: "Planhintergrund" }) };
}

const underlay = (store: ReturnType<typeof open>["store"]) =>
  store.getState().project.storeys[0]!.underlay;

describe("Planhintergrund in den Eigenschaften (5.3–5.5)", () => {
  test("PDF wählen lädt hoch und speichert den gelieferten Pfad", async () => {
    const { store, server, section } = open();
    const file = new File(["%PDF-1.4"], "eg plan.pdf", { type: "application/pdf" });
    await act(async () => {
      fireEvent.change(within(section()).getByLabelText("PDF-Datei"), {
        target: { files: [file] },
      });
    });
    expect(server.api.putPlan).toHaveBeenCalledWith("eg plan.pdf", file);
    expect(underlay(store)).toEqual(newUnderlay("plaene/eg plan.pdf"));
    expect(store.undoLabel()).toBe("Plan wählen");
  });

  test("Ausblenden und wieder einblenden, rückgängig machbar", () => {
    const { store, section } = open();
    act(() => store.execute(setUnderlay("e0g1k2m3", newUnderlay("plaene/eg.pdf"), "Plan wählen")));
    fireEvent.click(within(section()).getByLabelText("Plan anzeigen"));
    expect(underlay(store)?.visible).toBe(false);
    expect(store.undoLabel()).toBe("Plan ausblenden");
    act(() => store.undo());
    expect(within(section()).getByLabelText("Plan anzeigen")).toBeChecked();
  });

  test("Deckkraft wird auf 0,01 gerundet; Ziehen ist ein Undo-Schritt", () => {
    const { store, section } = open();
    act(() => store.execute(setUnderlay("e0g1k2m3", newUnderlay("plaene/eg.pdf"), "Plan wählen")));
    const slider = within(section()).getByLabelText("Deckkraft");
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: "0.7" } });
    fireEvent.change(slider, { target: { value: "0.333" } });
    fireEvent.pointerUp(slider);
    expect(underlay(store)?.opacity).toBe(0.33);
    expect(store.getState().undoStack.map((e) => e.label)).toEqual([
      "Plan wählen",
      "Deckkraft ändern",
    ]);
  });

  test("Kalibrierung rückgängig stellt die vorige Kalibrierung her", () => {
    const { store, section } = open();
    const first = calibrate(
      newUnderlay("plaene/eg.pdf"),
      { x: 170.1, y: 705.8 },
      { x: 290.8, y: 705.8 },
      4260,
    );
    act(() => store.execute(setUnderlay("e0g1k2m3", first, "Kalibrieren")));
    expect(section()).toHaveTextContent("Kalibriert über 4260 mm");
    act(() =>
      store.execute(
        setUnderlay(
          "e0g1k2m3",
          calibrate(first, { x: 10, y: 10 }, { x: 110, y: 10 }, 3000),
          "Kalibrieren",
        ),
      ),
    );
    expect(section()).toHaveTextContent("Kalibriert über 3000 mm");
    act(() => store.undo());
    expect(underlay(store)).toEqual(first);
    expect(section()).toHaveTextContent("Kalibriert über 4260 mm");
  });

  test("Plan aus anderem Geschoss übernehmen: Datei, Kalibrierung, Ausrichtung, nächste Seite", async () => {
    const { store } = open();
    const calibrated = calibrate(
      newUnderlay("plaene/eg.pdf"),
      { x: 170.1, y: 705.8 },
      { x: 290.8, y: 705.8 },
      4260,
    );
    act(() => {
      store.execute(
        setUnderlay(
          "e0g1k2m3",
          { ...calibrated, offset: { x: 100, y: -50 }, rotationDeg: 1.5 },
          "Kalibrieren",
        ),
      );
      store.execute({
        label: "Geschoss anlegen",
        run: (d) =>
          void d.storeys.push({
            id: "og000001",
            name: "OG",
            slug: "og",
            elevationMm: 2800,
            rawHeightMm: 2500,
            defaults: { floorBuildupMm: 120, plasterMm: 15, suspendedMm: 0 },
          }),
      });
    });
    fireEvent.click(screen.getByRole("treeitem", { name: "OG" }));
    const section = screen.getByRole("region", { name: "Planhintergrund" });
    const adopt = within(section).getByLabelText("Plan aus anderem Geschoss übernehmen");
    expect(within(adopt).getByRole("option", { name: "EG: eg.pdf, Seite 1" })).toBeInTheDocument();
    await act(async () => {
      fireEvent.change(adopt, { target: { value: "e0g1k2m3" } });
    });
    const og = store.getState().project.storeys.find((s) => s.id === "og000001")!;
    expect(og.underlay).toEqual({
      ...calibrated,
      offset: { x: 100, y: -50 },
      rotationDeg: 1.5,
      page: 2,
    });
    expect(store.undoLabel()).toBe("Plan übernehmen");
  });
});
