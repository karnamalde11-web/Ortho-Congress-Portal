import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  cookies: new Map<string, string>(),
  headers: new Map<string, string>(),
  admin: vi.fn(),
  visitsDelete: vi.fn(),
  ratesDelete: vi.fn(),
  disconnect: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      mocks.cookies.has(name) ? { value: mocks.cookies.get(name) } : undefined,
  }),
  headers: async () => ({
    get: (name: string) => mocks.headers.get(name) ?? null,
  }),
}));
vi.mock("../lib/db", () => ({
  db: {
    analyticsVisit: { deleteMany: mocks.visitsDelete },
    rateLimit: { deleteMany: mocks.ratesDelete },
    $transaction: mocks.transaction,
  },
}));
vi.mock("../lib/security", () => ({
  requireAdmin: mocks.admin,
  hash: () => "anonymous-test-hash",
  rateLimit: vi.fn(),
}));
vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    analyticsVisit = { deleteMany: mocks.visitsDelete };
    rateLimit = { deleteMany: mocks.ratesDelete };
    $disconnect = mocks.disconnect;
  },
}));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: class {} }));
import {
  analyticsExcluded,
  recordAnalyticsSubmission,
  safeReferrer,
} from "../lib/analytics-server";
import { purgeExpiredAnalytics } from "../scripts/analytics-retention.mjs";
afterEach(() => {
  mocks.cookies.clear();
  mocks.headers.clear();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
describe("analytics privacy and reliability", () => {
  it("honors opt-out, DNT and GPC without requiring an anonymous visitor to log in", async () => {
    expect(await analyticsExcluded()).toBe(false);
    mocks.headers.set("dnt", "1");
    expect(await analyticsExcluded()).toBe(true);
    mocks.headers.clear();
    mocks.headers.set("sec-gpc", "1");
    expect(await analyticsExcluded()).toBe(true);
    mocks.headers.clear();
    mocks.cookies.set("nm_analytics_opt_out", "1");
    expect(await analyticsExcluded()).toBe(true);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("excludes authenticated staff, but an expired admin cookie does not identify an anonymous visitor", async () => {
    mocks.cookies.set("ortho_session", "test-only");
    mocks.admin.mockResolvedValueOnce({ id: "admin" });
    expect(await analyticsExcluded()).toBe(true);
    mocks.admin.mockRejectedValueOnce(new Error("expired"));
    expect(await analyticsExcluded()).toBe(false);
  });
  it("retains only registrable referral domains, with no IPs, URL paths or own-domain referrals", () => {
    vi.stubEnv("APP_URL", "https://portal.example.com");
    expect(safeReferrer("www.google.com")).toBe("google.com");
    expect(safeReferrer("private-subdomain.example.co.uk")).toBe(
      "example.co.uk",
    );
    for (const value of [
      "192.168.1.1",
      "person@example.com",
      "example.com/private",
      "https://example.org/query",
      "www.example.com",
    ])
      expect(safeReferrer(value)).toBeNull();
  });
  it("cleans only old anonymous visit data and its rate limits, never actual reservations", async () => {
    const now = new Date("2026-10-13T12:00:00Z");
    await purgeExpiredAnalytics(now);
    const cutoff = new Date(now.getTime() - 90 * 86400000);
    expect(mocks.visitsDelete).toHaveBeenCalledWith({
      where: { openedAt: { lt: cutoff }, lastSeenAt: { lt: cutoff } },
    });
    expect(mocks.ratesDelete).toHaveBeenCalledWith({
      where: { key: { startsWith: "analytics:" }, windowStart: { lt: cutoff } },
    });
    expect(mocks.disconnect).toHaveBeenCalled();
  });
  it("does not propagate an analytics database failure after a booking succeeds", async () => {
    mocks.cookies.set("nm_visitor", "11111111-1111-4111-8111-111111111111");
    mocks.cookies.set("nm_visit", "22222222-2222-4222-8222-222222222222");
    mocks.transaction.mockRejectedValueOnce(new Error("analytics unavailable"));
    await expect(
      recordAnalyticsSubmission({
        id: "existing-booking",
        country: "Senegal",
        createdAt: new Date(),
      }),
    ).resolves.toBeUndefined();
  });
});
