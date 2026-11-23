// Oberfläche M6: Projekteinstellungen Kondensat (3.2), Klimaverbindung (4.1)
import { fireEvent, render, screen, within } from "@testing-library/react";
import { loadProject } from "../../../src/io/load";
import type { Project } from "../../../src/model/types";
import { computeWarnings } from "../../../src/rules";
import { createProjectStore, type ProjectStore } from "../../../src/store/history";
import { ProjectSettings } from "../../../src/ui/ProjectSettings";
import { Properties } from "../../../src/ui/Properties";
import { Workspace } from "../../../src/ui/Workspace";
import { createSaveController } from "../../../src/store/save";
import { createViewStore } from "../../../src/store/view";
import type { Device } from "../../../src/model/types";
import { mockApi } from "../mock-api";
import { readFixture } from "../fixtures";
import { M6_IDS as I } from "../io/fixture-m6.gen.test";

function load(mutate?: (p: Project) => void): ProjectStore {
  const r = loadProject(readFixture("m6"));
  if (r.status !== "ok") throw new Error(JSON.stringify(r));
  const p = structuredClone(r.project);
  mutate?.(p);
  return createProjectStore(p);
}
const P = (s: ProjectStore) => s.getState().project;

describe("Projekteinstellungen Kondensat (3.2)", () => {
  test("2 % meldet ein 1,5-%-Segment, Rückgängig stellt 1 % her", () => {
    const store = load((p) => {
      p.routeNodes.find((n) => n.id === I.nodeAlong)!.anchors[0]!.v = 2035;
      p.cables.push({
        id: "ckwaage1",
        label: "Kondensat waagerecht",
        lineTypeId: "condensate",
        status: "planned",
        from: { deviceId: I.indoor },
        to: { deviceId: I.outdoor },
        path: [I.segPenetration, I.segAlong, I.segToOutdoor],
      });
    });
    const slopeKeys = () =>
      computeWarnings(P(store))
        .filter((w) => w.key.startsWith("condensate-slope"))
        .map((w) => w.text);
    expect(slopeKeys()).toEqual([]);
    render(<ProjectSettings store={store} onClose={() => {}} />);
    const f = screen.getByLabelText("Mindestgefälle (%)");
    expect((f as HTMLInputElement).value).toBe("1");
    fireEvent.change(f, { target: { value: "2" } });
    fireEvent.keyDown(f, { key: "Enter" });
    expect(P(store).settings.condensateMinSlopePercent).toBe(2);
    expect(slopeKeys()).toEqual([
      "Kondensat ohne Gefälle: Kondensat waagerecht (1,5 %, mindestens 2,0 %)",
    ]);
    expect(store.getState().undoStack.at(-1)!.label).toBe("Mindestgefälle ändern");
    store.undo();
    expect(P(store).settings.condensateMinSlopePercent).toBe(1);
    expect(slopeKeys()).toEqual([]);
  });

  test("Wert über 10 % wird abgelehnt", () => {
    const store = load();
    render(<ProjectSettings store={store} onClose={() => {}} />);
    const f = screen.getByLabelText("Mindestgefälle (%)");
    fireEvent.change(f, { target: { value: "12" } });
    fireEvent.keyDown(f, { key: "Enter" });
    expect(P(store).settings.condensateMinSlopePercent).toBe(1);
  });
});

describe("Klimaverbindung in den Eigenschaften (4.1)", () => {
  test("Innengerät zeigt Außengerät, Kältemittel- und Kondensatleitung (Spec-Scenario „Split-Gerät Schlafzimmer“)", () => {
    const store = load();
    const view = createViewStore({ selection: { kind: "device", id: I.indoor } });
    render(<Properties store={store} view={view} />);
    const box = screen.getByRole("region", { name: "Klimaverbindung" });
    expect(box).toHaveTextContent("Außengerät: Klima außen Schlafen");
    expect(box).toHaveTextContent("Kältemittelleitung: Kältemittel Schlafen · 5,9 m");
    expect(box).toHaveTextContent("keine Mehrlänge (vorgefüllt 7 m)");
    expect(box).toHaveTextContent(
      "Kondensatleitung: Kondensat Schlafen → Kondensatablauf Fallrohr · 3,0 m",
    );
    fireEvent.click(within(box).getByRole("button", { name: "Klima außen Schlafen" }));
    expect(view.getState().selection).toEqual({ kind: "device", id: I.outdoor });
  });

  test("Innengerät ohne Leitungen; Mehrlänge an der Leitung; Gefälle an der Kondensatleitung", () => {
    const store = load((p) => {
      p.cables = p.cables.filter((c) => !c.id.startsWith("ck"));
    });
    const view = createViewStore({ selection: { kind: "device", id: I.indoor } });
    const { unmount } = render(<Properties store={store} view={view} />);
    const box = screen.getByRole("region", { name: "Klimaverbindung" });
    expect(box).toHaveTextContent("kein Außengerät");
    expect(box).toHaveTextContent("keine Kondensatleitung");
    unmount();
    const s2 = load((p) => {
      p.catalog.deviceTypes.find((t) => t.id === "ac-outdoor")!.refrigerant!.prechargedLengthM = 5;
    });
    const v2 = createViewStore({ selection: { kind: "cable", id: I.refrigerantCable } });
    const r2 = render(<Properties store={s2} view={v2} />);
    expect(screen.getByLabelText("Mehrlänge")).toHaveTextContent(
      "Mehrlänge: 0,9 m (vorgefüllt 5 m)",
    );
    r2.unmount();
    const v3 = createViewStore({ selection: { kind: "cable", id: I.condensateCable } });
    render(<Properties store={s2} view={v3} />);
    expect(screen.getByLabelText("Gefälle")).toHaveTextContent("Gefälle min. 44,4 %");
  });

  test("Außengerät zeigt drei Verbindungen (Spec-Scenario „Multisplit“)", () => {
    const store = load((p) => {
      const indoor = p.devices.find((d) => d.id === I.indoor)!;
      for (const n of [2, 3]) {
        p.devices.push({
          ...structuredClone(indoor),
          id: `dkinnen${n}`,
          label: `Klima ${n}`,
        } as Device);
        p.cables.push({
          id: `ckkalt0${n}`,
          label: `Kältemittel ${n}`,
          lineTypeId: "refrigerant-pair",
          status: "planned",
          from: { deviceId: I.outdoor },
          to: { deviceId: `dkinnen${n}` },
          path: [],
        });
      }
    });
    const view = createViewStore({ selection: { kind: "device", id: I.outdoor } });
    render(<Properties store={store} view={view} />);
    const box = screen.getByRole("region", { name: "Klimaverbindung" });
    expect(box).toHaveTextContent("Kältemittelverbindungen: 3");
    expect(box).toHaveTextContent("Innengerät: Klima 2");
    expect(box).toHaveTextContent("Länge unbekannt (Leitung ohne Weg)");
  });

  test("Katalogdialog: Innengerät ohne Längenfelder, Wechsel auf Außengerät setzt unit", () => {
    const files = readFixture("m6");
    const result = loadProject(files);
    if (result.status !== "ok") throw new Error();
    const store = createProjectStore(result.project);
    render(
      <Workspace
        store={store}
        save={createSaveController(store, mockApi(files).api, result.contents)}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Katalog" }));
    const dialog = screen.getByRole("dialog", { name: "Katalog" });
    fireEvent.click(
      within(within(dialog).getByRole("listbox", { name: "Typen" })).getByRole("option", {
        name: /^Klima-Innengerät$/,
      }),
    );
    const form = within(dialog).getByRole("group", { name: "Eigenschaften des Typs" });
    expect(within(form).getByLabelText("Gerät")).toHaveValue("indoor");
    expect(within(form).queryByLabelText("Leitungslänge max.")).toBeNull();
    fireEvent.change(within(form).getByLabelText("Gerät"), { target: { value: "outdoor" } });
    const t = P(store).catalog.deviceTypes.find((x) => x.id === "ac-indoor")!;
    expect(t.refrigerant).toEqual({
      unit: "outdoor",
      minLengthM: 3,
      maxLengthM: 25,
      prechargedLengthM: 7,
    });
    expect(within(form).getByLabelText("Leitungslänge max.")).toBeInTheDocument();
  });
});
