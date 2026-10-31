import { test, expect, demoDashboard, reportDashboard, resultCard, expectFits } from "./fixtures";

test("demo review, exclusion/restoration, lessons and focus return make no API calls", async ({ page }) => {
  let apiCalls = 0;
  page.on("request", (request) => { if (request.url().includes("/api/")) apiCalls++; });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore a synthetic demo", exact: true }).click();
  const hemoglobin = page.getByRole("row").filter({ has: page.getByRole("spinbutton", { name: "Hemoglobin value", exact: true }) });
  await hemoglobin.getByRole("button", { name: "Exclude", exact: true }).click();
  await page.getByRole("button", { name: "Confirm all", exact: true }).click();
  await page.getByRole("button", { name: "Finalize review", exact: true }).click();
  await expect(page.getByRole("button", { name: "Show Hemoglobin on body map", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Review data", exact: true }).click();
  await hemoglobin.getByRole("button", { name: "Restore", exact: true }).click();
  await page.getByRole("button", { name: "Confirm all", exact: true }).click();
  await page.getByRole("button", { name: "Finalize review", exact: true }).click();
  const learn = resultCard(page, "Hemoglobin").getByRole("button", { name: "Learn & ask", exact: true });
  await learn.click();
  await expect(page.getByRole("button", { name: "Close result details" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("dialog")).toContainText("Illustrative motion");
  expect(await page.getByRole("dialog").evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(learn).toBeFocused();
  expect(apiCalls).toBe(0);
});

test("atlas supports isolated thyroid/pituitary focus and reset without inference", async ({ page }) => {
  await reportDashboard(page);
  await page.getByRole("button", { name: "Show TSH(THYROID STIMULATING HORMONE) on body map", exact: true }).click();
  const atlas = page.getByRole("region", { name: "Educational body atlas", exact: true });
  await atlas.scrollIntoViewIfNeeded();
  await expect(atlas.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Focus Thyroid", exact: true }).click();
  await expect(atlas).toHaveAttribute("data-focus", "thyroid");
  await page.getByRole("button", { name: "Isolate related structures", exact: true }).click();
  await expect(atlas).toHaveAttribute("data-isolated", "true");
  await page.getByRole("button", { name: "Reset body view", exact: true }).click();
  await expect(atlas).toHaveAttribute("data-focus", "whole-body");
  await expect(atlas).toHaveAttribute("data-isolated", "false");
  await page.getByRole("button", { name: "Show Unmapped synthetic marker on body map", exact: true }).click();
  await expect(atlas.getByRole("button", { name: /^Focus / })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Isolate related structures", exact: true })).toBeDisabled();
});

for (const width of [320, 390, 1280]) {
  test(`lessons and atlas fit ${width}px with reduced motion`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await reportDashboard(page);
    for (const [name, kind] of [["TSH(THYROID STIMULATING HORMONE)", "thyroid"], ["Serum Bilirubin (Indirect)", "bilirubin"], ["HbA1c", "hba1c"]]) {
      await resultCard(page, name).getByRole("button", { name: "Learn & ask", exact: true }).click();
      await expect(page.locator(".result-lesson")).toHaveAttribute("data-lesson", kind);
      await expect(page.locator(".result-lesson")).toHaveAttribute("data-running", "false");
      await expect(page.getByRole("button", { name: "Reduced motion: use steps", exact: true })).toBeDisabled();
      await expectFits(page);
      await page.keyboard.press("Escape");
    }
    await expect(page.locator(".body-atlas")).toHaveAttribute("data-animating", "false");
  });
}

test("Arabic layout retains usable English teaching diagrams", async ({ page }) => {
  await demoDashboard(page);
  await page.getByRole("combobox", { name: /language/i }).selectOption("ar");
  await page.locator("article").filter({ has: page.getByRole("button", { name: "Show Hemoglobin on body map", exact: true }) }).getByRole("button").last().click();
  await expect(page.getByRole("dialog")).toHaveAttribute("dir", "rtl");
  await expect(page.locator(".result-lesson")).toHaveAttribute("dir", "ltr");
  await expect(page.locator(".result-lesson")).toHaveAttribute("lang", "en");
  await expectFits(page);
  await page.keyboard.press("Escape");
});

test("atlas stops sustained rendering when paused, offscreen or hidden", async ({ page }) => {
  await page.addInitScript(() => {
    const original = WebGL2RenderingContext.prototype.clear;
    WebGL2RenderingContext.prototype.clear = function(mask) {
      document.body.dataset.atlasClears = String(Number(document.body.dataset.atlasClears ?? 0) + 1);
      return original.call(this, mask);
    };
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await demoDashboard(page);
  const atlas = page.locator(".body-atlas");
  await atlas.scrollIntoViewIfNeeded();
  await expect(atlas.locator("canvas")).toBeVisible();
  await expect.poll(async () => Number(await page.locator("body").getAttribute("data-atlas-clears"))).toBeGreaterThan(3);
  await page.getByRole("button", { name: "Pause body animation", exact: true }).click();
  async function expectIdle() {
    await page.waitForTimeout(350);
    const before = await page.locator("body").getAttribute("data-atlas-clears");
    await page.waitForTimeout(800);
    expect(await page.locator("body").getAttribute("data-atlas-clears")).toBe(before);
  }
  await expectIdle();
  await page.getByRole("button", { name: "Play body animation", exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(atlas).toHaveAttribute("data-animating", "false");
  await expectIdle();
  await atlas.scrollIntoViewIfNeeded();
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(atlas).toHaveAttribute("data-animating", "false");
  await expectIdle();
});

test("failed atlas model keeps its educational fallback usable", async ({ page }) => {
  await page.route("**/models/bodyparts3d/human-skin.glb", (route) => route.abort());
  await demoDashboard(page);
  await page.locator(".body-atlas").scrollIntoViewIfNeeded();
  await expect(page.getByText("3D view unavailable", { exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "Related body systems", exact: true })).toContainText("Bone marrow");
});
