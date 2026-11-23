import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { fixtureFiles, projectFiles, resetProject, saveNow, writeFiles } from "./helpers";

async function open3d(page: Page) {
  await page.getByRole("tab", { name: "3D" }).click();
  await expect(page.getByTestId("scene").or(page.getByTestId("view-error"))).toBeVisible({
    timeout: 20000,
  });
  await page.waitForFunction(
    () => "__hausplaner3d" in window || document.querySelector('[data-testid="view-error"]'),
  );
  const error = page.getByTestId("view-error");
  if ((await error.count()) > 0) throw new Error(`3D-Ansicht: ${await error.innerText()}`);
  await page.waitForTimeout(300);
}

async function project3d(page: Page, x: number, y: number, z: number) {
  return page.evaluate(
    ([x, y, z]) =>
      (
        window as unknown as {
          __hausplaner3d: { project(x: number, y: number, z: number): { x: number; y: number } };
        }
      ).__hausplaner3d.project(x!, y!, z!),
    [x, y, z],
  );
}

/** Projekt m6 mit geänderten Dateien öffnen. */
async function openM6(
  page: Page,
  request: Parameters<typeof resetProject>[0],
  change?: (f: Record<string, string>) => void,
) {
  await resetProject(request, "m6");
  if (change) {
    const files = fixtureFiles("m6");
    change(files);
    await writeFiles(request, files);
  }
  await page.goto("/");
  await page.getByRole("heading", { level: 1 }).waitFor();
}

async function saveImage(page: Page, size: string) {
  await page.getByRole("button", { name: "Bild speichern …" }).click();
  const menu = page.getByRole("group", { name: "Bild speichern" });
  await menu.getByLabel("Auflösung").selectOption({ label: size });
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    menu.getByRole("button", { name: "Speichern" }).click(),
  ]);
  return { name: download.suggestedFilename(), data: readFileSync((await download.path())!) };
}

/** Breite und Höhe aus dem IHDR-Block einer PNG-Datei. */
const pngSize = (data: Buffer) => ({ width: data.readUInt32BE(16), height: data.readUInt32BE(20) });

/** Mittlere Helligkeit (0–255) eines 9 × 9-Felds um (x, y) einer PNG-Datei, im Browser dekodiert. */
async function brightness(page: Page, data: Buffer, points: { x: number; y: number }[]) {
  return page.evaluate(
    async ([b64, pts]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      return (pts as { x: number; y: number }[]).map(({ x, y }) => {
        const d = ctx.getImageData(Math.round(x) - 4, Math.round(y) - 4, 9, 9).data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) sum += (d[i]! + d[i + 1]! + d[i + 2]!) / 3;
        return sum / (d.length / 4);
      });
    },
    [data.toString("base64"), points] as const,
  );
}

test("M6: Klimaverbindung in den Eigenschaften, Kondensat ohne Gefälle markiert (7.1)", async ({
  page,
  request,
}) => {
  // Ablauf auf 2500 mm: das senkrechte Segment außen steigt zum Ablauf an
  await openM6(page, request, (f) => {
    f["geschosse/eg.yaml"] = f["geschosse/eg.yaml"]!.replaceAll(
      "u: 4500, v: 300",
      "u: 4500, v: 2500",
    );
  });
  await page.getByRole("tab", { name: "Listen" }).click();
  await page.getByLabel("Liste", { exact: true }).selectOption("devices");
  await page
    .getByRole("table", { name: "Geräte" })
    .getByRole("cell", { name: "Klima Schlafen", exact: true })
    .click();
  const props = page.getByRole("complementary", { name: "Eigenschaften" });
  const box = props.getByRole("region", { name: "Klimaverbindung" });
  await expect(box).toContainText("Außengerät: Klima außen Schlafen");
  await expect(box).toContainText("Kältemittelleitung: Kältemittel Schlafen · 5,9 m");
  await expect(box).toContainText(
    "Kondensatleitung: Kondensat Schlafen → Kondensatablauf Fallrohr",
  );

  const bar = page.getByRole("contentinfo", { name: "Warnungen" });
  await bar.getByRole("button").first().click();
  await bar
    .getByRole("button", {
      name: "Kondensat ohne Gefälle: Kondensat Schlafen (steigt an, mindestens 1,0 %)",
      exact: true,
    })
    .click();
  const seg = page.locator('[data-segment="skrunter"] line').last();
  await expect(seg).toHaveAttribute("stroke", "#d70015");
});

test("M6: Leuchten in 3D, nur Kreis der Spots, Helligkeit unter einem Spot, Bild 1920 × 1080 (7.1, 6.1)", async ({
  page,
  request,
}) => {
  await openM6(page, request, (f) => {
    f["ansichten.yaml"] =
      f["ansichten.yaml"]! +
      [
        '  - id: "v2wohnen"',
        '    name: "Draufsicht Wohnen"',
        "    position: {x: 5900, y: 1400, z: 9000}",
        "    target: {x: 5900, y: 1500, z: 0}",
        '    upToStoreyId: "e0g1k2m3"',
        "",
      ].join("\n");
  });
  await open3d(page);
  const scene = page.getByTestId("scene");
  await page.getByLabel("Gespeicherte Ansicht").selectOption({ label: "Draufsicht Wohnen" });
  await expect(scene).toHaveAttribute("data-storeys", "EG");
  await expect(scene).toHaveAttribute("data-lights", "");
  const panel = page.getByRole("complementary", { name: "Licht" });
  await panel.getByRole("radio", { name: "Leuchten" }).check();
  await expect(scene).toHaveAttribute("data-light-mode", "lights");
  // Spec „Spotreihe“: vier Spotlichter; „Warmweiß“: 3000 K wärmer als 4000 K
  await expect(scene).toHaveAttribute("data-lights", /dsspot04:spot:/);
  const all = (await scene.getAttribute("data-lights"))!.split(";");
  expect(all.filter((l) => l.includes(":spot:"))).toHaveLength(4);
  // Spec „Nur Deckenspots“
  await panel.getByRole("button", { name: "Alle aus" }).click();
  await expect(scene).toHaveAttribute("data-lights", "");
  await panel.getByRole("checkbox", { name: "F3 Licht Wohnen (UV EG)" }).check();
  await expect(scene).toHaveAttribute(
    "data-lights",
    ["dsspot01", "dsspot02", "dsspot03", "dsspot04"].map((id) => `${id}:spot:#ffb16e`).join(";"),
  );
  await page.waitForTimeout(300);

  // Bild in Fenstergröße: Boden unter Spot 2 heller als 1,2 m daneben
  const box = (await scene.boundingBox())!;
  const ratio = await page.evaluate(() => window.devicePixelRatio);
  const under = await project3d(page, 5700, 1500, 0);
  const beside = await project3d(page, 5700, 2700, 0);
  const shot = await saveImage(page, "wie Fenster");
  const toImage = (p: { x: number; y: number }) => ({
    x: (p.x - box.x) * ratio,
    y: (p.y - box.y) * ratio,
  });
  const [bright, dark] = await brightness(page, shot.data, [toImage(under), toImage(beside)]);
  expect(bright!).toBeGreaterThan(dark! * 1.5);

  // Spec „Bild für die Familie“
  const image = await saveImage(page, "1920 × 1080");
  expect(pngSize(image.data)).toEqual({ width: 1920, height: 1080 });
  expect(image.name).toMatch(/^Kleines Projekt 3D \d\d \d\d \d{4}\.png$/);
  // die Ansicht bleibt danach in Fenstergröße
  expect(await project3d(page, 5700, 1500, 0)).toEqual(under);
});

test("M6: Ansicht „Küche vom Esstisch“ speichern, Kamera bewegen, aufrufen, nach Neuladen gleich (6.2)", async ({
  page,
  request,
}) => {
  await openM6(page, request);
  await open3d(page);
  const scene = page.getByTestId("scene");
  const box = (await scene.boundingBox())!;
  const drag = async (dx: number) => {
    await page.mouse.move(box.x + box.width / 3, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 3 + dx, box.y + box.height / 2 + dx / 3, {
      steps: 8,
    });
    await page.mouse.up();
    // Dämpfung der Orbit-Steuerung ausklingen lassen
    await page.waitForTimeout(1500);
  };
  await drag(120);
  const saved = await project3d(page, 1000, 800, 900);
  await page.getByRole("button", { name: "Ansicht speichern …" }).click();
  const form = page.getByRole("form", { name: "Ansicht speichern" });
  await form.getByLabel("Name der Ansicht").fill("Küche vom Esstisch");
  await form.getByRole("button", { name: "Speichern" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("Die Ansicht „Küche vom Esstisch“ gibt es schon.");
  await confirm.getByRole("button", { name: "Überschreiben" }).click();
  await drag(-200);
  const moved = await project3d(page, 1000, 800, 900);
  expect(Math.abs(moved.x - saved.x) + Math.abs(moved.y - saved.y)).toBeGreaterThan(20);
  const select = page.getByLabel("Gespeicherte Ansicht");
  await select.selectOption("");
  await select.selectOption({ label: "Küche vom Esstisch" });
  await page.waitForTimeout(200);
  const recalled = await project3d(page, 1000, 800, 900);
  // gespeichert wird auf ganze mm gerundet
  expect(Math.abs(recalled.x - saved.x)).toBeLessThan(2);
  expect(Math.abs(recalled.y - saved.y)).toBeLessThan(2);

  await saveNow(page);
  expect((await projectFiles(request))["ansichten.yaml"]).toContain('name: "Küche vom Esstisch"');
  await page.reload();
  await page.getByRole("heading", { level: 1 }).waitFor();
  await open3d(page);
  await page.getByLabel("Gespeicherte Ansicht").selectOption({ label: "Küche vom Esstisch" });
  await page.waitForTimeout(200);
  const again = await project3d(page, 1000, 800, 900);
  expect(Math.abs(again.x - saved.x)).toBeLessThan(2);
  expect(Math.abs(again.y - saved.y)).toBeLessThan(2);
});
