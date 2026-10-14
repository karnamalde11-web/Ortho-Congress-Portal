import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
test("real catalogue, categories, CFA prices, corrected images and a central sample booking", async ({
  page,
}) => {
  await page.goto("/");
  for (const category of [
    "Instruments",
    "Arthroscopy",
    "Instrument Set",
    "Consumables",
    "Equipments",
    "Trauma Implants",
  ])
    await expect(
      page
        .getByLabel("Category")
        .getByRole("option", { name: category, exact: true }),
    ).toHaveCount(1);
  for (const [category, code] of [
    ["Instruments", "INS-001"],
    ["Consumables", "CON-001"],
    ["Equipments", "EQP-001"],
    ["Instrument Set", "SET-004"],
    ["Trauma Implants", "TI-049"],
    ["Trauma Implants", "TI-050"],
  ] as const) {
    await page.getByLabel("Category").selectOption(category);
    await page.getByLabel("Search products").fill(code);
    const card = page.locator("article");
    await expect(card).toHaveCount(1);
    await expect(card).toContainText(code);
    await expect(card).toContainText(category);
    await expect
      .poll(() =>
        card
          .locator("img")
          .evaluate((img: HTMLImageElement) => img.naturalWidth),
      )
      .toBeGreaterThan(0);
    if (code === "SET-004") await expect(card).toContainText("1,750,000 CFA");
  }
  await page.getByLabel("Category").selectOption("Arthroscopy");
  await page.getByLabel("Search products").fill("AR-006");
  await expect(page.locator("article")).toContainText(
    "Endo Button Continous Loop 40 mm",
  );
  await expect(page.locator("article")).toContainText("Price on Request");
  await page.getByLabel("Quantity").fill("1");
  await page.getByLabel("Category").selectOption("Instruments");
  await page
    .getByLabel("Search products")
    .fill("Cannulated Screw Driver 3.5 mm");
  await expect(page.locator("article")).toHaveCount(1);
  await expect(page.locator("article")).toContainText("INS-001");
  await expect(page.locator("article")).toContainText("8,000 CFA");
  await page.getByLabel("Quantity").fill("2");
  const cart = page.locator("#pre-booking");
  await expect(cart).toContainText("Priced subtotal: 16,000 CFA");
  await expect(cart).toContainText("Full total on request");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("Name *").fill("Dr Catalogue Verification");
  await page.getByLabel("WhatsApp country code *", { exact: true }).fill("+1");
  await page
    .getByLabel("WhatsApp phone number *", { exact: true })
    .fill("2025550123");
  await page
    .getByLabel("Hospital / Clinic *")
    .fill("Catalogue verification sample");
  await page
    .getByLabel("Remarks (optional)")
    .fill(
      "SAMPLE ONLY — do not contact or fulfil. Catalogue integration verification.",
    );
  await page
    .getByLabel("Specialty *", { exact: true })
    .selectOption("Orthopaedic Surgeon");
  await page.getByLabel("City *", { exact: true }).fill("London");
  await page
    .getByLabel("Country *", { exact: true })
    .selectOption("United Kingdom");
  await page.getByLabel("WhatsApp country code *", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Submit pre-booking" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Pre-booking submitted successfully",
  );
  const id = await page.getByRole("status").locator("dd").first().innerText();
  await page.goto("/admin/login");
  await page.getByLabel("Email", { exact: true }).fill("smoke@example.invalid");
  await page.getByLabel("Password").fill("development-only-smoke-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Exhibition dashboard" }),
  ).toBeVisible();
  await page
    .getByRole("table", { name: "Pre-bookings", exact: true })
    .getByRole("row")
    .filter({ hasText: id })
    .getByRole("link", { name: /^View / })
    .click();
  const sample = page.locator("article").filter({ hasText: id });
  await expect(sample).toContainText("INS-001");
  await expect(sample).toContainText("AR-006");
  await expect(sample).toContainText("Price on Request");
  await expect(sample).toContainText("Priced subtotal: $26");
  await expect(sample).toContainText("Display CurrencyUSD");
  await expect(sample).toContainText("SAMPLE ONLY");
  await writeFile(
    "/tmp/ortho-new-sample-prebooking.json",
    JSON.stringify(
      {
        id,
        doctorName: "Dr Catalogue Verification",
        sampleOnly: true,
        currency: "USD",
        pricedSubtotalDisplay: "26.00",
        pricedSubtotalCfa: "16000.00",
        totalCfa: null,
        items: [
          { code: "INS-001", quantity: 2, unitPriceCfa: "8000.00" },
          { code: "AR-006", quantity: 1, unitPriceCfa: null },
        ],
        verifiedInAdmin: true,
      },
      null,
      2,
    ) + "\n",
  );
  await page.screenshot({ path: "/tmp/ortho-real-admin.png", fullPage: true });
  await page.getByRole("button", { name: "Sign out" }).click();
});
