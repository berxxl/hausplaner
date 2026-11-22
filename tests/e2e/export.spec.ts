import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { parseSiteMapping } from "../../src/export/mapping";
import { openProject } from "./helpers";

const MM_TO_PT = 72 / 25.4;
const FONTS = join(process.cwd(), "node_modules/pdfjs-dist/standard_fonts/");

async function exportPdf(page: Page) {
  const dialog = page.getByRole("dialog", { name: "PDF exportieren" });
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Exportieren" }).click();
  const file = await download;
  await expect(dialog.getByRole("status", { name: "Fortschritt" })).toHaveText(/exportiert$/);
  const data = new Uint8Array(readFileSync((await file.path())!));
  return {
    name: file.suggestedFilename(),
    data,
    pdf: await pdfjs.getDocument({ data, standardFontDataUrl: FONTS }).promise,
  };
}

async function texts(pdf: pdfjs.PDFDocumentProxy, n: number) {
  const tc = await (await pdf.getPage(n)).getTextContent();
  return tc.items.flatMap((i) =>
    "str" in i ? [{ str: i.str, x: i.transform[4] as number, y: i.transform[5] as number }] : [],
  );
}

test.describe("PDF-Export (M5)", () => {
  test("Grundriss EG 1:50 auf A3 quer: Seitengröße, durchsuchbarer Text, Vektor, Lage im Plankopf (6.2, Spec-Scenarios „Zoomen im PDF“, „Maßhaltig drucken“)", async ({
    page,
    request,
  }) => {
    await openProject(page, request, "m4");
    await page.getByRole("button", { name: "Exportieren …" }).click();
    const dialog = page.getByRole("dialog", { name: "PDF exportieren" });
    await expect(dialog.getByLabel("Grundriss EG")).toBeChecked();
    const { name, data, pdf } = await exportPdf(page);
    expect(name).toMatch(/Grundriss EG \d\d \d\d \d{4}\.pdf$/);
    expect(pdf.numPages).toBe(1);
    const vp = (await pdf.getPage(1)).getViewport({ scale: 1 });
    expect(vp.width).toBeCloseTo(420 * MM_TO_PT, 1);
    expect(vp.height).toBeCloseTo(297 * MM_TO_PT, 1);
    const items = await texts(pdf, 1);
    const strs = items.map((i) => i.str);
    for (const s of [
      "Küche",
      "Wohnen",
      "Bad",
      "Schlafen",
      "Grundriss EG",
      "1:50",
      "Planung",
      "Legende",
    ])
      expect(strs).toContain(s);
    // Planinhalt im Plankopf: x = 420 − 10 − 180 + 1,5 mm, Grundlinie 251 + 12 + 6,6 = 269,6 mm von oben
    const content = items.find((i) => i.str === "Grundriss EG")!;
    expect(content.x).toBeCloseTo(231.5 * MM_TO_PT, 0);
    expect(content.y).toBeCloseTo((297 - 269.6) * MM_TO_PT, 0);
    // Vektor: keine eingebetteten Bilder
    expect(Buffer.from(data).toString("latin1")).not.toMatch(/\/Subtype\s*\/Image/);
  });

  test("mehrere Inhalte ergeben die angezeigte Blattzahl", async ({ page, request }) => {
    await openProject(page, request, "m4");
    await page.getByRole("button", { name: "Exportieren …" }).click();
    const dialog = page.getByRole("dialog", { name: "PDF exportieren" });
    await dialog.getByLabel("Maßstab").selectOption("100");
    await dialog.getByLabel("OG", { exact: true }).check();
    await dialog.getByLabel("Belegung UV EG").check();
    await dialog.getByLabel("Liste Leitungen").check();
    const count = Number(
      (await dialog.getByRole("status", { name: "Fortschritt" }).innerText()).split(" ")[0],
    );
    expect(count).toBeGreaterThan(4);
    const { pdf } = await exportPdf(page);
    expect(pdf.numPages).toBe(count);
    const last = (await texts(pdf, count)).map((i) => i.str);
    expect(last).toContain("Liste Leitungen");
  });

  test("Baustellen-PDF für das Bad: eine A4-Seite je Fläche, Seitenzuordnung aus den Metadaten (7.2, Spec-Scenarios „Bad für die Baustelle“, „Zuordnung lesbar“)", async ({
    page,
    request,
  }) => {
    await openProject(page, request, "m4");
    await page.getByRole("button", { name: "Baustellen-PDF …" }).click();
    const dialog = page.getByRole("dialog", { name: "Baustellen-PDF" });
    await dialog.getByLabel("EG Bad").check();
    const status = dialog.getByRole("status", { name: "Fortschritt" });
    const count = Number((await status.innerText()).split(" ")[0]);
    expect(count).toBeGreaterThanOrEqual(3);
    const download = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Erzeugen" }).click();
    const file = await download;
    await expect(status).toHaveText(/erzeugt$/);
    expect(file.suggestedFilename()).toMatch(/Baustelle \d\d \d\d \d{4}\.pdf$/);
    const data = new Uint8Array(readFileSync((await file.path())!));
    const pdf = await pdfjs.getDocument({ data, standardFontDataUrl: FONTS }).promise;
    expect(pdf.numPages).toBe(count);
    for (let n = 1; n <= count; n++) {
      const vp = (await pdf.getPage(n)).getViewport({ scale: 1 });
      expect([Math.round(vp.width), Math.round(vp.height)].sort()).toEqual([595, 842]);
      expect((await texts(pdf, n)).map((i) => i.str)).toContain("Notizen");
    }
    const mapping = parseSiteMapping((await pdf.getMetadata()).metadata?.getRaw());
    expect(mapping).not.toBeNull();
    expect(mapping!.pages).toHaveLength(count);
    expect(mapping!.pages.every((p) => p.roomId === "r3bad00a")).toBe(true);
    expect(mapping!.pages.at(-1)).toMatchObject({ surface: "floor:r3bad00a", view: "Bad › Boden" });
  });
});
