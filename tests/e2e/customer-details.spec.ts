import { test, expect } from "@playwright/test";
for (const width of [375, 390, 430]) {
  test(`required details, specialty, full WhatsApp and confirmation at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "Admin", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    const submit = page.getByRole("button", { name: "Submit pre-booking" });
    await expect(submit).toBeDisabled();
    await expect(
      page.getByLabel("WhatsApp country code *", { exact: true }),
    ).toHaveValue("+221");
    await page.getByLabel("Name *", { exact: true }).fill(`Dr Mobile ${width}`);
    await page.getByLabel("Specialty *", { exact: true }).selectOption("Other");
    await page
      .getByLabel("Hospital / Clinic *", { exact: true })
      .fill("Smoke test clinic");
    await page.getByLabel("City *", { exact: true }).fill("Dakar");
    await page.getByLabel("Country *", { exact: true }).fill("Senegal");
    await page
      .getByLabel("WhatsApp phone number *", { exact: true })
      .fill("771234567");
    await page.getByLabel("Search products").fill("SMOKE-001");
    await page.getByLabel("Quantity to reserve").fill("1");
    await expect(submit).toBeDisabled(); // Other requires its own description.
    await page
      .getByLabel("Your specialty *", { exact: true })
      .fill("Medical researcher");
    await expect(submit).toBeEnabled(); // Optional email and remarks remain empty.
    await page.getByLabel("Email (optional)").fill("invalid");
    await expect(submit).toBeDisabled();
    await page.getByLabel("Email (optional)").fill("");
    await page.getByLabel("City *", { exact: true }).fill(" ");
    await expect(submit).toBeDisabled();
    await page.getByLabel("City *", { exact: true }).fill("Dakar");
    await page
      .getByLabel("WhatsApp country code *", { exact: true })
      .fill("+1");
    await page
      .getByLabel("WhatsApp phone number *", { exact: true })
      .fill("2025550123");
    const code = await page
      .getByLabel("WhatsApp country code *", { exact: true })
      .boundingBox();
    const number = await page
      .getByLabel("WhatsApp phone number *", { exact: true })
      .boundingBox();
    expect(code!.y).toBe(number!.y);
    expect(number!.width).toBeGreaterThan(130);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `/tmp/ortho-form-${width}.png`,
      fullPage: true,
    });
    await submit.click();
    await expect(
      page.getByRole("heading", { name: "Pre-booking submitted successfully" }),
    ).toBeVisible();
    const confirmation = page.getByRole("status");
    await expect(confirmation).toContainText(`Dr Mobile ${width}`);
    await expect(confirmation.locator("dd").nth(2)).toHaveText("1");
    await expect(confirmation.locator("dd").nth(3)).toHaveText("No");
    const reference = await confirmation.locator("dd").first().innerText();
    expect(reference).toMatch(/^NM-2026-.+/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `/tmp/ortho-confirmation-${width}.png`,
      fullPage: true,
    });
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
    await page
      .getByLabel("Email", { exact: true })
      .fill("smoke@example.invalid");
    await page.getByLabel("Password").fill("development-only-smoke-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const booking = page.locator("article").filter({ hasText: reference });
    await expect(booking).toContainText("Other: Medical researcher");
    await expect(booking).toContainText("Dakar");
    await expect(booking).toContainText("Senegal");
    await expect(booking).toContainText("+12025550123");
    await expect(booking).toContainText("Not provided");
    await expect(booking).toContainText("12,345 CFA");
    await page.getByRole("button", { name: "Sign out" }).click();
  });
}
test("server rejects missing required fields and idempotent retries keep one booking", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByLabel("Search products").fill("SMOKE-001");
  const html = await page.content();
  const productId = html.match(
    /\\"id\\":\\"([^"\\]+)\\",\\"code\\":\\"SMOKE-001/,
  )?.[1];
  expect(productId).toBeTruthy();
  const payload = {
    requestKey: crypto.randomUUID(),
    doctorName: "Dr Retry Test",
    specialty: "Distributor",
    hospital: "Smoke test clinic",
    city: "Dakar",
    country: "Senegal",
    phoneCountryCode: "+1",
    phoneNationalNumber: "2025550123",
    items: [{ productId, quantity: 1 }],
  };
  for (const field of [
    "doctorName",
    "specialty",
    "hospital",
    "city",
    "country",
    "phoneCountryCode",
    "phoneNationalNumber",
  ]) {
    const invalid = await request.post("/api/bookings", {
      headers: { Origin: "http://localhost:3000" },
      data: { ...payload, [field]: "" },
    });
    expect(invalid.status()).toBe(400);
  }
  const first = await request.post("/api/bookings", {
    headers: { Origin: "http://localhost:3000" },
    data: payload,
  });
  expect(first.status()).toBe(201);
  const retry = await request.post("/api/bookings", {
    headers: { Origin: "http://localhost:3000" },
    data: payload,
  });
  expect(retry.status()).toBe(201);
  expect(await retry.json()).toEqual(await first.json());
});
