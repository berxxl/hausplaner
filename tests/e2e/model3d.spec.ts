import { expect, test, type Page } from "@playwright/test";
import { openProject, worldToPage } from "./helpers";

async function open3d(page: Page) {
  await page.getByRole("tab", { name: "3D" }).click();
  // erstes Laden von three.js kann in der CI dauern
  await expect(page.getByTestId("scene")).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(() => "__hausplaner3d" in window);
  await page.waitForTimeout(300); // Kamera eingepasst
}

async function clickWorld3d(page: Page, x: number, y: number, z: number) {
  const p = await page.evaluate(
    ([x, y, z]) =>
      (
        window as unknown as {
          __hausplaner3d: { project(x: number, y: number, z: number): { x: number; y: number } };
        }
      ).__hausplaner3d.project(x!, y!, z!),
    [x, y, z],
  );
  await page.mouse.click(p.x, p.y);
}

test.describe("3D-Ansicht (8)", () => {
  test("Wand verschieben aktualisiert die Szene ohne Neuladen (8.1)", async ({ page, request }) => {
    await openProject(page, request);
    await open3d(page);
    await expect(page.getByTestId("scene")).toHaveAttribute("data-walls", /0bw2o0st:8000,0/);
    await page.getByRole("tab", { name: "Grundriss" }).click();
    const s = await worldToPage(page, { x: 8000, y: 1500 });
    await page.mouse.click(s.x, s.y);
    const field = page
      .getByRole("complementary", { name: "Eigenschaften" })
      .getByLabel("Parallel verschieben um (positiv nach links)");
    await field.fill("-200");
    await field.press("Enter");
    await open3d(page);
    await expect(page.getByTestId("scene")).toHaveAttribute("data-walls", /0bw2o0st:8200,0/);
  });

  test("„bis EG“ blendet höhere Geschosse aus (8.2)", async ({ page, request }) => {
    await openProject(page, request);
    for (const [name, elevation] of [
      ["OG", "2800"],
      ["DG", "5600"],
    ] as const) {
      await page.getByRole("button", { name: "Geschoss hinzufügen" }).click();
      const dialog = page.getByRole("dialog", { name: "Geschoss hinzufügen" });
      await dialog.getByLabel("Name").fill(name);
      await dialog.getByLabel("Höhenlage Rohfußboden").fill(elevation);
      await dialog.getByLabel("Höhenlage Rohfußboden").press("Tab");
      await dialog.getByRole("button", { name: "Hinzufügen" }).click();
    }
    await open3d(page);
    await expect(page.getByTestId("scene")).toHaveAttribute("data-storeys", "DG,EG,OG");
    await page.getByLabel("bis Geschoss").selectOption({ label: "EG" });
    await expect(page.getByTestId("scene")).toHaveAttribute("data-storeys", "EG");
  });

  test("Klick wählt Wand bzw. Raum, synchron mit Grundriss und Baum (8.3)", async ({
    page,
    request,
  }) => {
    await openProject(page, request);
    await open3d(page);
    await clickWorld3d(page, 6000, -150, 1500); // Außenseite der Südwand
    const props = page.getByRole("complementary", { name: "Eigenschaften" });
    await expect(props.getByRole("heading", { name: "Wand" })).toBeVisible();
    await expect(
      page.getByRole("treeitem", { name: "Wohnen" }).getByRole("treeitem", { name: "Wand Süd" }),
    ).toHaveAttribute("data-marked", "true");
    await clickWorld3d(page, 7500, 2700, 0); // Boden im Wohnen, von der Kamera aus nicht verdeckt
    await expect(props.getByRole("heading", { name: "Raum" })).toBeVisible();
    await expect(props.getByLabel("Name")).toHaveValue("Wohnen");
    await page.getByRole("tab", { name: "Grundriss" }).click();
    await expect(page.locator('[data-room="r2wohnen"]')).toHaveClass(/room--selected/);
  });
});
