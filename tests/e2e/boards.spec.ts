import { expect, test, type Page } from "@playwright/test";
import { openProject, projectFiles, saveNow } from "./helpers";

async function open3d(page: Page) {
  await page.getByRole("tab", { name: "3D" }).click();
  await expect(page.getByTestId("scene").or(page.getByTestId("view-error"))).toBeVisible({
    timeout: 20000,
  });
  const error = page.getByTestId("view-error");
  if ((await error.count()) > 0) throw new Error(`3D-Ansicht: ${await error.innerText()}`);
}

const tree = (page: Page) => page.getByRole("tree", { name: "Geschosse" });

test.describe("Verteiler (M4)", () => {
  test("Unterputz-UV 550 × 1100 × 120 im OG erscheint in Wandansicht, Grundriss, 3D und Baum (2.3, Spec-Scenario „UV im Flur“)", async ({
    page,
    request,
  }) => {
    await openProject(page, request, "m4");
    const og = tree(page).getByRole("treeitem", { name: "OG" });
    await og
      .getByRole("treeitem", { name: "Kind" })
      .getByRole("treeitem", { name: "Wand Ost" })
      .click();
    await expect(page.getByRole("heading", { name: "Fläche" })).toHaveText("Kind › Wand Ost");
    await page
      .getByRole("toolbar", { name: "Werkzeuge der Fläche" })
      .getByRole("button", { name: "Verteiler" })
      .click();
    // Mitte der Ansicht liegt in der Wandfläche
    await page.getByRole("img", { name: "Flächenansicht" }).click();
    const dialog = page.getByRole("dialog", { name: "Verteiler anlegen" });
    await expect(dialog.getByLabel("Breite")).toHaveValue("550");
    await expect(dialog.getByLabel("Höhe")).toHaveValue("1100");
    await expect(dialog.getByLabel("Tiefe")).toHaveValue("120");
    await expect(dialog.getByLabel("Montage")).toHaveValue("flush");
    await dialog.getByLabel("Bezeichnung").fill("UV Flur OG");
    await dialog.getByRole("button", { name: "OK" }).click();
    await saveNow(page);
    const files = await projectFiles(request);
    const id = /- id: "([0-9a-z]{8})"\n {4}label: "UV Flur OG"/.exec(files["verteiler.yaml"]!)![1]!;
    // Wandansicht
    await expect(page.getByTestId("surface-boards").locator(`[data-board="${id}"]`)).toHaveCount(1);
    // Baum unter „Verteiler“
    await expect(
      page.getByRole("tree", { name: "Verteiler" }).getByRole("treeitem", { name: "UV Flur OG" }),
    ).toBeVisible();
    // Grundriss des OG
    await page.getByRole("tab", { name: "Grundriss" }).click();
    await og.locator(".tree__item").first().click();
    await expect(page.getByTestId("plan-boards").locator(`[data-board="${id}"]`)).toHaveCount(1);
    // 3D
    await open3d(page);
    await expect(page.getByTestId("scene")).toHaveAttribute("data-boards", new RegExp(`${id}:`));
  });

  test("„Nur KNX“: Verteiler bleiben in Grundriss, Wandansicht und 3D sichtbar (6.3, Spec-Scenario „Nur KNX“)", async ({
    page,
    request,
  }) => {
    await openProject(page, request, "m4");
    const filter = page.getByRole("group", { name: "Gewerkfilter" });
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
    // EG: Zählerschrank, UV EG, Medienverteiler; Geräte: nur KNX (keine im EG)
    await expect(page.getByTestId("plan-boards").locator("[data-board]")).toHaveCount(3);
    await expect(page.getByTestId("plan-devices").locator("[data-device]")).toHaveCount(0);
    await expect(page.getByTestId("plan-routes").locator("[data-plan-segment]")).not.toHaveCount(0);
    await tree(page)
      .getByRole("treeitem", { name: "Wohnen" })
      .getByRole("treeitem", { name: "Wand Nord" })
      .click();
    await expect(page.getByTestId("surface-boards").locator('[data-board="b2uveg01"]')).toHaveCount(
      1,
    );
    await open3d(page);
    await expect(page.getByTestId("scene")).toHaveAttribute("data-boards", /b2uveg01:/);
    await expect(page.getByTestId("scene")).toHaveAttribute("data-devices", "");
  });
});
