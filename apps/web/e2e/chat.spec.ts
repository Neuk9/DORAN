import { test, expect } from "@playwright/test";

test("chat returns recommended cards", async ({ page }) => {
  await page.goto("/chat");
  await page.getByRole("textbox").fill("초1 아이 방학 돌봄, 7시 퇴근");
  await page.getByRole("button", { name: "보내기" }).click();
  await expect(page.getByTestId("program-card").first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("program-card").first()).toContainText("출처");
});

test("crisis message shows hotline banner and no cards", async ({ page }) => {
  await page.goto("/chat");
  await page.getByRole("textbox").fill("죽고 싶어요");
  await page.getByRole("button", { name: "보내기" }).click();
  await expect(page.getByTestId("crisis-banner")).toContainText("129");
});
