import { expect, test, type Page } from "@playwright/test";
import { openProject, saveNow, storeyFile, worldToPage } from "./helpers";

async function clickWorld(page: Page, x: number, y: number) {
  const s = await worldToPage(page, { x, y });
  await page.mouse.click(s.x, s.y);
}

const surfaceTitle = (page: Page) => page.getByRole("heading", { name: "Fläche" });

async function open3d(page: Page) {
  await page.getByRole("tab", { name: "3D" }).click();
  await expect(page.getByTestId("scene").or(page.getByTestId("view-error"))).toBeVisible({
    timeout: 20000,
  });
  await page.waitForFunction(
    () => "__hausplaner3d" in window || document.querySelector('[data-testid="view-error"]'),
  );
  const error = page.getByTestId("view-error");
  if ((await error.count()) > 0) throw new Error(`3D-Ansicht: ${await error.innerText()}`);
  await page.waitForTimeout(300);
}

test.describe("Geräte (3)", () => {
  test("Steckdose in der Wandansicht setzen: sitzt an der Klickposition in 300 mm über OKFF (3.4, Spec-Scenario)", async ({
    page,
    request,
  }) => {
    await openProject(page, request, "m2");
    const s = await worldToPage(page, { x: 2000, y: 400 });
    await page.mouse.dblclick(s.x, s.y);
    await expect(surfaceTitle(page)).toHaveText("Küche › Wand Süd");
    const tools = page.getByRole("toolbar", { name: "Werkzeuge der Fläche" });
    await tools.getByRole("button", { name: "Gerät" }).click();
    await tools.getByLabel("Gerätetyp", { exact: true }).selectOption({ label: "Steckdose" });
    const box = (await page.getByTestId("surface-contour").boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByTestId("surface-devices").locator("[data-device]")).toHaveCount(1);
    await saveNow(page);
    const eg = await storeyFile(request, "eg");
    const placed = eg.devices!.find(
      (d) =>
        !["d1steck1", "d2schalt", "d3decke1", "d4boden1", "d5klima1", "d6usbsch"].includes(d.id),
    )!;
    expect(placed.typeId).toBe("socket");
    expect(placed.status).toBe("planned");
    expect(placed.placement).toMatchObject({ kind: "surface", v: 300 });
  });

  test("Schalter im Grundriss neben der Wand auf der Küchenseite in Standardhöhe (3.4, Spec-Scenario „Schalter im Grundriss“)", async ({
    page,
    request,
  }) => {
    await openProject(page, request, "m2");
    await page
      .getByRole("toolbar", { name: "Werkzeuge" })
      .getByRole("button", { name: "Gerät" })
      .click();
    await page
      .getByRole("group", { name: "Geräteoptionen" })
      .getByLabel("Gerätetyp", { exact: true })
      .selectOption({
        label: "Schalter",
      });
    // Wand Küche/Bad bei y = 3000; Küche liegt darunter (Seite R)
    await clickWorld(page, 1500, 2880);
    await expect(page.getByRole("complementary", { name: "Eigenschaften" })).toContainText(
      "Rohbauhöhe: 1170 mm",
    );
    await saveNow(page);
    const eg = await storeyFile(request, "eg");
    expect(eg.devices!.filter((d) => d.typeId === "switch").map((d) => d.placement)).toContainEqual(
      { kind: "surface", surface: "wall:1bih0wst:R", u: 1500, v: 1050, rotationDeg: 0 },
    );
  });

  test("Deckenauslass erscheint im Grundriss, im Deckenspiegel und in 3D an der Decke (3.8, Spec-Scenario)", async ({
    page,
    request,
  }) => {
    await openProject(page, request, "m2");
    const glyph = page.getByTestId("plan-devices").locator('[data-device="d3decke1"]');
    await expect(glyph).toBeVisible();
    await expect(glyph).toHaveAttribute("data-status", "verified");
    await expect(glyph.getByTestId("verified-check")).toHaveCount(1);
    const s = await worldToPage(page, { x: 2000, y: 400 });
    await page.mouse.dblclick(s.x, s.y);
    await page
      .getByRole("navigation", { name: "Navigation" })
      .getByRole("button", { name: "Decke" })
      .click();
    await expect(surfaceTitle(page)).toHaveText("Küche › Decke");
    await expect(
      page.getByTestId("surface-devices").locator('[data-device="d3decke1"]'),
    ).toBeVisible();
    await open3d(page);
    // fertige Decke: 2500 − 15 = 2485 über Rohfußboden
    await expect(page.getByTestId("scene")).toHaveAttribute(
      "data-devices",
      /d3decke1:2000,1500,2485/,
    );
  });

  test("Status „verlegt“ ändert die Darstellung (3.8, Spec-Scenario „Nach dem Verlegen“)", async ({
    page,
    request,
  }) => {
    await openProject(page, request, "m2");
    await page
      .getByRole("toolbar", { name: "Werkzeuge" })
      .getByRole("button", { name: "Auswählen" })
      .click();
    await clickWorld(page, -2000 * -1, 1500); // Deckenauslass d3decke1 bei (2000, 1500)
    const props = page.getByRole("complementary", { name: "Eigenschaften" });
    await expect(props.getByRole("heading", { name: "Gerät" })).toBeVisible();
    await expect(props.getByLabel("Bezeichnung")).toHaveValue("Deckenauslass Küche");
    await props.getByLabel("Status").selectOption({ label: "verlegt" });
    await expect(
      page.getByTestId("plan-devices").locator('[data-device="d3decke1"]'),
    ).toHaveAttribute("data-status", "installed");
  });

  test("Klick in 3D wählt den Deckenauslass, hervorgehoben in Grundriss und Deckenspiegel (3.6, Spec-Scenario „Gerät in 3D auswählen“)", async ({
    page,
    request,
  }) => {
    await openProject(page, request, "m2");
    await open3d(page);
    const p = await page.evaluate(() =>
      (
        window as unknown as {
          __hausplaner3d: { project(x: number, y: number, z: number): { x: number; y: number } };
        }
      ).__hausplaner3d.project(2000, 1500, 2475),
    );
    await page.mouse.click(p.x, p.y);
    const props = page.getByRole("complementary", { name: "Eigenschaften" });
    await expect(props.getByLabel("Bezeichnung")).toHaveValue("Deckenauslass Küche");
    await page.getByRole("tab", { name: "Grundriss" }).click();
    await expect(
      page.getByTestId("plan-devices").locator('[data-device="d3decke1"]'),
    ).toHaveAttribute("data-selected", "true");
  });
});
