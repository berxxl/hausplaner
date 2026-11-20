import { expect, test } from "@playwright/test";

test("Startseite lädt das Projekt", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Hausplaner");
  await expect(page.getByRole("heading", { name: "Kleines Projekt" })).toBeVisible();
  await expect(page.getByRole("status", { name: "Speicherstand" })).toHaveText("gespeichert");
});
