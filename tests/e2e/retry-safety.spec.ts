import "dotenv/config";
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { publicProducts } from "./public-products";
const database = process.env.DATABASE_URL!;
const base = process.env.APP_URL ?? "http://localhost:3000";
if (
  !["localhost", "127.0.0.1"].includes(new URL(database).hostname) ||
  !["localhost", "127.0.0.1"].includes(new URL(base).hostname)
)
  throw new Error("Retry fixtures require localhost development only.");
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: database }),
});
test.afterAll(() => db.$disconnect());
test("simultaneous retries all receive the same successful receipt, preserve one booking and reload creates none", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const product = (await publicProducts(page)).find(
    (p) => p.code === "INS-001",
  )!;
  const requestKey = crypto.randomUUID();
  const data = {
    requestKey,
    pricingPolicy: "country-pricing-v1",
    doctorName: "Dr Retry Test",
    specialty: "Other",
    specialtyOther: "Development audit",
    hospital: "Smoke test clinic",
    city: "Test",
    country: "Senegal",
    phoneCountryCode: "+1",
    phoneNationalNumber: "2025550186",
    items: [
      {
        productId: product.id,
        pricingVersion: product.pricingVersion,
        quantity: 1,
      },
    ],
  };
  const responses = await Promise.all(
    Array.from({ length: 5 }, () =>
      request.post("/api/bookings", {
        headers: { Origin: base, DNT: "1" },
        data,
      }),
    ),
  );
  for (const response of responses) expect(response.status()).toBe(201);
  const receipts = await Promise.all(responses.map((r) => r.json()));
  expect(new Set(receipts.map((r) => r.id)).size).toBe(1);
  expect(await db.booking.count({ where: { requestKey } })).toBe(1);
  expect(
    await db.bookingItem.count({ where: { booking: { requestKey } } }),
  ).toBe(1);
  await page.reload();
  expect(await db.booking.count({ where: { requestKey } })).toBe(1);
});
