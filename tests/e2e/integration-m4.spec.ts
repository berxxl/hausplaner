import { expect, test, type Page } from "@playwright/test";
import {
  clearProject,
  fixtureFiles,
  projectFiles,
  saveNow,
  surfaceToPage,
  worldToPage,
  writeFiles,
} from "./helpers";

/** M3-Fixture im Stand von M3: Schemaversion 3, ohne Reserven und Verteilerzuschlag. */
function m3Project(): Record<string, string> {
  const files = fixtureFiles("m3");
  files["projekt.yaml"] = files["projekt.yaml"]!.replace("schemaVersion: 5", "schemaVersion: 3")
    .replace(/ perBoardMm: \d+,/, "")
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

async function clickSurface(page: Page, u: number, v: number) {
  const p = await surfaceToPage(page, u, v);
  await page.mouse.click(p.x, p.y);
}

test("7.1 Gesamtablauf M4: M3-Projekt migrieren, UV, Belegung, Trasse, Leitung, Stromkreis, Aktor, Kanäle, Neuladen unverändert", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  await clearProject(request);
  await writeFiles(request, m3Project());
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Kleines Projekt" })).toBeVisible();
  const notice = page.getByRole("region", { name: "Hinweis" });
  await expect(notice).toContainText("Projekt auf Version 5 aktualisiert");
  await notice.getByRole("button", { name: "OK" }).click();
  const props = page.getByRole("complementary", { name: "Eigenschaften" });

  // UV in Küche › Wand Nord, Mitte (1000 / 1200), Oberkante 1750
  const s = await worldToPage(page, { x: 1000, y: 2800 });
  await page.mouse.dblclick(s.x, s.y);
  await expect(title(page)).toHaveText("Küche › Wand Nord");
  await tools(page).getByRole("button", { name: "Verteiler" }).click();
  await clickSurface(page, 1000, 1200);
  const dialog = page.getByRole("dialog", { name: "Verteiler anlegen" });
  await expect(dialog.getByLabel("Bezeichnung")).toHaveValue("UV EG");
  await dialog.getByRole("button", { name: "OK" }).click();
  await expect(props.getByLabel("TE-Belegung")).toHaveText(/48 TE$/);

  // Belegung: Netzteil (von der Migration ergänzt) in Reihe 1, Platz 1
  await props.getByRole("button", { name: "Belegung öffnen" }).click();
  const belegung = page.getByRole("img", { name: "Belegung" });
  const slot = (await belegung.locator('[data-row="1"] rect').first().boundingBox())!;
  await page.getByRole("button", { name: "Netzteil einsetzen" }).hover();
  await page.mouse.down();
  await page.mouse.move(slot.x + slot.width / 2, slot.y + slot.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect(belegung.locator("[data-board-device]")).toHaveCount(1);
  await expect(belegung.locator("[data-board-device]")).toHaveAttribute("data-slot", "1:1");

  // Trasse: UV → obere Zone (1000 / 2065) → vorhandener Knoten (2000 / 2065)
  await page.getByRole("tab", { name: "Fläche" }).click();
  await expect(title(page)).toHaveText("Küche › Wand Nord");
  await tools(page).getByRole("button", { name: "Trasse" }).click();
  await clickSurface(page, 1000, 1200);
  await clickSurface(page, 1000, 2065);
  await clickSurface(page, 2000, 2065);
  await page.keyboard.press("Escape");

  // Leitung UV → Schalter: 315 + 1000 + 1500 + 1015 = 3830, + 1500 + 300, · 1,1 = 6,2 m
  await tools(page).getByRole("button", { name: "Leitung" }).click();
  await clickSurface(page, 1000, 1200);
  await clickSurface(page, 3500, 1050);
  await page
    .getByRole("dialog", { name: "Leitung anlegen" })
    .getByRole("button", { name: "OK" })
    .click();
  await expect(props.getByLabel("Leitungslänge")).toHaveText("Länge: 6,2 m");

  // Stromkreis F1 in der UV, Schalter zuweisen, F1 hervorheben
  await tools(page).getByRole("button", { name: "Auswählen" }).click();
  await clickSurface(page, 1000, 1000);
  await expect(props.getByRole("heading", { name: "Verteiler" })).toBeVisible();
  await props.getByRole("button", { name: "Stromkreis hinzufügen" }).click();
  await page
    .getByRole("dialog", { name: "Stromkreis hinzufügen" })
    .getByRole("button", { name: "OK" })
    .click();
  await expect(props.getByRole("heading", { name: "Stromkreis" })).toBeVisible();
  await clickSurface(page, 3500, 1050);
  await props.getByLabel("Stromkreis").selectOption({ label: "F1 (UV EG)" });
  await page.getByRole("tree", { name: "Verteiler" }).getByRole("treeitem", { name: "F1" }).click();
  await expect(page.getByTestId("surface-devices").locator("[data-highlighted]")).toHaveCount(1);

  // KNX: Deckenauslass hängt über den Schalter an der UV → Schaltaktor übernehmen, Kanal zuordnen
  await page
    .getByRole("tree", { name: "Verteiler" })
    .getByRole("treeitem", { name: "UV EG" })
    .locator(".tree__item")
    .first()
    .click();
  await expect(props.getByRole("table", { name: "KNX" })).toBeVisible();
  await props.getByRole("button", { name: "Vorschlag übernehmen" }).click();
  await props.getByRole("button", { name: "Kanäle automatisch zuordnen" }).click();

  await saveNow(page);
  const before = await projectFiles(request);
  expect(Object.keys(before).sort()).toEqual([
    "geschosse/eg.yaml",
    "geschosse/og.yaml",
    "katalog.yaml",
    "leitungen.yaml",
    "projekt.yaml",
    "verteiler.yaml",
    "warnungen.yaml",
  ]);
  expect(before["projekt.yaml"]).toContain("teReservePercent: 25");
  const v = before["verteiler.yaml"]!;
  expect(v).toContain('label: "UV EG"');
  expect(v).toContain('typeId: "power-supply"');
  expect(v).toMatch(/label: "SA1"\n {4}typeId: "knx-switch-actuator"/);
  expect(v).toMatch(
    /knxAssignments:\n {2}- \{actuatorDeviceId: "[0-9a-z]{8}", channel: 1, consumerDeviceId: "d3decke1"\}/,
  );
  expect(before["geschosse/eg.yaml"]).toMatch(/id: "d2schalt"[\s\S]*?circuitId: "[0-9a-z]{8}"/);
  expect(before["leitungen.yaml"]).toMatch(
    /from: \{boardId: "[0-9a-z]{8}"\}\n {4}to: \{deviceId: "d2schalt"\}/,
  );

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
