// Werkzeug „Raumgrenze“ im Grundriss (m4 R.1)
import { fireEvent, render, screen, within } from "@testing-library/react";
import { loadProject } from "../../../src/io/load";
import { deleteWall } from "../../../src/store/building";
import { createProjectStore } from "../../../src/store/history";
import { createViewStore } from "../../../src/store/view";
import { PlanView } from "../../../src/ui/plan/PlanView";
import { Properties } from "../../../src/ui/Properties";
import { readFixture } from "../fixtures";

test("Raumgrenze zeichnen rastet an den Wandachsen ein, auswählen und löschen", () => {
  const r = loadProject(readFixture("klein"));
  if (r.status !== "ok") throw new Error();
  const store = createProjectStore(r.project);
  store.execute(deleteWall("1cih0ost"));
  const view = createViewStore({ activeStoreyId: "e0g1k2m3" });
  render(
    <>
      <PlanView store={store} view={view} />
      <Properties store={store} view={view} />
    </>,
  );
  const svg = screen.getByRole("img", { name: "Grundriss" });
  const at = (x: number, y: number) => {
    const [cx, cy, zoom] = ["data-cx", "data-cy", "data-zoom"].map((a) =>
      Number(svg.getAttribute(a)),
    );
    return { clientX: 400 + (x - cx!) * zoom!, clientY: 300 - (y - cy!) * zoom! };
  };
  fireEvent.click(
    within(screen.getByRole("toolbar", { name: "Werkzeuge" })).getByRole("button", {
      name: "Raumgrenze",
    }),
  );
  // Anfang in der Innenwand x = 4000 (Körper ±60), Ende in der Außenwand x = 8000 (±150)
  fireEvent.pointerDown(svg, { button: 0, ...at(4040, 3010) });
  fireEvent.pointerDown(svg, { button: 0, ...at(7880, 3010) });
  const b = store.getState().project.roomBoundaries[0]!;
  // Anfang rastet auf das Ende der Wand Küche/Bad (4000/3000), Ende auf die Achse der Ostwand,
  // waagerecht zum Anfang
  expect([b.start, b.end]).toEqual([
    { x: 4000, y: 3000 },
    { x: 8000, y: 3000 },
  ]);
  expect(store.undoLabel()).toBe("Raumgrenze zeichnen");
  expect(view.getState().selection).toEqual({ kind: "room-boundary", id: b.id });
  expect(svg.querySelector(`[data-boundary="${b.id}"]`)).not.toBeNull();
  const props = screen.getByRole("complementary", { name: "Eigenschaften" });
  expect(within(props).getByLabelText("Länge")).toHaveTextContent("4000 mm");
  fireEvent.click(within(props).getByRole("button", { name: "Raumgrenze löschen" }));
  expect(store.getState().project.roomBoundaries).toEqual([]);
});
