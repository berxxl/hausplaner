import { expect, test, type Page } from "@playwright/test";
import { parse } from "yaml";
import type { CablesFile, StoreyFile } from "../../src/model/schema";
import {
  clearProject,
  fixtureFiles,
  projectFiles,
  saveNow,
  surfaceToPage,
  worldToPage,
  writeFiles,
} from "./helpers";

/** M2-Fixture im Stand von M2: Schemaversion 2, ohne Leitungszuschläge. */
function m2Project(): Record<string, string> {
  const files = fixtureFiles("m2");
  files["projekt.yaml"] = files["projekt.yaml"]!.replace("schemaVersion: 5", "schemaVersion: 2")
    .replace(/ {2}lengthAllowance: .*\n/, "")
    .replace(/ {2}teReservePercent: .*\n/, "")
    .replace(/ {2}actuatorReservePercent: .*\n/, "")
    .replace(/ {2}condensateMinSlopePercent: .*\n/, "");
  return files;
}

function countWrites(page: Page) {
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "PUT" && r.url().includes("/api/files")) writes.push(r.postData() ?? "");
  });
  return writes;
}

const title = (page: Page) => page.getByRole("heading", { name: "Fläche" });
const tools = (page: Page) => page.getByRole("toolbar", { name: "Werkzeuge der Fläche" });
const nav = (page: Page) => page.getByRole("navigation", { name: "Navigation" });

async function clickSurface(page: Page, u: number, v: number) {
  const p = await surfaceToPage(page, u, v);
  await page.mouse.click(p.x, p.y);
}

test("7.1 Gesamtablauf M3: M2-Projekt migrieren, Trasse, Durchbruch, Leitung, Zuschläge, Neuladen unverändert", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  await clearProject(request);
  await writeFiles(request, m2Project());
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Kleines Projekt" })).toBeVisible();
  const notice = page.getByRole("region", { name: "Hinweis" });
  await expect(notice).toContainText("Projekt auf Version 5 aktualisiert");
  await notice.getByRole("button", { name: "OK" }).click();

  // Küche › Wand Nord: vom Schalter (3500 / 1050) hinauf an die Decke (Oberkante 2365)
  const s = await worldToPage(page, { x: 1000, y: 2800 });
  await page.mouse.dblclick(s.x, s.y);
  await expect(title(page)).toHaveText("Küche › Wand Nord");
  await tools(page).getByRole("button", { name: "Trasse" }).click();
  await clickSurface(page, 3500, 1050);
  await clickSurface(page, 3500, 2362);
  await page.keyboard.press("Escape");
  // Durchbruch zum Bad
  await tools(page).getByRole("button", { name: "Durchbruch" }).click();
  await clickSurface(page, 2000, 1000);
  await page
    .getByRole("dialog", { name: "Durchbruch anlegen" })
    .getByRole("button", { name: "OK" })
    .click();

  // Decke: vom Übergangsknoten zum Deckenauslass (x 2000, y 1500 → u −2000)
  await nav(page).getByRole("button", { name: "Decke" }).click();
  await expect(title(page)).toHaveText("Küche › Decke");
  await tools(page).getByRole("button", { name: "Trasse" }).click();
  await clickSurface(page, -3500, 2925);
  await clickSurface(page, -2000, 1500);
  await page.keyboard.press("Escape");

  // Leitung vom Deckenauslass zum Schalter
  await tools(page).getByRole("button", { name: "Leitung" }).click();
  await clickSurface(page, -2000, 1500);
  // zurück über den Grundriss; das erste Gerät bleibt gemerkt
  await page.getByRole("tab", { name: "Grundriss" }).click();
  const back = await worldToPage(page, { x: 1000, y: 2800 });
  await page.mouse.dblclick(back.x, back.y);
  await expect(title(page)).toHaveText("Küche › Wand Nord");
  await tools(page).getByRole("button", { name: "Leitung" }).click();
  await clickSurface(page, 3500, 1050);
  await page
    .getByRole("dialog", { name: "Leitung anlegen" })
    .getByRole("button", { name: "OK" })
    .click();
  const props = page.getByRole("complementary", { name: "Eigenschaften" });
  // 1315 Wand + 2069 Decke (diagonal) + 2 × 300, plus 10 %
  await expect(props.getByLabel("Leitungslänge")).toHaveText("Länge: 4,4 m");
  await expect(page.getByTestId("surface-routes").locator("[data-highlighted]")).toHaveCount(1);

  // Zuschläge: Verschnitt 0 %
  await page.getByRole("button", { name: "Projekteinstellungen" }).click();
  const waste = page.getByLabel("Verschnitt (%)");
  await waste.fill("0");
  await waste.press("Enter");
  await page.getByRole("button", { name: "Schließen" }).click();
  await expect(props.getByLabel("Leitungslänge")).toHaveText("Länge: 4,0 m");

  await saveNow(page);
  const before = await projectFiles(request);
  expect(Object.keys(before).sort()).toEqual([
    "geschosse/eg.yaml",
    "katalog.yaml",
    "leitungen.yaml",
    "projekt.yaml",
    "warnungen.yaml",
  ]);
  expect(before["projekt.yaml"]).toContain("schemaVersion: 5");
  expect(before["projekt.yaml"]).toContain(
    "lengthAllowance: {perDeviceMm: 300, perBoardMm: 1500, wastePercent: 0}",
  );
  const eg = parse(before["geschosse/eg.yaml"]!) as StoreyFile;
  expect(eg.routeSegments!.filter((x) => x.kind === "penetration")).toHaveLength(1);
  expect(eg.routeNodes!.some((n) => n.anchors.length === 2)).toBe(true);
  const cables = parse(before["leitungen.yaml"]!) as CablesFile;
  expect(cables.cables![0]!.path).toHaveLength(2);

  // Neu laden: nichts zu schreiben, Projekt identisch
  const writes = countWrites(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Kleines Projekt" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Hinweis" })).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.getByRole("status", { name: "Speicherstand" })).toHaveText("gespeichert");
  expect(writes).toEqual([]);
  expect(await projectFiles(request)).toEqual(before);
});
