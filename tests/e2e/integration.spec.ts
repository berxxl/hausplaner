import { expect, test, type Page } from "@playwright/test";
import { pdfToWorld } from "../../src/geometry/underlay";
import {
  clearProject,
  fixtureFiles,
  PDF,
  projectFiles,
  saveNow,
  worldToPage,
  writeFiles,
} from "./helpers";

async function clickWorld(page: Page, x: number, y: number) {
  const s = await worldToPage(page, { x, y });
  await page.mouse.click(s.x, s.y);
}

/** Zählt Schreibanfragen an den Server. */
function countWrites(page: Page) {
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "PUT" && r.url().includes("/api/files")) writes.push(r.postData() ?? "");
  });
  return writes;
}

test("9.1 Gesamtablauf: neues Projekt bis Neuladen, Projekt danach unverändert", async ({
  page,
  request,
}) => {
  // langer Ablauf: auf langsamen CI-Runnern reichen 30 s nicht
  test.setTimeout(90_000);
  await clearProject(request);
  await page.goto("/");
  const form = page.getByRole("form", { name: "Neues Projekt" });
  await form.getByLabel("Projektname").fill("Integrationstest");
  await form.getByRole("button", { name: "Anlegen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Integrationstest" })).toBeVisible();

  // PDF laden und über die bemaßte Strecke kalibrieren
  await page.getByRole("treeitem", { name: "EG" }).locator(":scope > .tree__item").click();
  await page
    .getByRole("complementary", { name: "Eigenschaften" })
    .getByLabel("PDF-Datei")
    .setInputFiles(PDF.vector);
  await expect(page.getByTestId("underlay")).toBeAttached();
  await page.getByRole("button", { name: "Kalibrieren" }).click();
  for (const p of [
    { x: 170.1, y: 705.8 },
    { x: 290.8, y: 705.8 },
  ]) {
    const s = await worldToPage(page, pdfToWorld({ offset: { x: 0, y: 0 }, rotationDeg: 0 }, p));
    await page.mouse.click(s.x, s.y);
  }
  const calib = page.getByRole("dialog", { name: "Kalibrieren" });
  await calib.getByLabel("Realer Abstand der beiden Punkte").fill("4260");
  await calib.getByRole("button", { name: "OK" }).click();

  // vier Wände über die Gebäudeecken des Plans (Weltursprung = p1, Gebäude 8000 × 6000 links darüber)
  await page.getByRole("button", { name: "Alles zeigen" }).click();
  await page.getByRole("button", { name: "Wand", exact: true }).click();
  // Ecke unten links des Grundrisses liegt 1200 mm über der Referenzstrecke
  for (const [x, y] of [
    [0, 1200],
    [8000, 1200],
    [8000, 7200],
    [0, 7200],
    [0, 1200],
  ] as const)
    await clickWorld(page, x, y);
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-wall]")).toHaveCount(4);

  await page.getByRole("button", { name: "Raum", exact: true }).click();
  await clickWorld(page, 4000, 4200);
  await page.getByRole("dialog", { name: "Raum anlegen" }).getByLabel("Name").fill("Wohnen");
  await page
    .getByRole("dialog", { name: "Raum anlegen" })
    .getByRole("button", { name: "OK" })
    .click();

  await page.getByRole("button", { name: "Öffnung", exact: true }).click();
  await clickWorld(page, 4000, 1200);
  await page
    .getByRole("dialog", { name: "Öffnung setzen" })
    .getByRole("button", { name: "OK" })
    .click();

  // Wandansicht öffnen
  await page.getByRole("button", { name: "Auswählen" }).click();
  const s = await worldToPage(page, { x: 4000, y: 1700 });
  await page.mouse.dblclick(s.x, s.y);
  await expect(page.getByRole("heading", { name: "Fläche" })).toHaveText("Wohnen › Wand Süd");
  await expect(
    page.getByRole("img", { name: "Flächenansicht" }).locator("[data-opening]"),
  ).toHaveCount(1);

  await saveNow(page);
  const before = await projectFiles(request);
  expect(Object.keys(before).sort()).toEqual(["geschosse/eg.yaml", "katalog.yaml", "projekt.yaml"]);
  expect(before["geschosse/eg.yaml"]).toContain('name: "Wohnen"');
  expect(before["geschosse/eg.yaml"]).toContain("distanceMm: 4260");

  const writes = countWrites(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Integrationstest" })).toBeVisible();
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.getByRole("status", { name: "Speicherstand" })).toHaveText("gespeichert");
  expect(writes).toEqual([]);
  expect(await projectFiles(request)).toEqual(before);
});

test("9.2 Änderung im DG ändert nur geschosse/dg.yaml; Laden und Speichern ohne Änderung schreibt nichts", async ({
  page,
  request,
}) => {
  await clearProject(request);
  const dg = fixtureFiles("dg")["geschosse/dg.yaml"]!;
  await writeFiles(request, { ...fixtureFiles("klein"), "geschosse/dg.yaml": dg });
  const writes = countWrites(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Kleines Projekt" })).toBeVisible();
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.getByRole("status", { name: "Speicherstand" })).toHaveText("gespeichert");
  expect(writes).toEqual([]);

  const before = await projectFiles(request);
  await page.getByRole("treeitem", { name: "DG" }).locator(":scope > .tree__item").click();
  await clickWorld(page, 4000, 1500); // Ostwand des DG
  const thickness = page.getByRole("complementary", { name: "Eigenschaften" }).getByLabel("Dicke");
  await thickness.fill("365");
  await thickness.press("Enter");
  await saveNow(page);
  const after = await projectFiles(request);
  const changed = Object.keys(after).filter((p) => after[p] !== before[p]);
  expect(changed).toEqual(["geschosse/dg.yaml"]);
  expect(writes).toHaveLength(1);
  expect(Object.keys(JSON.parse(writes[0]!).files)).toEqual(["geschosse/dg.yaml"]);
});
