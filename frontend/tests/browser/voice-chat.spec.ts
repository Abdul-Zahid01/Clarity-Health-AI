import { test, expect, reportDashboard, mockVoice, speechEvent, expectFits, resultCard } from "./fixtures";

async function openVoice(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Ask report", exact: true }).click();
  await page.getByRole("button", { name: "Research / RAG", exact: true }).click();
  await page.getByText("Voice options / en-US", { exact: true }).click();
}

test("voice has explicit consent, interim transcript, manual send, local playback and mute", async ({ page }) => {
  await mockVoice(page);
  await reportDashboard(page);
  let calls = 0;
  await page.route("**/api/rag/ask", (route) => {
    calls++;
    return route.fulfill({ json: { answer: "Synthetic grounded explanation of the confirmed result.", safety_note: "Educational information only.", suggested_questions: [], sources: [{ source_id: "R1", source_type: "report", title: "Hemoglobin", page: 1, excerpt: "Hemoglobin 11.2" }] } });
  });
  await openVoice(page);
  await expect(page.getByRole("button", { name: "Dictate question", exact: true })).toBeDisabled();
  await page.getByRole("checkbox", { name: "I understand and enable voice for this chat session.", exact: true }).check();
  await page.getByRole("button", { name: "Dictate question", exact: true }).click();
  await expect(page.locator("[data-voice-state]")).toHaveAttribute("data-voice-state", "listening");
  await speechEvent(page, "result", "Explain synthetic", false);
  await expect(page.getByText("Draft preview (not final): Explain synthetic", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Ask about your confirmed report", exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Finish dictation", exact: true }).click();
  await expect(page.locator("[data-voice-state]")).toHaveAttribute("data-voice-state", "transcribing");
  await speechEvent(page, "result", "Explain synthetic hemoglobin");
  await speechEvent(page, "end");
  await expect(page.getByRole("textbox", { name: "Ask about your confirmed report", exact: true })).toHaveValue("Explain synthetic hemoglobin");
  expect(calls).toBe(0);
  await page.getByRole("button", { name: "Send report question", exact: true }).click();
  await expect(page.getByText("Synthetic grounded explanation of the confirmed result.", { exact: true })).toBeVisible();
  expect(calls).toBe(1);
  await expect(page.getByText("Grounded sources", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Read latest answer", exact: true }).click();
  await expect(page.locator("[data-voice-state]")).toHaveAttribute("data-voice-state", "speaking");
  await expect(page.locator("body")).toHaveAttribute("data-local-voice", "true");
  await expect(page.locator("body")).toHaveAttribute("data-spoken", /Educational information only/);
  await page.getByRole("button", { name: "Mute read-aloud", exact: true }).click();
  await expect(page.getByRole("button", { name: "Read latest answer", exact: true })).toBeDisabled();
  await expect(page.locator("body")).toHaveAttribute("data-speech-cancelled", "true");
  await page.getByRole("button", { name: "Close report assistant", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ask report", exact: true })).toBeFocused();
});

test("voice errors, cancellation and hidden tab retain typing", async ({ page }) => {
  await mockVoice(page);
  await reportDashboard(page);
  await openVoice(page);
  await page.getByRole("checkbox", { name: /I understand and enable voice/ }).check();
  await page.getByRole("button", { name: "Dictate question", exact: true }).click();
  await speechEvent(page, "error", "not-allowed");
  await expect(page.getByRole("region", { name: "RAG voice options" })).toContainText(/permission was denied/);
  await page.getByRole("button", { name: "Dictate question", exact: true }).click();
  await page.getByRole("button", { name: "Cancel dictation", exact: true }).click();
  await expect(page.locator("body")).toHaveAttribute("data-microphone", "off");
  await page.getByRole("button", { name: "Dictate question", exact: true }).click();
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(page.locator("body")).toHaveAttribute("data-microphone", "off");
  await expect(page.getByRole("textbox", { name: "Ask about your confirmed report", exact: true })).toBeEnabled();
});

for (const width of [320, 390, 1280]) {
  test(`chat fits ${width}px and cancellation ignores late answers`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await reportDashboard(page);
    await page.getByRole("button", { name: "Ask report", exact: true }).click();
    let resolveResponse: (() => void) | undefined;
    const wait = new Promise<void>((resolve) => { resolveResponse = resolve; });
    let calls = 0;
    await page.route("**/api/reports/ask", async (route) => { calls++; await wait; await route.fulfill({ json: { answer: "Late answer must not appear", safety_note: "", suggested_questions: [], cited_result_names: [], references: [] } }); });
    const input = page.getByRole("textbox", { name: "Ask about your confirmed report", exact: true });
    await input.fill("Synthetic cancellation question");
    const sent = page.waitForRequest("**/api/reports/ask");
    await page.getByRole("button", { name: "Send report question", exact: true }).click();
    await sent;
    await page.getByRole("button", { name: "Stop request", exact: true }).click();
    resolveResponse?.();
    await expect(input).toHaveValue("Synthetic cancellation question");
    await expect(page.getByText("Late answer must not appear", { exact: true })).toHaveCount(0);
    expect(calls).toBe(1);
    await expectFits(page);
    await page.getByRole("button", { name: "Open chat full screen", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    await page.keyboard.press("Shift+Tab");
    expect(await page.getByRole("dialog").evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
}

test("unsupported dictation and remote-only voices never silently use a provider", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechRecognition", { value: undefined });
    Object.defineProperty(window, "webkitSpeechRecognition", { value: undefined });
    Object.defineProperty(window.speechSynthesis, "getVoices", { value: () => [{ name: "Remote only", lang: "en-US", localService: false }] });
  });
  await reportDashboard(page);
  await openVoice(page);
  await page.getByRole("checkbox", { name: /I understand and enable voice/ }).check();
  await expect(page.getByRole("button", { name: "Dictate question", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Read latest answer", exact: true })).toBeDisabled();
  await expect(page.getByText(/No local read-aloud voice/)).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Ask about your confirmed report", exact: true })).toBeEnabled();
});

test("429 and offline chat errors keep the question available for manual retry", async ({ page }) => {
  await reportDashboard(page);
  await page.getByRole("button", { name: "Ask report", exact: true }).click();
  await page.route("**/api/reports/ask", (route) => route.fulfill({ status: 429, json: { detail: "Quota reached. Please try later." } }));
  const input = page.getByRole("textbox", { name: "Ask about your confirmed report", exact: true });
  await input.fill("Synthetic retry question");
  await page.getByRole("button", { name: "Send report question", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Quota reached" })).toBeVisible();
  await expect(input).toHaveValue("Synthetic retry question");
  await page.route("**/api/reports/ask", (route) => route.abort("internetdisconnected"));
  await page.getByRole("button", { name: "Send report question", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: /fetch|network/i })).toBeVisible();
  await expect(input).toHaveValue("Synthetic retry question");
});

test("consent withdrawal, mode, close and language changes stop capture", async ({ page }) => {
  await mockVoice(page);
  for (const action of ["consent", "mode", "close", "language"]) {
    await reportDashboard(page);
    await openVoice(page);
    const consent = page.getByRole("checkbox", { name: /I understand and enable voice/ });
    await consent.check();
    await page.getByRole("button", { name: "Dictate question", exact: true }).click();
    await expect(page.locator("body")).toHaveAttribute("data-microphone", "on");
    if (action === "consent") await consent.uncheck();
    if (action === "mode") await page.getByRole("button", { name: "My report", exact: true }).click();
    if (action === "close") await page.getByRole("button", { name: "Close report assistant", exact: true }).click();
    if (action === "language") await page.getByRole("combobox", { name: /language/i }).selectOption("ar");
    await expect(page.locator("body")).toHaveAttribute("data-microphone", "off");
    await speechEvent(page, "result", "Late transcript must be ignored");
    for (const draft of await page.getByRole("textbox").all()) {
      await expect(draft).not.toHaveValue(/Late transcript must be ignored/);
    }
  }
});

test("unfinished dictation times out explicitly without sending", async ({ page }) => {
  await mockVoice(page);
  await reportDashboard(page);
  await openVoice(page);
  await page.getByRole("checkbox", { name: /I understand and enable voice/ }).check();
  await page.clock.install();
  await page.getByRole("button", { name: "Dictate question", exact: true }).click();
  await page.getByRole("button", { name: "Finish dictation", exact: true }).click();
  await page.clock.fastForward(10001);
  await expect(page.getByText(/Dictation did not finish in time/)).toBeVisible();
  await expect(page.locator("[data-voice-state]")).toHaveAttribute("data-voice-state", "error");
  await expect(page.locator("body")).toHaveAttribute("data-microphone", "off");
  await expect(page.getByRole("textbox", { name: "Ask about your confirmed report", exact: true })).toBeEnabled();
});

for (const width of [320, 390, 1280]) {
  test(`result assistant cancellation and long answers fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await reportDashboard(page);
    await resultCard(page, "Hemoglobin").getByRole("button", { name: "Learn & ask", exact: true }).click();
    let release: (() => void) | undefined;
    const wait = new Promise<void>((resolve) => { release = resolve; });
    const answer = `Synthetic teaching example. ${"Educational context with no patient-specific conclusions. ".repeat(70)}${"LongToken".repeat(70)}`;
    const response = { answer, safety_note: "Educational only.", suggested_questions: [], references: [] };
    let calls = 0;
    await page.route("**/api/results/ask", async (route) => {
      calls++;
      if (calls === 1) await wait;
      await route.fulfill({ json: response });
    });
    const input = page.getByRole("textbox", { name: "Ask a question", exact: true });
    await input.fill("Explain this synthetic result");
    const sent = page.waitForRequest("**/api/results/ask");
    await page.getByRole("button", { name: "Send question", exact: true }).click();
    expect((await sent).postDataJSON().result.review_status).toBe("confirmed");
    await page.getByRole("button", { name: "Stop request", exact: true }).click();
    release?.();
    await expect(input).toHaveValue("Explain this synthetic result");
    expect(calls).toBe(1);
    await expect(page.getByText(answer, { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Send question", exact: true }).click();
    await expect(page.getByText(answer, { exact: true })).toBeVisible();
    await expect(input).toHaveValue("");
    await expectFits(page);
    await input.scrollIntoViewIfNeeded();
    await expect(input).toBeInViewport();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
}
