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
  test("Zug im Kantenmodus: Ecken liegen auf den Achsschnittpunkten, auch beim Schließen", async ({
    page,
    request,
  }) => {
    await openProject(page, request, "leer");
    await page.getByRole("button", { name: "Wand", exact: true }).click();
    const options = page.getByRole("group", { name: "Wandoptionen" });
    await options.getByLabel("Modus").selectOption({ label: "linke Kante" });
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
    await saveNow(page);
    const eg = await storeyFile(request, "eg");
    type Pt = { x: number; y: number };
    // Klicks landen je nach Browser einige mm neben den Sollpunkten (Pixelrundung)
    const near = (a: Pt, b: Pt) => Math.abs(a.x - b.x) <= 15 && Math.abs(a.y - b.y) <= 15;
    const find = (walls: { start: Pt; end: Pt }[], a: Pt, b: Pt) =>
      walls.find((w) => near(w.start, a) && near(w.end, b));
    const walls = eg.walls!;
    expect(walls).toHaveLength(4);
    // linke Kante gezeichnet → Wände liegen rechts der Klicklinie, Achsen 120 mm außerhalb
    const corners: [Pt, Pt][] = [
      [
        { x: -120, y: -120 },
        { x: 4120, y: -120 },
      ],
      [
        { x: 4120, y: -120 },
        { x: 4120, y: 3120 },
      ],
      [
        { x: 4120, y: 3120 },
        { x: -120, y: 3120 },
      ],
      [
        { x: -120, y: 3120 },
        { x: -120, y: -120 },
      ],
    ];
    const ordered = corners.map(([a, b]) => find(walls, a, b));
    for (const w of ordered) expect(w).toBeDefined();
    // Ecken exakt gemeinsam, auch die schließende zur ersten Wand
    for (let i = 0; i < 4; i++) expect(ordered[i]!.end).toEqual(ordered[(i + 1) % 4]!.start);

    // ein Zeichenschritt je Wand, Eckanpassung inklusive
    await page.keyboard.press("ControlOrMeta+z");
    await saveNow(page);
    const undone = (await storeyFile(request, "eg")).walls!;
    expect(undone).toHaveLength(3);
    // Undo nimmt auch die Eckanpassungen an erster und dritter Wand zurück
    expect(find(undone, { x: 0, y: -120 }, { x: 4120, y: -120 })).toBeDefined();
    expect(find(undone, { x: 4120, y: 3120 }, { x: 0, y: 3120 })).toBeDefined();
  });

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

  test("Öffnung aufziehen, Art wechseln, mit dem Auswahlwerkzeug verschieben (9.2.1, 9.2.2)", async ({
    page,
    request,
  }) => {
    await openProject(page, request, "leer");
    await drawRectangle(page);
    await page.getByRole("button", { name: "Öffnung", exact: true }).click();
    // Meldungen verändern die Höhe der Kopfzeile; erst danach Positionen (worldToPage wartet auf das SVG)
    await expect(page.getByRole("status", { name: "Meldung" })).toHaveCount(0);
    await worldToPage(page, { x: 0, y: 0 }); // wartet, bis das SVG seine Höhe hat
    // Bildschirmhöhe der unteren Wand aus ihrem Element; x aus der Kamera
    const boxes = await page
      .locator("[data-wall]")
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect));
    const bottom = boxes.reduce((a, b) => (b.width > b.height && b.y > a.y ? b : a));
    const y = bottom.y + bottom.height / 2;
    const at = async (x: number) => ({ x: (await worldToPage(page, { x, y: 0 })).x, y });
    const drag = async (from: { x: number; y: number }, to: { x: number; y: number }) => {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 5 });
    };

    await drag(await at(1000), await at(2200));
    await expect(page.getByTestId("opening-preview")).toBeVisible();
    await page.mouse.up();
    const dialog = page.getByRole("dialog", { name: "Öffnung setzen" });
    const offset = Number(await dialog.getByLabel("Abstand vom Wandanfang").inputValue());
    const width = Number(await dialog.getByLabel("Breite").inputValue());
    expect(Math.abs(width - 1200)).toBeLessThanOrEqual(20); // Pixelrundung
    await dialog.getByLabel("Art").selectOption({ label: "Tür" });
    await expect(dialog.getByLabel("Abstand vom Wandanfang")).toHaveValue(String(offset));
    await expect(dialog.getByLabel("Breite")).toHaveValue(String(width));
    await dialog.getByRole("button", { name: "OK" }).click();
    await expect(page.locator("[data-opening]")).toHaveCount(1);

    await page.getByRole("button", { name: "Auswählen", exact: true }).click();
    await drag(await at(1600), await at(2600));
    await page.mouse.up();
    await saveNow(page);
    const eg = await storeyFile(request, "eg");
    expect(eg.openings).toHaveLength(1);
    expect(eg.openings![0]).toMatchObject({ kind: "door", widthMm: width, heightMm: 2135 });
    expect(Math.abs(eg.openings![0]!.offsetMm - (offset + 1000))).toBeLessThanOrEqual(20);
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
