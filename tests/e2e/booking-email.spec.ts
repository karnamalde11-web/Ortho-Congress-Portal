import "dotenv/config";
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { publicProducts } from "./public-products";
const base = process.env.APP_URL || "http://localhost:3000";
if (
  !["localhost", "127.0.0.1"].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  ) ||
  !["localhost", "127.0.0.1"].includes(new URL(base).hostname)
)
  throw new Error("Email integration fixtures are localhost only.");
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
test.afterAll(() => db.$disconnect());
test("a booking and repeated retry save one alert without needing an email provider; alerts are private", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const product = (await publicProducts(page)).find(
    (p) => p.code === "AR-006",
  )!;
  const data = {
    requestKey: crypto.randomUUID(),
    pricingPolicy: "country-pricing-v1",
    doctorName: "Dr Email Alert Test",
    specialty: "Other",
    specialtyOther: "Local test",
    hospital: "Smoke test clinic",
    city: "Test",
    country: "Senegal",
    phoneCountryCode: "+1",
    phoneNationalNumber: "2025550187",
    items: [
      {
        productId: product.id,
        pricingVersion: product.pricingVersion,
        quantity: 1,
      },
    ],
  };
  const first = await request.post("/api/bookings", {
    headers: { Origin: base, DNT: "1" },
    data,
  });
  expect(first.status()).toBe(201);
  const receipt = await first.json();
  expect(receipt.hasPriceOnRequest).toBe(true);
  expect(receipt).not.toHaveProperty("bookingEmail");
  expect(receipt).not.toHaveProperty("payload");
  const second = await request.post("/api/bookings", {
    headers: { Origin: base, DNT: "1" },
    data,
  });
  expect(second.status()).toBe(201);
  expect((await second.json()).id).toBe(receipt.id);
  expect(
    await db.bookingEmail.count({ where: { bookingId: receipt.id } }),
  ).toBe(1);
  expect(
    (await db.bookingEmail.findUnique({ where: { bookingId: receipt.id } }))
      ?.status,
  ).toBe("PENDING");
  await page.goto("/admin/notifications");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page
    .getByLabel("Email", { exact: true })
    .fill("smoke-notifications@example.invalid");
  await page.getByLabel("Password").fill("development-only-smoke-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("link", { name: "Email alerts", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Email alerts", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("table", { name: "Booking email alerts" }),
  ).toContainText("Dr Email Alert Test");
  await expect(
    page.getByRole("table", { name: "Booking email alerts" }),
  ).toContainText("Queued / retrying");
});
