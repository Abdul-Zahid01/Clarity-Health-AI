import { writeFile } from "node:fs/promises";
import { test, expect, demoDashboard, reportDashboard, mockVoice, resultCard } from "./fixtures";

test("capture synthetic visual and render-cadence evidence", async ({ page }, info) => {
  await page.addInitScript(() => {
    const times: number[] = [];
    Object.defineProperty(window, "__renderTimes", { value: times });
    Object.defineProperty(window, "__layoutShiftTotal", { value: 0, writable: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
        if (!shift.hadRecentInput) Reflect.set(window, "__layoutShiftTotal", Reflect.get(window, "__layoutShiftTotal") + shift.value);
      }
    }).observe({ type: "layout-shift", buffered: true });
    const original = WebGL2RenderingContext.prototype.clear;
    WebGL2RenderingContext.prototype.clear = function(mask) {
      times.push(performance.now());
      return original.call(this, mask);
    };
  });
  await mockVoice(page);
  await demoDashboard(page);
  const atlas = page.locator(".body-atlas");
  await atlas.scrollIntoViewIfNeeded();
  await expect(atlas.locator("canvas")).toBeVisible();
  await expect(page.getByText("Loading the local anatomy model...", { exact: true })).toHaveCount(0);
  const measurements = [];
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator(".atlas-viewport").scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const start = await page.evaluate(() => performance.now());
    await page.waitForTimeout(3000);
    const metrics = await page.evaluate((start) => {
      const times: number[] = Reflect.get(window, "__renderTimes");
      const sample = times.filter((time) => time >= start);
      const gaps = sample.slice(1).map((time, i) => time - sample[i]).sort((a, b) => a - b);
      const model = performance.getEntriesByType("resource").find((entry) => entry.name.endsWith("/human-skin.glb"));
      return { width: innerWidth, height: innerHeight, renders: sample.length, medianMs: gaps[Math.floor(gaps.length / 2)], p95Ms: gaps[Math.floor(gaps.length * 0.95)], observedCls: Reflect.get(window, "__layoutShiftTotal"), modelBytes: model instanceof PerformanceResourceTiming ? model.decodedBodySize : null };
    }, start);
    measurements.push(metrics);
    expect(metrics.width).toBe(width);
    expect(metrics.renders).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Pause body animation", exact: true }).click();
    await page.waitForTimeout(400);
    const before = await page.evaluate(() => Reflect.get(window, "__renderTimes").length);
    await page.waitForTimeout(1000);
    expect(await page.evaluate(() => Reflect.get(window, "__renderTimes").length)).toBe(before);
    await atlas.screenshot({ path: info.outputPath(`atlas-after-${width}.png`) });
    await page.getByRole("button", { name: "Play body animation", exact: true }).click();
  }
  const metricsPath = info.outputPath("render-cadence.json");
  await writeFile(metricsPath, JSON.stringify({ measurements, pausedClearsPerSecond: 0, caveat: "Headless Edge, desktop host, mobile viewport emulation; cadence, not GPU timing." }, null, 2));
  await info.attach("render-cadence.json", { path: metricsPath, contentType: "application/json" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await reportDashboard(page);
  await page.getByRole("button", { name: "Show TSH(THYROID STIMULATING HORMONE) on body map", exact: true }).click();
  await atlas.scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Pause body animation", exact: true }).click();
  await page.getByRole("button", { name: "Focus Thyroid", exact: true }).click();
  await page.getByRole("button", { name: "Isolate related structures", exact: true }).click();
  await atlas.screenshot({ path: info.outputPath("thyroid-focused.png") });
  await resultCard(page, "Serum Bilirubin (Indirect)").getByRole("button", { name: "Learn & ask", exact: true }).click();
  await page.locator(".result-lesson").screenshot({ path: info.outputPath("bilirubin-lesson.png") });
  await page.keyboard.press("Escape");
  await page.route("**/api/rag/ask", (route) => route.fulfill({ json: {
    answer: "TSH is a signal from the pituitary to the thyroid. This synthetic example illustrates what the test measures, not a diagnosis.",
    safety_note: "Educational information only. Discuss interpretation with a clinician.", suggested_questions: [],
    sources: [{ source_id: "R1", source_type: "report", title: "Synthetic TSH", page: 1, excerpt: "TSH 1.1 synthetic 0.4 - 4" }],
  } }));
  await page.getByRole("button", { name: "Ask report", exact: true }).click();
  await page.getByRole("button", { name: "Research / RAG", exact: true }).click();
  await page.getByRole("textbox", { name: "Ask about your confirmed report", exact: true }).fill("Explain this synthetic TSH example");
  await page.getByRole("button", { name: "Send report question", exact: true }).click();
  await expect(page.getByText("Grounded sources", { exact: true })).toBeVisible();
  await page.getByText("Voice options / en-US", { exact: true }).click();
  await page.getByRole("checkbox", { name: /I understand and enable voice/ }).check();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByRole("button", { name: "Read latest answer", exact: true }).scrollIntoViewIfNeeded();
    await page.locator(".report-chat").screenshot({ path: info.outputPath(`rag-voice-${width}.png`) });
  }
});
