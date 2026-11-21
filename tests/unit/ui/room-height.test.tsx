// Raumeigenschaften: Rohbauhöhe je Raum (8.1)
import { fireEvent, render, screen, within } from "@testing-library/react";
import { loadProject } from "../../../src/io/load";
import { createProjectStore } from "../../../src/store/history";
import { createViewStore } from "../../../src/store/view";
import { Properties } from "../../../src/ui/Properties";
import { readFixture } from "../fixtures";

test("Rohbauhöhe des Raums: leer zeigt den Geschosswert, Eingabe überschreibt, leeren setzt zurück", () => {
  const r = loadProject(readFixture("m2"));
  if (r.status !== "ok") throw new Error();
  const store = createProjectStore(r.project);
  const view = createViewStore({
    activeStoreyId: "e0g1k2m3",
    selection: { kind: "room", id: "r1kueche" },
  });
  render(<Properties store={store} view={view} />);
  const props = screen.getByRole("complementary", { name: "Eigenschaften" });
  const field = within(props).getByLabelText("Rohbauhöhe");
  expect(field).toHaveValue("");
  expect(field).toHaveAttribute("placeholder", "2500 (Standard)");
  fireEvent.change(field, { target: { value: "2460" } });
  fireEvent.keyDown(field, { key: "Enter" });
  expect(store.getState().project.rooms.find((x) => x.id === "r1kueche")!.rawHeightMm).toBe(2460);
  fireEvent.change(field, { target: { value: "" } });
  fireEvent.blur(field);
  expect("rawHeightMm" in store.getState().project.rooms.find((x) => x.id === "r1kueche")!).toBe(
    false,
  );
});
