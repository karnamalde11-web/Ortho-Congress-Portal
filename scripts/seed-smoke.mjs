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
      key: `login:${createHash("sha256").update("smoke@example.invalid").digest("hex")}`,
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
  await db.admin.upsert({
    where: { email: "smoke@example.invalid" },
    create: {
      email: "smoke@example.invalid",
      passwordHash: await hash("development-only-smoke-password", 12),
    },
    update: { passwordHash: await hash("development-only-smoke-password", 12) },
  });
} finally {
  await db.$disconnect();
}
