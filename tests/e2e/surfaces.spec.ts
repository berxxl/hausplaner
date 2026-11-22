import { expect, test, type Page } from "@playwright/test";
import { openProject, worldToPage } from "./helpers";

const title = (page: Page) => page.getByRole("heading", { name: "Fläche" });

async function dblclickWorld(page: Page, x: number, y: number) {
  const s = await worldToPage(page, { x, y });
  await page.mouse.dblclick(s.x, s.y);
}

/** Bildschirmposition eines (u, v)-Punkts in der Flächenansicht. */
async function surfaceToPage(page: Page, u: number, v: number) {
  const svg = page.getByRole("img", { name: "Flächenansicht" });
  const box = (await svg.boundingBox())!;
  const [cx, cy, zoom] = await Promise.all(
    ["data-cx", "data-cy", "data-zoom"].map(async (a) => Number(await svg.getAttribute(a))),
  );
  return {
    x: box.x + box.width / 2 + (u - cx!) * zoom!,
    y: box.y + box.height / 2 - (v - cy!) * zoom!,
  };
}

test.describe("Navigation zwischen Flächen (7.7)", () => {
  test("Doppelklick im Raum öffnet die nächstgelegene Wandansicht", async ({ page, request }) => {
    await openProject(page, request);
    await dblclickWorld(page, 2000, 400);
    await expect(title(page)).toHaveText("Küche › Wand Süd");
  });

  test("Doppelklick außerhalb aller Räume öffnet die ganze Wandseite", async ({
    page,
    request,
  }) => {
    await openProject(page, request);
    await dblclickWorld(page, 2000, -200);
    await expect(title(page)).toHaveText("Süd außen");
    await expect(page.getByText("Rohbau ab Oberkante Rohfußboden")).toBeVisible();
  });

  test("Baum, Nachbarwand links/rechts, Decke und Boden", async ({ page, request }) => {
    await openProject(page, request);
    const kitchen = page.getByRole("treeitem", { name: "Küche" });
    await kitchen.getByRole("treeitem", { name: "Wand Süd" }).click();
    await expect(title(page)).toHaveText("Küche › Wand Süd");
    await page.getByRole("button", { name: /^Nächste Wand rechts/ }).click();
    await expect(title(page)).toHaveText("Küche › Wand West");
    await page.getByRole("button", { name: /^Nächste Wand links/ }).click();
    await expect(title(page)).toHaveText("Küche › Wand Süd");
    await page.getByRole("button", { name: /^Nächste Wand links/ }).click();
    await expect(title(page)).toHaveText("Küche › Wand Ost");
    await page.getByRole("button", { name: "Decke" }).click();
    await expect(title(page)).toHaveText("Küche › Decke");
    await page.getByRole("button", { name: "Kante Wand West" }).click();
    await expect(title(page)).toHaveText("Küche › Wand West");
    await page.getByRole("button", { name: "Boden" }).click();
    await expect(title(page)).toHaveText("Küche › Boden");
    await page.getByRole("button", { name: "Kante Wand Nord" }).click();
    await expect(title(page)).toHaveText("Küche › Wand Nord");
  });

  test("Klick auf eine Wandkante in der Schrägenansicht", async ({ page, request }) => {
    await openProject(page, request, "dg");
    await page.getByRole("treeitem", { name: "Schräge 1" }).click();
    await expect(title(page)).toHaveText("Schlafen › Schräge 1");
    await page.getByRole("button", { name: "Kante Wand Ost" }).click();
    await expect(title(page)).toHaveText("Schlafen › Wand Ost");
  });
});

test.describe("Wandansicht (7.3)", () => {
  test("Messen von der Raumecke zur Fensterlaibung in fertigen Maßen", async ({
    page,
    request,
  }) => {
    await openProject(page, request);
    await page
      .getByRole("treeitem", { name: "Küche" })
      .getByRole("treeitem", { name: "Wand Süd" })
      .click();
    await page
      .getByRole("toolbar", { name: "Werkzeuge der Fläche" })
      .getByRole("button", { name: "Messen" })
      .click();
    // fertige Raumecke unten links (u = 4060 + 15) und fertige Laibung unten links (u = 5495 + 15, v = 780); Fang auf Ecken
    for (const [u, v] of [
      [4078, 5],
      [5507, 776],
    ] as const) {
      const p = await surfaceToPage(page, u, v);
      await page.mouse.click(p.x, p.y);
    }
    await expect(page.getByTestId("measure-label")).toHaveText("1633 mm (1,63 m)");
  });

  test("Fenster erscheint im Grundriss, in den Ansichten beider Wandseiten; Rohbaumaß beim Auswählen", async ({
    page,
    request,
  }) => {
    await openProject(page, request);
    await expect(page.locator('[data-opening="o1fenstr"]')).toHaveCount(1);
    await dblclickWorld(page, 2000, 400);
    await expect(
      page.getByRole("img", { name: "Flächenansicht" }).locator('[data-opening="o1fenstr"]'),
    ).toHaveCount(1);
    await expect(page.getByTestId("dims-o1fenstr").locator('[data-dim="width"]')).toHaveText("980");
    await page.getByRole("tab", { name: "Grundriss" }).click();
    await dblclickWorld(page, 2000, -200);
    await expect(
      page.getByRole("img", { name: "Flächenansicht" }).locator('[data-opening="o1fenstr"]'),
    ).toHaveCount(1);
    await expect(page.getByTestId("dims-o1fenstr").locator('[data-dim="width"]')).toHaveText(
      "1010",
    );
    await page.locator('[data-opening="o1fenstr"] rect').first().click();
    await expect(page.getByRole("note", { name: "Rohbaumaß" })).toHaveText(
      "Fenster: Rohbau 1010 × 1250 mm, Brüstung 900 mm über Rohfußboden",
    );
  });
});

test.describe("Baum auf- und zuklappen (m3 Rückmeldung R.3)", () => {
  test("Geschoss und Raum zuklappen, Zustand bleibt nach dem Neuladen", async ({
    page,
    request,
  }) => {
    await openProject(page, request);
    const tree = page.getByRole("tree", { name: "Geschosse" });
    await expect(tree.getByRole("treeitem", { name: "Wand Nord" }).first()).toBeVisible();
    await tree.getByRole("button", { name: "Küche zuklappen" }).click();
    await expect(tree.getByRole("treeitem", { name: "Küche" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await tree.getByRole("button", { name: "EG zuklappen" }).click();
    await expect(tree.getByRole("treeitem", { name: "Küche" })).toHaveCount(0);
    await page.reload();
    await expect(tree.getByRole("treeitem", { name: "EG" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await tree.getByRole("button", { name: "EG aufklappen" }).click();
    await expect(tree.getByRole("treeitem", { name: "Küche" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(tree.getByRole("treeitem", { name: "Bad" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });
});
