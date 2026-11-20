import { expect, test, type Page } from "@playwright/test";
import { openProject, saveNow, storeyFile, worldToPage } from "./helpers";

async function clickWorld(page: Page, x: number, y: number) {
  const s = await worldToPage(page, { x, y });
  await page.mouse.click(s.x, s.y);
}

async function drawRectangle(page: Page) {
  await page.getByRole("button", { name: "Wand", exact: true }).click();
  const options = page.getByRole("group", { name: "Wandoptionen" });
  await options.getByLabel("Dicke").fill("240");
  await options.getByLabel("Dicke").press("Enter");
  for (const [x, y] of [
    [0, 0],
    [4000, 0],
    [4000, 3000],
    [0, 3000],
    [0, 0],
  ] as const)
    await clickWorld(page, x, y);
  await page.keyboard.press("Escape");
}

test.describe("Wände, Räume, Öffnungen (6)", () => {
  test("vier Wände zeichnen, Raum anlegen, Fenster setzen, speichern", async ({
    page,
    request,
  }) => {
    await openProject(page, request, "leer");
    await drawRectangle(page);
    await expect(page.locator("[data-wall]")).toHaveCount(4);

    await page.getByRole("button", { name: "Raum", exact: true }).click();
    await clickWorld(page, 2000, 1500);
    const roomDialog = page.getByRole("dialog", { name: "Raum anlegen" });
    await roomDialog.getByLabel("Name").fill("Küche");
    await roomDialog.getByRole("button", { name: "OK" }).click();
    await expect(
      page.getByRole("img", { name: "Grundriss" }).locator("text").filter({ hasText: "Küche" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Öffnung", exact: true }).click();
    await clickWorld(page, 2000, 0);
    await page
      .getByRole("dialog", { name: "Öffnung setzen" })
      .getByRole("button", { name: "OK" })
      .click();
    await expect(page.locator("[data-opening]")).toHaveCount(1);

    await saveNow(page);
    const eg = await storeyFile(request, "eg");
    expect(eg.walls).toHaveLength(4);
    // Orthogonaler Fang und Endpunktfang: alle Wände achsparallel und geschlossen
    for (const w of eg.walls!) expect(w.start.x === w.end.x || w.start.y === w.end.y).toBe(true);
    expect(eg.rooms).toHaveLength(1);
    expect(eg.rooms![0]!.name).toBe("Küche");
    expect(eg.rooms![0]!.polygon).toHaveLength(4);
    expect(eg.openings![0]).toMatchObject({
      kind: "window",
      widthMm: 1010,
      heightMm: 1385,
      sillMm: 900,
    });
    await expect(page.getByRole("contentinfo", { name: "Warnungen" })).toHaveText(
      /Keine Warnungen/,
    );
  });

  test("Endpunkt ziehen: Eck-Nachbar folgt; Löschen mit Entf meldet offenen Raum, Rückgängig stellt her", async ({
    page,
    request,
  }) => {
    await openProject(page, request, "leer");
    await drawRectangle(page);
    await page.getByRole("button", { name: "Raum", exact: true }).click();
    await clickWorld(page, 2000, 1500);
    await page.getByRole("dialog", { name: "Raum anlegen" }).getByLabel("Name").fill("Küche");
    await page
      .getByRole("dialog", { name: "Raum anlegen" })
      .getByRole("button", { name: "OK" })
      .click();

    await page.getByRole("button", { name: "Auswählen" }).click();
    await clickWorld(page, 4000, 1500); // Ostwand
    const props = page.getByRole("complementary", { name: "Eigenschaften" });
    await expect(props.getByRole("heading", { name: "Wand" })).toBeVisible();
    const handle = (await page.getByTestId("handle-end").boundingBox())!;
    const target = await worldToPage(page, { x: 5000, y: 3000 });
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 5 });
    await page.mouse.up();
    await saveNow(page);
    let eg = await storeyFile(request, "eg");
    const east = eg.walls!.find((w) => Math.abs(w.start.x - 4000) < 30 && w.start.y < 100)!;
    const north = eg.walls!.find(
      (w) => w.end.x < 100 && Math.abs(w.end.y - 3000) < 30 && w.start.y > 2000,
    )!;
    expect(Math.abs(east.end.x - 5000)).toBeLessThan(60);
    expect(north.start).toEqual(east.end);
    // Raumkontur folgt
    expect(Math.max(...eg.rooms![0]!.polygon.map((p) => p.x))).toBeGreaterThan(4000);

    await clickWorld(page, 0, 1500); // Westwand
    await page.keyboard.press("Delete");
    const bar = page.getByRole("contentinfo", { name: "Warnungen" });
    await expect(bar.getByRole("button", { name: "1 Warnung" })).toBeVisible();
    await bar.getByRole("button", { name: "1 Warnung" }).click();
    await expect(bar).toContainText("Raum nicht geschlossen: Küche");
    await page.keyboard.press("ControlOrMeta+z");
    await expect(bar.getByRole("button", { name: "Keine Warnungen" })).toBeVisible();
    await saveNow(page);
    eg = await storeyFile(request, "eg");
    expect(eg.walls).toHaveLength(4);
  });

  test("nicht geschlossene Fläche: offene Wandenden werden markiert, kein Raum", async ({
    page,
    request,
  }) => {
    await openProject(page, request, "leer");
    await page.getByRole("button", { name: "Wand", exact: true }).click();
    for (const [x, y] of [
      [0, 3000],
      [0, 0],
      [4000, 0],
      [4000, 3000],
    ] as const)
      await clickWorld(page, x, y);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Raum", exact: true }).click();
    await clickWorld(page, 2000, 1500);
    await expect(page.getByRole("status", { name: "Meldung" })).toContainText(
      "Raum nicht geschlossen",
    );
    await expect(page.getByTestId("open-ends").locator("circle")).toHaveCount(2);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test.describe("Schrägen und Raum neu erkennen (6.5, 6.8)", () => {
  test("Schräge über zwei Raumecken erfassen; Raum neu erkennen behält Name und Schrägen", async ({
    page,
    request,
  }) => {
    await openProject(page, request, "klein");
    await page.getByRole("button", { name: "Auswählen" }).click();
    await clickWorld(page, 2000, 1500); // Küche
    const props = page.getByRole("complementary", { name: "Eigenschaften" });
    await expect(props.getByLabel("Name")).toHaveValue("Küche");
    await expect(props.getByLabel("Fläche")).toHaveText("Fläche (fertig): 10,38 m²");

    await props.getByRole("button", { name: "Schräge hinzufügen" }).click();
    await clickWorld(page, 160, 160); // rastet auf die Raumecke (150, 150)
    await clickWorld(page, 3930, 160); // (3940, 150)
    const dialog = page.getByRole("dialog", { name: "Schräge anlegen" });
    await dialog.getByLabel("Höhe an der Grundlinie").fill("1000");
    await dialog.getByLabel("Neigung").fill("45");
    await dialog.getByRole("button", { name: "OK" }).click();
    await expect(props.getByRole("group", { name: "Schräge 1" })).toBeVisible();

    await props.getByRole("button", { name: "Raum neu erkennen" }).click();
    await clickWorld(page, 1000, 1000);
    await saveNow(page);
    const kitchen = (await storeyFile(request, "eg")).rooms!.find((r) => r.id === "r1kueche")!;
    expect(kitchen.slopes).toEqual([
      expect.objectContaining({
        baseLine: [
          { x: 150, y: 150 },
          { x: 3940, y: 150 },
        ],
        heightAtBaseMm: 1000,
        angleDeg: 45,
      }),
    ]);
    expect(kitchen.name).toBe("Küche");
    expect(Math.abs(kitchen.seed.x - 1000)).toBeLessThan(60);
  });
});
