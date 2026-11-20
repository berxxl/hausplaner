import { expect, test, type Page } from "@playwright/test";
import { pdfToWorld } from "../../src/geometry/underlay";
import { openProject, PDF, projectFiles, saveNow, storeyFile, worldToPage } from "./helpers";

async function choosePdf(page: Page, storey: string, file: string) {
  // auf die Beschriftung klicken, nicht auf die Mitte des Eintrags mit seinen Räumen
  await page.getByRole("treeitem", { name: storey }).locator(":scope > .tree__item").click();
  const props = page.getByRole("complementary", { name: "Eigenschaften" });
  await props.getByLabel("PDF-Datei").setInputFiles(file);
  await expect(page.getByTestId("underlay")).toBeAttached();
  return props;
}

test.describe("Planhintergrund (5.3)", () => {
  test("Vektorplan: Seite 2 wählen, unter den Bauteilen, relativer Pfad gespeichert", async ({
    page,
    request,
  }) => {
    await openProject(page, request);
    const props = await choosePdf(page, "EG", PDF.vector);
    await props.getByLabel("Seite").selectOption("2");
    await expect(props.getByLabel("Seite").locator("option")).toHaveCount(2);
    await expect(page.getByTestId("underlay")).toBeAttached();
    // Hintergrund liegt im SVG vor den Wänden, also darunter
    const order = await page.getByRole("img", { name: "Grundriss" }).evaluate((svg) => {
      const all = [...svg.querySelectorAll("[data-testid=underlay], [data-wall]")];
      return all.map((el) => (el.hasAttribute("data-wall") ? "wall" : "underlay"));
    });
    expect(order[0]).toBe("underlay");
    expect(order).toContain("wall");
    await expect(page.getByTestId("underlay")).toHaveAttribute("width", /^1190\.5/);
    await saveNow(page);
    const eg = await storeyFile(request, "eg");
    expect(eg.storey.underlay).toEqual({
      file: "plaene/vektorplan.pdf",
      page: 2,
      offset: { x: 0, y: 0 },
      rotationDeg: 0,
      opacity: 0.5,
      visible: true,
    });
  });

  test("gescannter Plan wird genauso angezeigt", async ({ page, request }) => {
    await openProject(page, request);
    await choosePdf(page, "EG", PDF.scan);
    await expect(page.getByTestId("underlay")).toHaveAttribute("width", /^1190\.(8|9)/);
  });

  test("dieselbe PDF für ein zweites Geschoss wird nicht kopiert", async ({ page, request }) => {
    await openProject(page, request);
    await choosePdf(page, "EG", PDF.vector);
    await page.getByRole("button", { name: "Geschoss hinzufügen" }).click();
    const dialog = page.getByRole("dialog", { name: "Geschoss hinzufügen" });
    await dialog.getByLabel("Name").fill("OG");
    await dialog.getByRole("button", { name: "Hinzufügen" }).click();
    await choosePdf(page, "OG", PDF.vector);
    await saveNow(page);
    expect((await storeyFile(request, "og")).storey.underlay!.file).toBe("plaene/vektorplan.pdf");
    expect((await request.get("/api/raw/plaene/vektorplan-2.pdf")).status()).toBe(404);
    expect(Object.keys(await projectFiles(request)).sort()).toEqual([
      "geschosse/eg.yaml",
      "geschosse/og.yaml",
      "projekt.yaml",
    ]);
  });
});

test.describe("Kalibrieren und Ausrichten (5.4, 5.5)", () => {
  test("Kalibrierung über die bemaßte Strecke 4260 mm", async ({ page, request }) => {
    await openProject(page, request);
    await choosePdf(page, "EG", PDF.vector);
    await page.getByRole("button", { name: "Alles zeigen" }).click();
    await page.getByRole("button", { name: "Kalibrieren" }).click();
    // Referenzstrecke in PDF-Punkten (tests/fixtures/README.md), unkalibriert dargestellt
    const placement = { offset: { x: 0, y: 0 }, rotationDeg: 0 };
    for (const p of [
      { x: 170.1, y: 705.8 },
      { x: 290.8, y: 705.8 },
    ]) {
      const s = await worldToPage(page, pdfToWorld(placement, p));
      await page.mouse.click(s.x, s.y);
    }
    const dialog = page.getByRole("dialog", { name: "Kalibrieren" });
    await dialog.getByLabel("Realer Abstand der beiden Punkte").fill("4,26 m");
    await dialog.getByRole("button", { name: "OK" }).click();
    await saveNow(page);
    const u = (await storeyFile(request, "eg")).storey.underlay!;
    expect(u.calibration!.distanceMm).toBe(4260);
    // Klickgenauigkeit: 1 Pixel entspricht bei „Alles zeigen“ rund 1,5 PDF-Punkten
    expect(Math.abs(u.calibration!.p1.x - 170.1)).toBeLessThan(3);
    expect(Math.abs(u.calibration!.p1.y - 705.8)).toBeLessThan(3);
    expect(Math.abs(u.calibration!.p2.x - 290.8)).toBeLessThan(3);
    expect(u.offset).toEqual({ x: 0, y: 0 });
    // Rückgängig stellt den unkalibrierten Zustand her
    await page.keyboard.press("ControlOrMeta+z");
    await saveNow(page);
    expect((await storeyFile(request, "eg")).storey.underlay!.calibration).toBeUndefined();
  });

  test("gescannter Plan um 1,5° gedreht ergibt achsparallele Planwände", async ({
    page,
    request,
  }) => {
    await openProject(page, request);
    await choosePdf(page, "EG", PDF.scan);
    await page.getByRole("button", { name: "Plan drehen" }).click();
    const canvas = (await page.getByRole("img", { name: "Grundriss" }).boundingBox())!;
    await page.mouse.click(canvas.x + canvas.width / 3, canvas.y + canvas.height / 2);
    const dialog = page.getByRole("dialog", { name: "Plan drehen" });
    await dialog.getByLabel(/Drehwinkel/).fill("-1,5");
    await dialog.getByRole("button", { name: "OK" }).click();
    await saveNow(page);
    const u = (await storeyFile(request, "eg")).storey.underlay!;
    expect(u.rotationDeg).toBe(-1.5);

    // Südwand des Vektorplans (Achse, PDF-Punkte) → Lage im Scan (150 dpi, um die Bildmitte 1,5° gegen den Uhrzeigersinn)
    const PX = 150 / 72;
    const centre = { x: 2481 / 2, y: 1754 / 2 };
    const t = (1.5 * Math.PI) / 180;
    const toScan = (p: { x: number; y: number }) => {
      const x = p.x * PX - centre.x;
      const y = p.y * PX - centre.y;
      return {
        x: (centre.x + x * Math.cos(t) + y * Math.sin(t)) / PX,
        y: (centre.y - x * Math.sin(t) + y * Math.cos(t)) / PX,
      };
    };
    const a = pdfToWorld(u, toScan({ x: 170.08, y: 671.81 }));
    const b = pdfToWorld(u, toScan({ x: 396.85, y: 671.81 }));
    // Länge 8000 mm bei 1:100; Abweichung quer zur Wand höchstens 2 mm über 8 m
    expect(Math.abs(b.x - a.x)).toBeGreaterThan(7900);
    expect(Math.abs(b.y - a.y)).toBeLessThan(2);
  });

  test("Plan verschieben, Deckkraft und Ausblenden", async ({ page, request }) => {
    await openProject(page, request);
    const props = await choosePdf(page, "EG", PDF.vector);
    await page.getByRole("button", { name: "Plan verschieben" }).click();
    const from = await worldToPage(page, { x: 0, y: 0 });
    const to = await worldToPage(page, { x: 1000, y: 500 });
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2);
    await page.mouse.move(to.x, to.y);
    await page.mouse.up();
    await props.getByLabel("Plan anzeigen").uncheck();
    await expect(page.getByTestId("underlay")).toHaveCount(0);
    await saveNow(page);
    const u = (await storeyFile(request, "eg")).storey.underlay!;
    expect(Math.abs(u.offset.x - 1000)).toBeLessThan(150);
    expect(Math.abs(u.offset.y - 500)).toBeLessThan(150);
    expect(u.visible).toBe(false);
    // Verschieben war ein einziger Undo-Schritt
    await page.keyboard.press("ControlOrMeta+z");
    await page.keyboard.press("ControlOrMeta+z");
    await saveNow(page);
    expect((await storeyFile(request, "eg")).storey.underlay!.offset).toEqual({ x: 0, y: 0 });
  });
});

test.describe("Sichtbarkeit nach dem Wählen (Fehlerbericht)", () => {
  /** Anteil des sichtbaren Grundrisses, den das Planbild bedeckt. */
  async function coverage(page: Page) {
    const svg = (await page.getByRole("img", { name: "Grundriss" }).boundingBox())!;
    const img = (await page.getByTestId("underlay").boundingBox())!;
    const w = Math.max(0, Math.min(svg.x + svg.width, img.x + img.width) - Math.max(svg.x, img.x));
    const h = Math.max(
      0,
      Math.min(svg.y + svg.height, img.y + img.height) - Math.max(svg.y, img.y),
    );
    return (w * h) / (svg.width * svg.height);
  }

  test("PDF bei offenem Grundriss wählen: Ansicht passt den Plan ein, auch nach Seitenwechsel", async ({
    page,
    request,
  }) => {
    await openProject(page, request, "leer");
    const props = await choosePdf(page, "EG", PDF.vector);
    await expect.poll(() => coverage(page)).toBeGreaterThan(0.3);
    await props.getByLabel("Seite").selectOption("2");
    await expect(page.getByTestId("underlay")).toBeAttached();
    await expect.poll(() => coverage(page)).toBeGreaterThan(0.3);
  });
});

test("Plan aus anderem Geschoss übernehmen: nächste Seite, Kalibrierung bleibt; letzte Seite bleibt stehen", async ({
  page,
  request,
}) => {
  await openProject(page, request, "leer");
  await choosePdf(page, "EG", PDF.vector);
  await page.getByRole("button", { name: "Alles zeigen" }).click();
  await page.getByRole("button", { name: "Kalibrieren" }).click();
  for (const p of [
    { x: 170.1, y: 705.8 },
    { x: 290.8, y: 705.8 },
  ]) {
    const s = await worldToPage(page, pdfToWorld({ offset: { x: 0, y: 0 }, rotationDeg: 0 }, p));
    await page.mouse.click(s.x, s.y);
  }
  await page
    .getByRole("dialog", { name: "Kalibrieren" })
    .getByLabel("Realer Abstand der beiden Punkte")
    .fill("4260");
  await page
    .getByRole("dialog", { name: "Kalibrieren" })
    .getByRole("button", { name: "OK" })
    .click();

  for (const name of ["OG", "DG"]) {
    await page.getByRole("button", { name: "Geschoss hinzufügen" }).click();
    const dialog = page.getByRole("dialog", { name: "Geschoss hinzufügen" });
    await dialog.getByLabel("Name").fill(name);
    await dialog.getByRole("button", { name: "Hinzufügen" }).click();
  }
  const props = page.getByRole("complementary", { name: "Eigenschaften" });
  await page.getByRole("treeitem", { name: "OG" }).locator(":scope > .tree__item").click();
  await props
    .getByLabel("Plan aus anderem Geschoss übernehmen")
    .selectOption({ label: "EG: vektorplan.pdf, Seite 1" });
  await expect(page.getByTestId("underlay")).toBeAttached();
  await page.getByRole("treeitem", { name: "DG" }).locator(":scope > .tree__item").click();
  await props
    .getByLabel("Plan aus anderem Geschoss übernehmen")
    .selectOption({ label: "OG: vektorplan.pdf, Seite 2" });
  await expect(page.getByTestId("underlay")).toBeAttached();
  await saveNow(page);
  const eg = (await storeyFile(request, "eg")).storey.underlay!;
  const og = (await storeyFile(request, "og")).storey.underlay!;
  const dg = (await storeyFile(request, "dg")).storey.underlay!;
  expect(og).toEqual({ ...eg, page: 2 });
  expect(dg).toEqual({ ...eg, page: 2 }); // die PDF hat nur zwei Seiten
  expect(og.calibration!.distanceMm).toBe(4260);
});
