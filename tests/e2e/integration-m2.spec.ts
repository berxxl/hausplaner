import { expect, test, type Page } from "@playwright/test";
import { parse } from "yaml";
import type { StoreyFile } from "../../src/model/schema";
import {
  clearProject,
  fixtureFiles,
  projectFiles,
  saveNow,
  worldToPage,
  writeFiles,
} from "./helpers";

async function clickWorld(page: Page, x: number, y: number, modifiers: "Shift"[] = []) {
  const s = await worldToPage(page, { x, y });
  for (const m of modifiers) await page.keyboard.down(m);
  await page.mouse.click(s.x, s.y);
  for (const m of modifiers) await page.keyboard.up(m);
}

async function commit(page: Page, label: string, value: string) {
  const field = page.getByRole("complementary", { name: "Eigenschaften" }).getByLabel(label, {
    exact: true,
  });
  await field.fill(value);
  await field.press("Enter");
}

/** Projekt im Stand von M1: Schemaversion 1, ohne Zonen, ohne katalog.yaml. */
function m1Project(): Record<string, string> {
  const files = fixtureFiles("klein");
  files["projekt.yaml"] = files["projekt.yaml"]!.replace("schemaVersion: 3", "schemaVersion: 1")
    .replace(/ {2}lengthAllowance: .*\n/, "")
    .replace(/ {2}installZones:\n( {4}.*\n)+/, "");
  return files;
}

function countWrites(page: Page) {
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "PUT" && r.url().includes("/api/files")) writes.push(r.postData() ?? "");
  });
  return writes;
}

test("9.1 Gesamtablauf M2: M1-Projekt migrieren bis Neuladen, Projekt danach unverändert", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  await clearProject(request);
  await writeFiles(request, m1Project());
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Kleines Projekt" })).toBeVisible();
  // Migration: Hinweis, nichts geschrieben
  const notice = page.getByRole("region", { name: "Hinweis" });
  await expect(notice).toContainText("Projekt auf Version 3 aktualisiert");
  await notice.getByRole("button", { name: "OK" }).click();
  expect(Object.keys(await projectFiles(request)).sort()).toEqual([
    "geschosse/eg.yaml",
    "projekt.yaml",
  ]);

  // Katalogtyp kopieren
  await page.getByRole("button", { name: "Katalog" }).click();
  const catalog = page.getByRole("dialog", { name: "Katalog" });
  await catalog
    .getByRole("listbox", { name: "Typen" })
    .getByRole("option", { name: /^Steckdose$/ })
    .click();
  await catalog.getByRole("button", { name: "Kopieren" }).click();
  await expect(
    catalog.getByRole("group", { name: "Eigenschaften des Typs" }).getByLabel("Name"),
  ).toHaveValue("Steckdose Kopie");
  await catalog.getByRole("button", { name: "Schließen" }).click();

  // zwei Steckdosen des neuen Typs in der Wandansicht Küche › Wand Süd
  const s = await worldToPage(page, { x: 2000, y: 400 });
  await page.mouse.dblclick(s.x, s.y);
  await expect(page.getByRole("heading", { name: "Fläche" })).toHaveText("Küche › Wand Süd");
  const tools = page.getByRole("toolbar", { name: "Werkzeuge der Fläche" });
  await tools.getByRole("button", { name: "Gerät" }).click();
  await tools.getByLabel("Gerätetyp", { exact: true }).selectOption({ label: "Steckdose Kopie" });
  const box = (await page.getByTestId("surface-contour").boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.5);
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.5);
  const glyphs = page.getByTestId("surface-devices").locator("[data-device]");
  await expect(glyphs).toHaveCount(2);

  // Kombination waagerecht im Abstand 71 mm
  await tools.getByRole("button", { name: "Auswählen" }).click();
  await glyphs.nth(0).click();
  await glyphs.nth(1).click({ modifiers: ["Shift"] });
  const props = page.getByRole("complementary", { name: "Eigenschaften" });
  await expect(props).toContainText("2 Geräte ausgewählt");
  await props.getByRole("button", { name: "Waagerecht kombinieren" }).click();

  // Schalter im Grundriss auf der Küchenseite der Wand zum Bad
  await page.getByRole("tab", { name: "Grundriss" }).click();
  const planTools = page.getByRole("toolbar", { name: "Werkzeuge" });
  await planTools.getByRole("button", { name: "Gerät" }).click();
  await page
    .getByRole("group", { name: "Geräteoptionen" })
    .getByLabel("Gerätetyp", { exact: true })
    .selectOption({ label: "Schalter" });
  await clickWorld(page, 1500, 2880);

  // Kleiderschrank vor die Steckdosen an der Südwand
  await planTools.getByRole("button", { name: "Möbel" }).click();
  await page
    .getByRole("group", { name: "Möbeloptionen" })
    .getByLabel("Möbeltyp")
    .selectOption({ label: "Kleiderschrank" });
  await clickWorld(page, 2000, 1500, ["Shift"]);
  await expect(props.getByRole("heading", { name: "Möbel" })).toBeVisible();
  await commit(page, "Drehung", "180");
  await commit(page, "Breite", "3600");
  await commit(page, "x (Mitte)", "2045");
  await commit(page, "y (Mitte)", "465"); // Rückseite bündig auf dem Putz (150 + 15)

  // Warnungen übergehen
  const bar = page.getByRole("contentinfo", { name: "Warnungen" });
  await bar.getByRole("button", { name: "2 Warnungen" }).click();
  const list = bar.getByRole("table", { name: "Warnungsliste" });
  await expect(list).toContainText("Gerät durch Möbel verdeckt: Steckdose Kopie (Kleiderschrank)");
  await list
    .getByRole("button", { name: /^Übergehen:/ })
    .first()
    .click();
  await list
    .getByRole("button", { name: /^Übergehen:/ })
    .first()
    .click();
  await expect(bar.getByRole("button", { name: "Keine Warnungen · 2 übergangen" })).toBeVisible();

  await saveNow(page);
  const before = await projectFiles(request);
  expect(Object.keys(before).sort()).toEqual([
    "geschosse/eg.yaml",
    "katalog.yaml",
    "projekt.yaml",
    "warnungen.yaml",
  ]);
  expect(before["projekt.yaml"]).toContain("schemaVersion: 3");
  expect(before["katalog.yaml"]).toContain('name: "Steckdose Kopie"');
  const eg = parse(before["geschosse/eg.yaml"]!) as StoreyFile;
  const copies = eg
    .devices!.filter((d) => d.label === "Steckdose Kopie")
    .map((d) => d.placement)
    .flatMap((p) => (p.kind === "surface" ? [p] : []))
    .sort((a, b) => a.u - b.u);
  expect(copies).toHaveLength(2);
  expect(copies[1]!.u - copies[0]!.u).toBe(71);
  expect(copies.map((p) => p.v)).toEqual([300, 300]);
  expect(eg.devices!.some((d) => d.typeId === "switch")).toBe(true);
  expect(eg.furniture).toHaveLength(1);
  expect((before["warnungen.yaml"]!.match(/device-covered:/g) ?? []).length).toBe(2);

  // Neu laden: nichts zu schreiben, Projekt identisch
  const writes = countWrites(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Kleines Projekt" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Hinweis" })).toHaveCount(0);
  await expect(bar.getByRole("button", { name: "Keine Warnungen · 2 übergangen" })).toBeVisible();
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.getByRole("status", { name: "Speicherstand" })).toHaveText("gespeichert");
  expect(writes).toEqual([]);
  expect(await projectFiles(request)).toEqual(before);
});
