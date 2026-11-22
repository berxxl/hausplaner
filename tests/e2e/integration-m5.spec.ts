import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { openProject } from "./helpers";

const FONTS = join(process.cwd(), "node_modules/pdfjs-dist/standard_fonts/");

test("M5-Ablauf: Listen filtern und auswählen, Export mit Wandansichten, Belegung und Leitungsliste (8.1)", async ({
  page,
  request,
}) => {
  await openProject(page, request, "m4");
  // Listen: Leitungen, nur OG, Zeile wählt die Leitung
  await page.getByRole("tab", { name: "Listen" }).click();
  await page.getByLabel("Liste", { exact: true }).selectOption("cables");
  await page.getByLabel("Geschoss", { exact: true }).selectOption({ label: "OG" });
  const table = page.getByRole("table", { name: "Leitungen" });
  await expect(table.getByRole("row")).toHaveCount(4);
  await table.getByRole("cell", { name: "Rollladen Kind – UV OG" }).click();
  await expect(page.getByRole("complementary", { name: "Eigenschaften" })).toContainText(
    "Von „Rollladen Kind“ nach „UV OG“",
  );
  await expect(page.getByRole("list", { name: "Summen" })).toContainText("NYM-J 5×1,5: 1 Leitung");
  // Geräteliste: Anschluss im Verteiler
  await page.getByLabel("Liste", { exact: true }).selectOption("devices");
  await expect(page.getByRole("table", { name: "Geräte" })).toContainText(
    "UV OG · F2 Kind; UV OG · JA1.A",
  );

  // Export
  await page.getByRole("button", { name: "Exportieren …" }).click();
  const dialog = page.getByRole("dialog", { name: "PDF exportieren" });
  await dialog.getByLabel("Grundriss EG").uncheck();
  await dialog.getByLabel("Maßstab").selectOption("25");
  await dialog.getByLabel("Küche Wandansichten").check();
  await dialog.getByLabel("Belegung UV EG").check();
  await dialog.getByLabel("Liste Leitungen").check();
  await expect(dialog.getByRole("list", { name: "Meldungen" })).toHaveCount(0);
  const count = Number(
    (await dialog.getByRole("status", { name: "Fortschritt" }).innerText()).split(" ")[0],
  );
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Exportieren" }).click();
  const file = await download;
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(readFileSync((await file.path())!)),
    standardFontDataUrl: FONTS,
  }).promise;
  expect(pdf.numPages).toBe(count);
  const first = (await (await pdf.getPage(1)).getTextContent()).items.map((i) =>
    "str" in i ? i.str : "",
  );
  expect(first.some((s) => s.startsWith("Küche › Wand"))).toBe(true);
  expect(first).toContain("1:25");
  const all: string[] = [];
  for (let n = 1; n <= count; n++)
    all.push(
      ...(await (await pdf.getPage(n)).getTextContent()).items.map((i) =>
        "str" in i ? i.str : "",
      ),
    );
  expect(all).toContain("Belegung UV EG");
  expect(all).toContain("Liste Leitungen");
  expect(all).toContain("Rollladen Kind – UV OG");
  await dialog.getByRole("button", { name: "Schließen" }).click();
  await expect(dialog).toHaveCount(0);
});
