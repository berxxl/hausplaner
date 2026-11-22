import { expect, test, type Page } from "@playwright/test";
import { openProject, projectFiles, saveNow, surfaceToPage, worldToPage } from "./helpers";

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

  test("Verteiler per Maus verschieben: im Grundriss entlang der Wand, in der Flächenansicht frei auf der Wandseite (R.5)", async ({
    page,
    request,
  }) => {
    await openProject(page, request, "m4");
    // Lage der UV EG aus verteiler.yaml; Ziele auf ±1 Bildschirmpixel genau (Rundung der Zeigerposition)
    const uvEg = async () => {
      const m = /placement: \{surface: "(wall:[^"]+)", u: (-?\d+), v: (-?\d+)\}/.exec(
        (await projectFiles(request))["verteiler.yaml"]!.split('- id: "b2uveg01"')[1]!,
      )!;
      return { surface: m[1], u: Number(m[2]), v: Number(m[3]) };
    };
    const near = (value: number, target: number, mmPerPx: number) =>
      expect(Math.abs(value - target)).toBeLessThanOrEqual(Math.ceil(mmPerPx) + 1);
    const mmPerPx = async (name: string) =>
      1 / Number(await page.getByRole("img", { name }).getAttribute("data-zoom"));
    const drag = async (from: { x: number; y: number }, to: { x: number; y: number }) => {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 8 });
      await page.mouse.up();
    };
    // Grundriss EG: UV EG auf Wand (4000,3000)→(8000,3000), u = 2000 → x = 6000; quer zur Wand
    // gezogen bleibt sie auf ihrer Wandseite
    await expect(page.getByTestId("plan-boards").locator('[data-board="b2uveg01"]')).toHaveCount(1);
    await drag(
      await worldToPage(page, { x: 6000, y: 3000 }),
      await worldToPage(page, { x: 6500, y: 3400 }),
    );
    await expect(
      page.getByTestId("plan-boards").locator('[data-board="b2uveg01"].plan-board--selected'),
    ).toHaveCount(1);
    await saveNow(page);
    let uv = await uvEg();
    expect(uv).toMatchObject({ surface: "wall:1cih0ost:R", v: 1500 });
    near(uv.u, 2500, await mmPerPx("Grundriss"));
    // Flächenansicht Wohnen › Wand Nord: u und v
    await page
      .getByRole("tree", { name: "Geschosse" })
      .getByRole("treeitem", { name: "Wohnen" })
      .getByRole("treeitem", { name: "Wand Nord" })
      .click();
    await expect(page.getByTestId("surface-boards").locator('[data-board="b2uveg01"]')).toHaveCount(
      1,
    );
    const before = uv;
    await drag(
      await surfaceToPage(page, before.u, 1500),
      await surfaceToPage(page, before.u - 200, 1700),
    );
    await saveNow(page);
    uv = await uvEg();
    const px = await mmPerPx("Flächenansicht");
    expect(uv.surface).toBe("wall:1cih0ost:R");
    near(uv.u, before.u - 200, px);
    near(uv.v, 1700, px);
  });
});
