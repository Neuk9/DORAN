import { test, expect } from "@playwright/test";

test("keyboard can reach the chat input", async ({ page }) => {
  await page.goto("/chat");
  let focused = false;
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press("Tab");
    const role = await page.evaluate(() => document.activeElement?.getAttribute("role"));
    const tag = await page.evaluate(() => document.activeElement?.tagName);
    if (role === "textbox" || tag === "TEXTAREA") {
      focused = true;
      break;
    }
  }
  expect(focused).toBe(true);
});

test("senior scenario: big text then recommendation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: /글씨 크게/ }).click();
  await page.getByRole("link", { name: /상담/ }).click();
  await page.getByRole("textbox").fill("혼자 사는 68살인데 도움받을 게 있을까요");
  await page.getByRole("button", { name: "보내기" }).click();
  await expect(page.getByTestId("program-card").first()).toBeVisible({ timeout: 20000 });
});
