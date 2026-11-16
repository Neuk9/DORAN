import { test, expect } from "@playwright/test";

test("home renders and big text toggles", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const before = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--font-scale"));
  await page.getByRole("button", { name: /글씨 크게/ }).click();
  const after = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--font-scale"));
  expect(after).not.toBe(before);
});
