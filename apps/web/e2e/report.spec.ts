import { test, expect } from "@playwright/test";

test("report shows gap score and disclaimer", async ({ page }) => {
  await page.goto("/report/2711053000");
  await expect(page.getByTestId("gap-score")).toContainText("%");
  await expect(page.getByTestId("gap-narrative")).toBeVisible();
  await expect(page.getByText("가중치 기반 참고 지표이며")).toBeVisible();
});

test("saved list can remove an item", async ({ page }) => {
  await page.goto("/saved");
  const count = await page.getByTestId("saved-item").count();
  if (count > 0) {
    await page.getByRole("button", { name: "삭제" }).first().click();
    await expect(page.getByTestId("saved-item")).toHaveCount(count - 1);
  }
});
