import { loadProject } from "../../../src/io/load";
import { deviceTrade, isDeviceVisible, visibleSelection } from "../../../src/ui/filter";
import { readFixture } from "../fixtures";

function m2() {
  const r = loadProject(readFixture("m2"));
  if (r.status !== "ok") throw new Error();
  return r.project;
}

describe("Gewerkfilter (7.1)", () => {
  test("Gewerk aus dem Typ; unbekannter Typ zählt zu Sonstiges", () => {
    const p = m2();
    const d = p.devices.find((x) => x.id === "d5klima1")!;
    expect(deviceTrade(p, d)).toBe("refrigerant");
    expect(deviceTrade(p, { ...d, typeId: "weg" })).toBe("other");
    expect(isDeviceVisible(p, { hiddenTrades: ["refrigerant"], furnitureHidden: false }, d)).toBe(
      false,
    );
  });

  test("Auswahl ausgeblendeter Elemente wird aufgehoben, Mehrfachauswahl verkleinert", () => {
    const p = m2();
    const power = { hiddenTrades: ["power" as const], furnitureHidden: false };
    expect(visibleSelection(p, power, { kind: "device", id: "d1steck1" })).toBeNull();
    expect(
      visibleSelection(p, power, { kind: "device", id: "d1steck1", ids: ["d1steck1", "d5klima1"] }),
    ).toEqual({ kind: "device", id: "d5klima1" });
    const noFurniture = { hiddenTrades: [], furnitureHidden: true };
    expect(visibleSelection(p, noFurniture, { kind: "furniture", id: "f1schrnk" })).toBeNull();
    expect(visibleSelection(p, noFurniture, { kind: "wall", id: "0aw1s0ud" })).toEqual({
      kind: "wall",
      id: "0aw1s0ud",
    });
  });
});
