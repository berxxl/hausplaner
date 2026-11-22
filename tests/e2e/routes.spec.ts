import { expect, test, type Page } from "@playwright/test";
import { openProject, saveNow, storeyFile, surfaceToPage, worldToPage } from "./helpers";

async function open3d(page: Page) {
  await page.getByRole("tab", { name: "3D" }).click();
  await expect(page.getByTestId("scene").or(page.getByTestId("view-error"))).toBeVisible({
    timeout: 20000,
  });
  const error = page.getByTestId("view-error");
  if ((await error.count()) > 0) throw new Error(`3D-Ansicht: ${await error.innerText()}`);
}

const title = (page: Page) => page.getByRole("heading", { name: "Fläche" });
const surfaceTools = (page: Page) => page.getByRole("toolbar", { name: "Werkzeuge der Fläche" });

/** Küche › Wand Nord (Wand zum Bad, u = x, Decke 2365 über OKFF) über einen Doppelklick im Grundriss. */
async function openKitchenNorth(page: Page) {
  const s = await worldToPage(page, { x: 1000, y: 2800 });
  await page.mouse.dblclick(s.x, s.y);
  await expect(title(page)).toHaveText("Küche › Wand Nord");
}

async function clickSurface(page: Page, u: number, v: number) {
  const p = await surfaceToPage(page, u, v);
  await page.mouse.click(p.x, p.y);
}

test.describe("Trassen und Leitungen (M3)", () => {
  test("Trasse von der oberen Zone zur Steckdose, über die Ecke in die Nachbarwand (3.3)", async ({
    page,
    request,
  }) => {
    await openProject(page, request, "m3");
    await openKitchenNorth(page);
    await surfaceTools(page).getByRole("button", { name: "Trasse" }).click();
    // neuer Stich vom Schalter (3500 / 1050) existiert schon; neue Trasse über u 1000
    await clickSurface(page, 1000, 2065);
    await clickSurface(page, 1000, 1500);
    await page.keyboard.press("Escape");
    // Zug an die rechte Raumecke und in der Nachbarwand fortsetzen
    await clickSurface(page, 3700, 1700);
    await clickSurface(page, 3924, 1700);
    await page.keyboard.press("Escape");
    await saveNow(page);
    const eg = await storeyFile(request, "eg");
    const corner = eg.routeNodes!.find(
      (n) =>
        n.anchors.length === 2 &&
        n.anchors[1]!.surface === "wall:1aiv0ert:L" &&
        n.anchors[0]!.v !== 2065,
    );
    expect(corner?.anchors[0]).toMatchObject({ surface: "wall:1bih0wst:R", u: 3925 });
    await page
      .getByRole("navigation", { name: "Navigation" })
      .getByRole("button", { name: /Nächste Wand rechts/ })
      .click();
    await expect(title(page)).toHaveText(/Küche › Wand Ost/);
    await expect(
      page.getByTestId("surface-routes").locator(`[data-node="${corner!.id}"]`),
    ).toHaveCount(1);
  });

  test("Deckendurchbruch erscheint im Grundriss beider Geschosse und in 3D (4.2); Trassen ausblenden (4.3)", async ({
    page,
    request,
  }) => {
    await openProject(page, request, "m3");
    const planRoutes = page.getByTestId("plan-routes");
    await expect(planRoutes.locator('[data-plan-segment="s9kern01"]')).toHaveCount(1);
    await expect(planRoutes.locator('[data-plan-segment="s5decke1"]')).toHaveCount(1);
    await page.getByRole("treeitem", { name: "OG" }).getByText("OG", { exact: true }).click();
    await expect(planRoutes.locator('[data-plan-segment="s9kern01"]')).toHaveCount(1);
    await expect(planRoutes.locator('[data-plan-segment="saboden1"]')).toHaveCount(1);
    await open3d(page);
    await expect(page.getByTestId("scene")).toHaveAttribute("data-routes", "10");
    // Filter: Trassen aus, „nur KNX“ lässt sie stehen
    const filter = page.getByRole("group", { name: "Gewerkfilter" });
    await filter.getByRole("button", { name: "Trassen" }).click();
    await expect(page.getByTestId("scene")).toHaveAttribute("data-routes", "0");
    await filter.getByRole("button", { name: "Trassen" }).click();
    for (const name of [
      "Strom",
      "Daten",
      "Leerrohr",
      "Kältemittel",
      "Kondensat",
      "Sonstiges",
      "Möbel",
    ])
      await filter.getByRole("button", { name, exact: true }).click();
    await expect(page.getByTestId("scene")).toHaveAttribute("data-routes", "10");
  });

  test("Leitung über zwei Geschosse: Weg in allen beteiligten Ansichten und in 3D hervorgehoben (5.4)", async ({
    page,
    request,
  }) => {
    await openProject(page, request, "m3");
    await openKitchenNorth(page);
    await page
      .getByRole("navigation", { name: "Navigation" })
      .getByRole("button", { name: "Decke" })
      .click();
    await expect(title(page)).toHaveText("Küche › Decke");
    // Segment s8decke2 vom Deckenauslass (x 2000, y 1500 → u −2000) zum Durchbruch (u −1000, v 1000)
    await clickSurface(page, -1500, 1250);
    const props = page.getByRole("complementary", { name: "Eigenschaften" });
    await props.getByRole("button", { name: "Deckenauslass Küche – Bodendose Kind" }).click();
    await expect(props.getByLabel("Leitungslänge")).toHaveText(/m$/);
    await expect(page.getByTestId("surface-routes").locator("[data-highlighted]")).toHaveCount(1);
    await open3d(page);
    await expect(page.getByTestId("scene")).toHaveAttribute(
      "data-highlighted",
      "s8decke2,s9kern01,saboden1",
    );
    // Grundriss EG: Deckensegment der Leitung hervorgehoben (ein Klick im Baum würde die Auswahl ändern)
    await page.getByRole("tab", { name: "Grundriss" }).click();
    await expect(
      page.getByTestId("plan-routes").locator('[data-plan-segment="s8decke2"]'),
    ).toHaveAttribute("data-highlighted", "true");
  });

  test("Werkzeug „Leitung“: zwei Geräte, Dialog mit passenden Typen, Weg vorgeschlagen", async ({
    page,
    request,
  }) => {
    await openProject(page, request, "m3");
    await openKitchenNorth(page);
    await surfaceTools(page).getByRole("button", { name: "Leitung" }).click();
    await clickSurface(page, 3500, 1050); // Schalter
    await page
      .getByRole("navigation", { name: "Navigation" })
      .getByRole("button", { name: "Decke" })
      .click();
    await clickSurface(page, -2000, 1500); // Deckenauslass
    const dialog = page.getByRole("dialog", { name: "Leitung anlegen" });
    await expect(dialog.getByLabel("Leitungstyp")).toHaveValue("nym-j-3x1-5");
    await dialog.getByRole("button", { name: "OK" }).click();
    const props = page.getByRole("complementary", { name: "Eigenschaften" });
    await expect(props.getByLabel("Leitungslänge")).toHaveText("Länge: 5,3 m");
  });
});
