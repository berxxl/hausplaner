import { expect, test } from "@playwright/test";
import { openProject } from "./helpers";

test("Startseite lädt das Projekt", async ({ page, request }) => {
  await openProject(page, request);
  await expect(page).toHaveTitle("Hausplaner");
  await expect(page.getByRole("heading", { name: "Kleines Projekt" })).toBeVisible();
  await expect(page.getByRole("status", { name: "Speicherstand" })).toHaveText("gespeichert");
});
