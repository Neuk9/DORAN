import { test, expect } from "@playwright/test";

test("filters update the list", async ({ page }) => {
  await page.goto("/explore");
  await page.getByLabel("분야").selectOption("culture");
  await expect(page.getByTestId("program-card").first()).toContainText("문화");
});

test("card shows source and captured date", async ({ page }) => {
  await page.goto("/explore");
  const card = page.getByTestId("program-card").first();
  await expect(card).toContainText("출처");
  await expect(card).toContainText("기준일");
});
