import "dotenv/config";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
if (
  process.env.ALLOW_TEST_SEED !== "yes" ||
  !["localhost", "127.0.0.1"].includes(
    new URL(process.env.DATABASE_URL).hostname,
  )
)
  throw new Error(
    "Smoke fixtures require explicit ALLOW_TEST_SEED=yes and a localhost development database. Never use in production.",
  );
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
try {
  await db.rateLimit.deleteMany({
    where: {
      key: `booking:${createHash("sha256").update("+12025550123").digest("hex")}`,
    },
  });
  await db.product.upsert({
    where: { code: "SMOKE-001" },
    create: {
      code: "SMOKE-001",
      name: "Test orthopaedic instrument",
      category: "Test instruments",
      description: "Development smoke-test product. Remove before launch.",
      priceCfa: 12345,
    },
    update: { priceCfa: 12345 },
  });
  const product = await db.product.findUniqueOrThrow({
    where: { code: "SMOKE-001" },
  });
  await db.booking.upsert({
    where: { requestKey: "00000000-0000-4000-8000-000000000001" },
    update: {},
    create: {
      requestKey: "00000000-0000-4000-8000-000000000001",
      doctorName: "Dr Legacy Smoke",
      phone: "9876543210",
      hospital: "Smoke test clinic",
      consentAt: new Date(),
      totalCfa: "12345.00",
      pricedSubtotalCfa: "12345.00",
      items: {
        create: [
          {
            productId: product.id,
            code: product.code,
            name: product.name,
            category: product.category,
            unitPriceCfa: "12345.00",
            quantity: 1,
          },
        ],
      },
    },
  });
  for (const email of [
    "smoke@example.invalid",
    "smoke-import@example.invalid",
  ]) {
    await db.rateLimit.deleteMany({
      where: {
        key: `login:${createHash("sha256").update(email).digest("hex")}`,
      },
    });
    await db.admin.upsert({
      where: { email },
      create: {
        email,
        passwordHash: await hash("development-only-smoke-password", 12),
      },
      update: {
        passwordHash: await hash("development-only-smoke-password", 12),
      },
    });
  }
} finally {
  await db.$disconnect();
}
