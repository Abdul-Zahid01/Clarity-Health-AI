import { expect, test as base, type Page } from "@playwright/test";
import { createDemoReport } from "../../src/lib/demo-report";

export const test = base.extend({
  page: async ({ page }, runTest) => {
    await page.route("**/api/**", (route) => route.abort("blockedbyclient"));
    await runTest(page);
  },
});
export { expect };

export const syntheticReport = () => {
  const report = createDemoReport();
  const template = report.results[0];
  report.results.push(...["TSH(THYROID STIMULATING HORMONE)", "Serum Bilirubin (Indirect)", "HbA1c", "Unmapped synthetic marker"].map((name) => ({
    ...template, name, value_numeric: 1.1, reference_min: 0.4, reference_max: 4,
    unit: "synthetic", calculated_status: "normal" as const, source_text: `${name} 1.1 synthetic 0.4 - 4`,
  })));
  return report;
};

export async function demoDashboard(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore a synthetic demo", exact: true }).click();
  await finalize(page);
}

export async function finalize(page: Page) {
  await page.getByRole("button", { name: "Confirm all", exact: true }).click();
  await page.getByRole("button", { name: "Finalize review", exact: true }).click();
}

export async function uploadPreview(page: Page) {
  const report = syntheticReport();
  const text = report.results.map((result) => result.source_text).join("\n");
  await page.route("**/api/reports/extract", (route) => route.fulfill({ json: {
    filename: "synthetic-browser.pdf", page_count: 1,
    pages: [{ page_number: 1, text: `Patient: Synthetic Example\n${text}`, extraction_method: "native", needs_review: false }],
    cloud_pages: [{ page_number: 1, text, extraction_method: "native", needs_review: false }],
    privacy_removed_lines: 1, warnings: [],
  } }));
  await page.route("**/api/reports/structure", (route) => route.fulfill({ json: report }));
  await page.goto("/");
  await page.getByLabel("Choose PDF report", { exact: true }).setInputFiles({
    name: "synthetic-browser.pdf", mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 synthetic browser fixture; extraction response is mocked"),
  });
  await expect(page.getByRole("region", { name: "Cloud text privacy preview" })).toBeVisible();
}

export async function consentAndStructure(page: Page) {
  await page.getByRole("checkbox", { name: /I reviewed every cloud-text page/ }).check();
  await page.getByRole("checkbox", { name: /I confirm this report is synthetic/ }).check();
  await page.getByRole("button", { name: "Create review table", exact: true }).click();
}

export async function reportDashboard(page: Page) {
  await uploadPreview(page);
  await consentAndStructure(page);
  await finalize(page);
}

export function resultCard(page: Page, name: string) {
  return page.locator("article").filter({ has: page.getByRole("button", { name: `Show ${name} on body map`, exact: true }) });
}

export async function expectFits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const selector of ['[role="dialog"]', ".result-lesson", ".report-chat"]) {
    for (const element of await page.locator(selector).all()) {
      expect(await element.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    }
  }
}

export async function mockVoice(page: Page) {
  await page.addInitScript(() => {
    class Recognition {
      lang = ""; continuous = false; interimResults = false; maxAlternatives = 1;
      onresult: ((event: { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[] }) => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start() { document.body.dataset.microphone = "on"; }
      stop() { document.body.dataset.microphone = "finishing"; }
      abort() { document.body.dataset.microphone = "off"; }
      constructor() {
        window.addEventListener("test:speech", (event) => {
          if (!(event instanceof CustomEvent)) return;
          const { action, text, final } = event.detail;
          if (action === "result") this.onresult?.({ resultIndex: 0, results: [{ isFinal: final, 0: { transcript: text } }] });
          if (action === "error") this.onerror?.({ error: text });
          if (action === "end") { document.body.dataset.microphone = "off"; this.onend?.(); }
        });
      }
    }
    Object.defineProperty(window, "SpeechRecognition", { value: Recognition, configurable: true });
    class Utterance {
      voice: SpeechSynthesisVoice | null = null;
      lang = ""; rate = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    }
    Object.defineProperty(window, "SpeechSynthesisUtterance", { value: Utterance, configurable: true });
    class Synthesis extends EventTarget {
      getVoices() { return [{ name: "Synthetic local voice", lang: "en-US", localService: true, default: true, voiceURI: "synthetic-local" }]; }
      speak(utterance: SpeechSynthesisUtterance) {
        document.body.dataset.spoken = utterance.text;
        document.body.dataset.localVoice = String(utterance.voice?.localService);
      }
      cancel() { document.body.dataset.speechCancelled = "true"; }
    }
    Object.defineProperty(window, "speechSynthesis", { value: new Synthesis(), configurable: true });
  });
}

export async function speechEvent(page: Page, action: string, text = "", final = true) {
  await page.evaluate((detail) => window.dispatchEvent(new CustomEvent("test:speech", { detail })), { action, text, final });
}
