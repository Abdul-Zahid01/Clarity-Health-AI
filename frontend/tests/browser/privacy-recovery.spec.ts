import { test, expect, uploadPreview, consentAndStructure, finalize } from "./fixtures";

test("privacy editing revokes confirmation; only reviewed preview is submitted", async ({ page }) => {
  await uploadPreview(page);
  const preview = page.getByRole("textbox", { name: "Cloud text / page 1", exact: true });
  expect(await preview.inputValue()).not.toContain("Synthetic Example");
  await expect(page.getByRole("button", { name: "Create review table", exact: true })).toBeDisabled();
  const privacy = page.getByRole("checkbox", { name: /I reviewed every cloud-text page/ });
  await privacy.check();
  await preview.fill((await preview.inputValue()).replace("Unmapped synthetic marker 1.1 synthetic 0.4 - 4", ""));
  await expect(privacy).not.toBeChecked();
  const request = page.waitForRequest("**/api/reports/structure");
  await consentAndStructure(page);
  const body = (await request).postData() ?? "";
  expect(body).toContain("privacy_review_confirmed");
  expect(body).not.toContain("Synthetic Example");
  expect(body).not.toContain("Unmapped synthetic marker 1.1 synthetic 0.4 - 4");
  await finalize(page);
  await expect(page.getByRole("button", { name: "Ask report", exact: true })).toBeVisible();
});

test("503 extraction failure preserves preview and does not auto-resubmit", async ({ page }) => {
  await uploadPreview(page);
  let attempts = 0;
  await page.route("**/api/reports/structure", (route) => { attempts++; return route.fulfill({ status: 502, json: { detail: "Gemini is temporarily unavailable. Please try again later." } }); });
  await consentAndStructure(page);
  await expect(page.getByRole("alert").filter({ hasText: "temporarily unavailable" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Cloud text / page 1", exact: true })).toHaveValue(/Hemoglobin/);
  await expect(page.getByRole("button", { name: "Create review table", exact: true })).toBeEnabled();
  expect(attempts).toBe(1);
});

test("invalid upload surfaces failure and allows choosing another file", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Choose PDF report", { exact: true }).setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("synthetic") });
  await expect(page.getByRole("alert").filter({ hasText: /PDF/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose PDF", exact: true })).toBeEnabled();
});

test("nearby-care location denial is explicit without sending coordinates", async ({ page, context }) => {
  await context.clearPermissions();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition(_success: unknown, failure: (error: { code: number }) => void) { failure({ code: 1 }); } } });
  });
  let outbound = 0;
  await page.route("https://**/*", (route) => { outbound++; return route.abort(); });
  await page.goto("/nearby-care");
  await expect(page.getByText(/Location access is needed/).first()).toBeVisible();
  expect(outbound).toBe(0);
});

test("nearby-care service failure is visible instead of a fabricated facility list", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 0, longitude: 0 });
  await page.route("https://**/*", (route) => route.abort());
  await page.goto("/nearby-care");
  await expect(page.getByText(/Nearby facilities could not be loaded/).first()).toBeVisible();
});
