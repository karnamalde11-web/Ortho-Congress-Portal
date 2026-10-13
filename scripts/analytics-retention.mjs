import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
export async function purgeExpiredAnalytics(now = new Date()) {
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const cutoff = new Date(now.getTime() - 90 * 86400000);
  try {
    await db.analyticsVisit.deleteMany({
      where: { openedAt: { lt: cutoff }, lastSeenAt: { lt: cutoff } },
    });
    await db.rateLimit.deleteMany({
      where: { key: { startsWith: "analytics:" }, windowStart: { lt: cutoff } },
    });
  } finally {
    await db.$disconnect();
  }
}
export function startAnalyticsRetention() {
  const cleanup = () =>
    purgeExpiredAnalytics().catch(() => {
      console.error("Anonymous analytics cleanup will retry later.");
    });
  void cleanup();
  const timer = setInterval(cleanup, 24 * 60 * 60 * 1000);
  timer.unref();
  return () => clearInterval(timer);
}
