import { test, expect } from "@playwright/test";
test("mobile catalogue, real pre-booking, secure admin and central status", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "NM Ortho Pricing & Pre-Booking Portal",
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("Search products").fill("SMOKE-001");
  await page.getByLabel("Quantity").fill("2");
  await page.getByLabel("Name *").fill("Dr Smoke Test");
  await page.getByLabel("WhatsApp country code *", { exact: true }).fill("+1");
  await page
    .getByLabel("WhatsApp phone number *", { exact: true })
    .fill("2025550123");
  await page.getByLabel("Hospital / Clinic *").fill("Smoke test clinic");
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
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.getByLabel("Email", { exact: true }).fill("smoke@example.invalid");
  await page.getByLabel("Password").fill("development-only-smoke-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Exhibition dashboard" }),
  ).toBeVisible();
  const legacy = page.locator("article").filter({ hasText: "Dr Legacy Smoke" });
  await expect(legacy).toContainText("9876543210");
  await expect(legacy).toContainText("Not recorded (earlier booking)");
  await expect(legacy).toContainText("12,345 CFA");
  const booking = page
    .locator("article")
    .filter({ hasText: "Dr Smoke Test" })
    .first();
  await expect(booking).toContainText("24,690 CFA");
  await expect(booking).toContainText("SMOKE-001");
  await booking.getByLabel("Booking status").selectOption("CONFIRMED");
  await booking.getByRole("button", { name: "Update", exact: true }).click();
  await expect(booking.getByLabel("Booking status")).toHaveValue("CONFIRMED");
  const cookie = (await page.context().cookies()).find(
    (c) => c.name === "ortho_session",
  );
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.secure).toBe(true);
  expect(cookie?.sameSite).toBe("Strict");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
});
test("rejects forged prices, cross-origin submissions and unauthenticated imports", async ({
  request,
}) => {
  const r = await request.post("/api/bookings", {
    headers: { Origin: "http://localhost:3000" },
    data: {
      requestKey: crypto.randomUUID(),
      doctorName: "Doctor",
      phoneCountryCode: "+221",
      phoneNationalNumber: "771234567",
      specialty: "Trauma Surgeon",
      city: "Dakar",
      country: "Senegal",
      hospital: "Clinic",
      items: [{ productId: "forged", quantity: 1, priceCfa: 1 }],
    },
  });
  expect(r.status()).toBe(400);
  const cross = await request.post("/api/bookings", {
    headers: { Origin: "https://attacker.invalid" },
    data: {},
  });
  expect(cross.status()).toBe(400);
  const imp = await request.post("/api/admin/import", {
    headers: { Origin: "http://localhost:3000" },
  });
  expect(imp.status()).toBe(401);
});
test("admin imports Excel and ZIP and catalogue loads a stored image", async ({
  page,
}) => {
  const ExcelJS = (await import("exceljs")).default;
  const AdmZip = (await import("adm-zip")).default;
  const sharp = (await import("sharp")).default;
  await page.goto("/admin/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill("smoke-import@example.invalid");
  await page.getByLabel("Password").fill("development-only-smoke-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Exhibition dashboard" }),
  ).toBeVisible();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Products");
  sheet.addRow(["SKU", "Name", "Category", "Description", "Price"]);
  sheet.addRow([
    "IMPORT-SMOKE",
    "Image import test",
    "Test instruments",
    "Development fixture",
    99.5,
  ]);
  await page.getByLabel("File", { exact: true }).setInputFiles({
    name: "catalogue.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
  });
  await page.getByRole("button", { name: "Validate and import" }).click();
  await expect(page.getByRole("status")).toContainText("Imported 1 products.");
  const zip = new AdmZip();
  zip.addFile(
    "IMPORT-SMOKE.png",
    await sharp({
      create: { width: 32, height: 32, channels: 3, background: "#086b70" },
    })
      .png()
      .toBuffer(),
  );
  await page.getByLabel("Import type").selectOption("images");
  await page.getByLabel("File", { exact: true }).setInputFiles({
    name: "images.zip",
    mimeType: "application/zip",
    buffer: zip.toBuffer(),
  });
  await page.getByRole("button", { name: "Validate and import" }).click();
  await expect(page.getByRole("status")).toContainText("Imported 1 images.");
  await page.goto("/");
  await page.getByLabel("Search products").fill("IMPORT-SMOKE");
  const img = page.getByRole("img", { name: "Image import test" });
  await expect(img).toBeVisible();
  await expect
    .poll(() =>
      img.evaluate((element: HTMLImageElement) => element.naturalWidth),
    )
    .toBe(32);
  await page.screenshot({
    path: "/tmp/ortho-mobile-catalogue.png",
    fullPage: true,
  });
});
