import { expect, test, type Page } from "@playwright/test";
import { openProject, saveNow, storeyFile, worldToPage } from "./helpers";

async function open3d(page: Page) {
  await page.getByRole("tab", { name: "3D" }).click();
  await expect(page.getByTestId("scene").or(page.getByTestId("view-error"))).toBeVisible({
    timeout: 20000,
  });
  const error = page.getByTestId("view-error");
  if ((await error.count()) > 0) throw new Error(`3D-Ansicht: ${await error.innerText()}`);
}

test.describe("Möbel (5)", () => {
  test("Hängeschrank mit 1450 mm schwebt in Wandansicht und 3D (5.2, Spec-Scenario)", async ({
    page,
    request,
  }) => {
    await openProject(page, request, "m2");
    await page
      .getByRole("toolbar", { name: "Werkzeuge" })
      .getByRole("button", { name: "Möbel" })
      .click();
    await page
      .getByRole("group", { name: "Möbeloptionen" })
      .getByLabel("Möbeltyp")
      .selectOption({ label: "Küchenunterschrank" });
    // Rückseite 125 mm vor der fertigen Nordwand der Küche: rastet ein
    const s = await worldToPage(page, { x: 2000, y: 2500 });
    await page.mouse.click(s.x, s.y);
    const props = page.getByRole("complementary", { name: "Eigenschaften" });
    await expect(props.getByLabel("y (Mitte)")).toHaveValue("2625");
    const elevation = props.getByLabel("Höhe über OKFF");
    await elevation.fill("1450");
    await elevation.press("Enter");
    await page
      .getByRole("toolbar", { name: "Werkzeuge" })
      .getByRole("button", { name: "Auswählen" })
      .click();

    const wall = await worldToPage(page, { x: 1000, y: 2800 });
    await page.mouse.dblclick(wall.x, wall.y);
    await expect(page.getByRole("heading", { name: "Fläche" })).toHaveText("Küche › Wand Nord");
    const silhouette = page.getByTestId("surface-furniture").locator("[data-furniture]");
    await expect(silhouette).toHaveCount(1);
    await expect(silhouette).toHaveAttribute("y", "1450");
    await expect(silhouette).toHaveAttribute("height", "900");

    await open3d(page);
    // Unterseite: 120 mm Fußbodenaufbau + 1450 mm über OKFF
    await expect(page.getByTestId("scene")).toHaveAttribute(
      "data-furniture",
      /:2000,2625,1570(;|$)/,
    );

    await saveNow(page);
    const eg = await storeyFile(request, "eg");
    expect(eg.furniture!.find((f) => f.id !== "f1schrnk")).toMatchObject({
      typeId: "kitchen-base",
      x: 2000,
      y: 2625,
      rotationDeg: 0,
      elevationMm: 1450,
    });
  });
});
