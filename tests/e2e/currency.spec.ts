import { test, expect, type Page } from "@playwright/test";
import { publicProducts } from "./public-products";
import { COUNTRY_PRICING_POLICY } from "../../lib/pricing-policy";
async function choose(page: Page, code: string, quantity: string) {
  await page.getByLabel("Search products").fill(code);
  await expect(page.locator("article")).toHaveCount(1);
  await page.getByLabel("Quantity to reserve").fill(quantity);
}
async function details(page: Page, name: string, number: string) {
  await page.getByLabel("Name *", { exact: true }).fill(name);
  await page
    .getByLabel("Specialty *", { exact: true })
    .selectOption("Orthopaedic Surgeon");
  await page
    .getByLabel("Hospital / Clinic *", { exact: true })
    .fill("Smoke test clinic");
  await page.getByLabel("City *", { exact: true }).fill("Test city");
  await page.getByLabel("WhatsApp country code *", { exact: true }).fill("1");
  await page
    .getByLabel("WhatsApp phone number *", { exact: true })
    .fill(number);
}
test("country changes immediately update catalogue, subtotal and mobile review with no currency selector", async ({
  page,
}) => {
  await page.goto("/");
  await choose(page, "INS-001", "2");
  const card = page.locator("article");
  const summary = page.locator("#pre-booking");
  await expect(card).toContainText("8,000 CFA");
  await expect(summary).toContainText("Priced subtotal: 16,000 CFA");
  const country = page.getByLabel("Country *", { exact: true });
  for (const value of [
    "Senegal",
    "Côte d’Ivoire",
    "Mali",
    "Cameroon",
    "Benin",
    "Guinea-Bissau",
    "Republic of the Congo",
  ]) {
    await country.selectOption(value);
    await expect(card).toContainText("8,000 CFA");
    await expect(summary).toContainText("16,000 CFA");
  }
  for (const value of [
    "India",
    "Ghana",
    "Guinea",
    "DR Congo",
    "Mauritania",
    "United States",
    "Liberia",
    "United Kingdom",
    "South Africa",
  ]) {
    await country.selectOption(value);
    await expect(card.locator("p.font-bold")).toHaveText("$13");
    await expect(summary).toContainText("Priced subtotal: $26");
    await expect(
      page.getByRole("link", { name: /Review Pre-Booking/ }),
    ).toContainText("$26");
  }
  // Phone-country overrides must not change the currency selected by Country.
  await country.selectOption("Senegal");
  await page.getByLabel("WhatsApp country code *", { exact: true }).fill("91");
  await expect(card).toContainText("8,000 CFA");
  await choose(page, "AR-006", "1");
  await expect(card).toContainText("Price on Request");
  await expect(summary).toContainText("Priced subtotal: 16,000 CFA");
  await country.selectOption("India");
  await expect(card).toContainText("Price on Request");
  await expect(summary).toContainText("Priced subtotal: $26");
  await expect(summary).toContainText("Full total on request");
  await expect(page.getByRole("combobox", { name: /currency/i })).toHaveCount(
    0,
  );
  expect(await page.locator("main").innerText()).not.toMatch(
    /exchange rate|conversion rate|conversion formula|converted from|CFA\s*\/\s*625/i,
  );
});
test("CFA/USD priced, mixed and POR-only bookings save customer currency and render the same amounts in admin", async ({
  page,
}) => {
  const references: {
    name: string;
    reference: string;
    currency: string;
    subtotal: string;
    unit: string | null;
    line: string | null;
    por: boolean;
  }[] = [];
  const cases = [
    {
      name: "Dr Currency CFA",
      country: "Senegal",
      products: [["INS-001", "2"]],
      currency: "CFA",
      subtotal: "16000.00",
      formatted: "16,000 CFA",
      unit: "8,000 CFA",
      line: "16,000 CFA",
      por: false,
    },
    {
      name: "Dr Currency USD",
      country: "India",
      products: [["INS-001", "3"]],
      currency: "USD",
      subtotal: "39.00",
      formatted: "$39",
      unit: "$13",
      line: "$39",
      por: false,
    },
    {
      name: "Dr Currency Mixed",
      country: "Ghana",
      products: [
        ["INS-001", "2"],
        ["AR-006", "1"],
      ],
      currency: "USD",
      subtotal: "26.00",
      formatted: "$26",
      unit: "$13",
      line: "$26",
      por: true,
    },
    {
      name: "Dr Currency POR CFA",
      country: "Senegal",
      products: [["AR-006", "1"]],
      currency: "CFA",
      subtotal: "0.00",
      formatted: "0 CFA",
      unit: null,
      line: null,
      por: true,
    },
    {
      name: "Dr Currency POR USD",
      country: "India",
      products: [["AR-006", "1"]],
      currency: "USD",
      subtotal: "0.00",
      formatted: "$0",
      unit: null,
      line: null,
      por: true,
    },
  ];
  for (const [index, item] of cases.entries()) {
    await page.goto("/");
    await page
      .getByLabel("Country *", { exact: true })
      .selectOption(item.country);
    for (const [code, quantity] of item.products)
      await choose(page, code, quantity);
    await details(page, item.name, String(2025550130 + index));
    await expect(page.locator("#pre-booking")).toContainText(
      `Priced subtotal: ${item.formatted}`,
    );
    const responsePromise = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/bookings") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Submit pre-booking" }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(201);
    const receipt = await response.json();
    expect(receipt).toMatchObject({
      currency: item.currency,
      pricedSubtotalDisplay: item.subtotal,
      totalDisplay: item.por ? null : item.subtotal,
      hasPriceOnRequest: item.por,
      selectedProductCount: item.products.length,
    });
    await expect(page.getByRole("status")).toContainText(
      Number(item.subtotal) > 0 ? item.formatted : "Final total:On Request",
    );
    references.push({
      name: item.name,
      reference: receipt.reference,
      currency: item.currency,
      subtotal: item.formatted,
      unit: item.unit,
      line: item.line,
      por: item.por,
    });
  }
  await page.goto("/admin/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill("smoke-currency@example.invalid");
  await page.getByLabel("Password").fill("development-only-smoke-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Exhibition dashboard" }),
  ).toBeVisible();
  for (const item of references) {
    await page.goto("/admin");
    await page
      .getByRole("table", { name: "Pre-bookings", exact: true })
      .getByRole("row")
      .filter({ hasText: item.reference })
      .getByRole("link", { name: /^View / })
      .click();
    const booking = page.locator("article").filter({ hasText: item.reference });
    await expect(
      booking
        .locator("dt")
        .filter({ hasText: /^Display Currency$/ })
        .locator("..")
        .locator("dd"),
    ).toHaveText(item.currency);
    await expect(
      booking
        .locator("dt")
        .filter({ hasText: /^Displayed priced subtotal$/ })
        .locator("..")
        .locator("dd"),
    ).toHaveText(item.subtotal);
    if (item.unit)
      await expect(booking.locator("ul").first()).toContainText(
        `@ ${item.unit}`,
      );
    if (item.line)
      await expect(booking.locator("ul").first()).toContainText(
        `Line subtotal: ${item.line}`,
      );
    if (item.por) await expect(booking).toContainText("Price on Request");
  }
  await page.goto("/admin?q=Dr%20Legacy%20Smoke");
  await page
    .getByRole("link", { name: "View Dr Legacy Smoke", exact: true })
    .click();
  const legacy = page.locator("article").filter({ hasText: "Dr Legacy Smoke" });
  await expect(legacy).toContainText("India");
  await expect(legacy).toContainText("12,345 CFA");
  await expect(
    legacy
      .locator("dt")
      .filter({ hasText: /^Display Currency$/ })
      .locator("..")
      .locator("dd"),
  ).toHaveText("CFA");
  await page.getByRole("button", { name: "Sign out" }).click();
});
test("stale catalogue metadata and customer-forged currency are rejected before a booking is saved", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const product = (await publicProducts(page)).find(
    (p) => p.code === "INS-001",
  )!;
  const payload = {
    pricingPolicy: COUNTRY_PRICING_POLICY,
    requestKey: crypto.randomUUID(),
    doctorName: "Dr Currency Stale",
    specialty: "Orthopaedic Surgeon",
    hospital: "Smoke test clinic",
    city: "Test city",
    country: "India",
    phoneCountryCode: "+1",
    phoneNationalNumber: "2025550139",
    items: [
      {
        productId: product.id,
        pricingVersion: "2000-01-01T00:00:00.000Z",
        quantity: 1,
      },
    ],
  };
  const stale = await request.post("/api/bookings", {
    headers: { Origin: "http://localhost:3000" },
    data: payload,
  });
  expect(stale.status()).toBe(400);
  expect((await stale.json()).error).toContain("refresh the catalogue");
  for (const currency of ["CFA", "USD"]) {
    const forged = await request.post("/api/bookings", {
      headers: { Origin: "http://localhost:3000" },
      data: {
        ...payload,
        currency,
        items: [
          {
            productId: product.id,
            pricingVersion: product.pricingVersion,
            quantity: 1,
          },
        ],
      },
    });
    expect(forged.status()).toBe(400);
  }
  const oldPage = await request.post("/api/bookings", {
    headers: { Origin: "http://localhost:3000" },
    data: { ...payload, pricingPolicy: undefined },
  });
  expect(oldPage.status()).toBe(400);
  expect((await oldPage.json()).error).toContain("refresh the catalogue");
});
