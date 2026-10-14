import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ clients: vi.fn(), adapters: vi.fn() }));
vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    constructor(options: unknown) {
      mocks.clients(options);
    }
  },
}));
vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: class {
    constructor(options: unknown) {
      mocks.adapters(options);
    }
  },
}));
const globals = globalThis as unknown as { prisma?: unknown };
const previous = globals.prisma;
afterEach(() => {
  globals.prisma = previous;
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it("reuses one bounded pool when production route modules are reloaded", async () => {
  delete globals.prisma;
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("DATABASE_URL", "postgresql://development-only@localhost/test");
  vi.resetModules();
  const first = await import("../lib/db");
  vi.resetModules();
  const second = await import("../lib/db");
  expect(second.db).toBe(first.db);
  expect(mocks.clients).toHaveBeenCalledTimes(1);
  expect(mocks.adapters).toHaveBeenCalledWith({
    connectionString: "postgresql://development-only@localhost/test",
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    application_name: "ortho-portal",
  });
});
