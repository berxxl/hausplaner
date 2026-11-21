import { expect, test, type Page } from "@playwright/test";
import { openProject, worldToPage } from "./helpers";

async function open3d(page: Page) {
  await page.getByRole("tab", { name: "3D" }).click();
  await expect(page.getByTestId("scene").or(page.getByTestId("view-error"))).toBeVisible({
    timeout: 20000,
  });
  const error = page.getByTestId("view-error");
  if ((await error.count()) > 0) throw new Error(`3D-Ansicht: ${await error.innerText()}`);
}

const filter = (page: Page) => page.getByRole("group", { name: "Gewerkfilter" });

test.describe("Gewerkfilter (7)", () => {
  test("nur KNX (7.1, Spec-Scenario): Grundriss, Flächenansicht und 3D zeigen nur Gebäude und KNX-Geräte", async ({
    page,
    request,
  }) => {
    await openProject(page, request, "m2");
    // Präsenzmelder KNX an die Decke der Küche
    await page
      .getByRole("toolbar", { name: "Werkzeuge" })
      .getByRole("button", { name: "Gerät" })
      .click();
    await page
      .getByRole("group", { name: "Geräteoptionen" })
      .getByLabel("Gerätetyp", { exact: true })
      .selectOption({ label: "Präsenzmelder KNX" });
    const s = await worldToPage(page, { x: 1000, y: 1000 });
    await page.mouse.click(s.x, s.y);
    await page
      .getByRole("toolbar", { name: "Werkzeuge" })
      .getByRole("button", { name: "Auswählen" })
      .click();
    const planDevices = page.getByTestId("plan-devices").locator("[data-device]");
    await expect(planDevices).toHaveCount(7);

    for (const name of [
      "Strom",
      "Daten",
      "Leerrohr",
      "Kältemittel",
      "Kondensat",
      "Sonstiges",
      "Möbel",
    ])
      await filter(page).getByRole("button", { name, exact: true }).click();
    await expect(filter(page).getByRole("button", { name: "KNX" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(planDevices).toHaveCount(1);
    await expect(page.getByTestId("plan-furniture").locator("[data-furniture]")).toHaveCount(0);
    await expect(page.getByTestId("plan-devices").locator('[data-device="d3decke1"]')).toHaveCount(
      0,
    );
    // Gebäude bleibt
    await expect(page.locator("[data-wall]").first()).toBeVisible();

    // Deckenspiegel der Küche: nur der Präsenzmelder
    const near = await worldToPage(page, { x: 2000, y: 400 });
    await page.mouse.dblclick(near.x, near.y);
    await page
      .getByRole("navigation", { name: "Navigation" })
      .getByRole("button", { name: "Decke" })
      .click();
    await expect(page.getByTestId("surface-devices").locator("[data-device]")).toHaveCount(1);

    await open3d(page);
    const scene = page.getByTestId("scene");
    await expect(scene).not.toHaveAttribute("data-devices", /d3decke1|d1steck1/);
    await expect(scene).toHaveAttribute("data-devices", /^[0-9a-z]{8}:\d+,\d+,2485$/);
    await expect(scene).toHaveAttribute("data-furniture", "");
    await expect(scene).not.toHaveAttribute("data-walls", "");
  });

  test("Möbel ausblenden (7.1, Spec-Scenario): Möbel und Silhouetten verschwinden, Geräte bleiben", async ({
    page,
    request,
  }) => {
    await openProject(page, request, "m2");
    await expect(page.getByTestId("plan-furniture").locator("[data-furniture]")).toHaveCount(1);
    // Schrank auswählen; Ausblenden hebt die Auswahl auf
    const wardrobe = await worldToPage(page, { x: 6000, y: 5550 });
    await page.mouse.click(wardrobe.x, wardrobe.y);
    const props = page.getByRole("complementary", { name: "Eigenschaften" });
    await expect(props.getByRole("heading", { name: "Möbel" })).toBeVisible();
    await filter(page).getByRole("button", { name: "Möbel" }).click();
    await expect(page.getByTestId("plan-furniture").locator("[data-furniture]")).toHaveCount(0);
    await expect(props).toContainText("Nichts ausgewählt");
    await expect(page.getByTestId("plan-devices").locator("[data-device]")).toHaveCount(6);
    // ausgeblendet = nicht anklickbar
    await page.mouse.click(wardrobe.x, wardrobe.y);
    await expect(props.getByRole("heading", { name: "Möbel" })).toHaveCount(0);

    const wall = await worldToPage(page, { x: 6000, y: 5700 });
    await page.mouse.dblclick(wall.x, wall.y);
    await expect(page.getByRole("heading", { name: "Fläche" })).toHaveText("Schlafen › Wand Nord");
    await expect(page.getByTestId("surface-furniture")).toHaveCount(0);
    await expect(page.getByTestId("surface-devices").locator("[data-device]")).toHaveCount(1);
    await open3d(page);
    await expect(page.getByTestId("scene")).toHaveAttribute("data-furniture", "");
    await expect(page.getByTestId("scene")).toHaveAttribute("data-devices", /d6usbsch/);
  });
});
