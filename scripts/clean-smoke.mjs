import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
if (
  process.env.ALLOW_TEST_SEED !== "yes" ||
  !["localhost", "127.0.0.1"].includes(
    new URL(process.env.DATABASE_URL).hostname,
  )
)
  throw new Error(
    "Cleanup requires explicit ALLOW_TEST_SEED=yes and a localhost development database.",
  );
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
try {
  const admins = await db.admin.findMany({
    where: {
      email: { in: ["smoke@example.invalid", "smoke-import@example.invalid"] },
    },
  });
  await db.$transaction(async (tx) => {
    await tx.booking.deleteMany({
      where: {
        doctorName: {
          in: [
            "Dr Smoke Test",
            "Dr Legacy Smoke",
            "Dr Mobile 375",
            "Dr Mobile 390",
            "Dr Mobile 430",
            "Dr Retry Test",
            "Dr UX Retry",
            "Dr UX POR",
          ],
        },
        hospital: "Smoke test clinic",
      },
    });
    await tx.product.deleteMany({
      where: { code: { in: ["SMOKE-001", "IMPORT-SMOKE"] } },
    });
    for (const admin of admins) {
      await tx.auditLog.deleteMany({ where: { adminId: admin.id } });
      await tx.admin.delete({ where: { id: admin.id } });
    }
  });
  console.log("Development smoke fixtures removed.");
} finally {
  await db.$disconnect();
}
