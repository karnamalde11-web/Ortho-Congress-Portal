import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  run: vi.fn<
    (command: string, args: string[], options: object) => { status: number }
  >(() => ({ status: 0 })),
  find: vi.fn(),
  create: vi.fn(),
  disconnect: vi.fn(),
  query: vi.fn(async () => [{ name: "Booking" }]),
  bookingFind: vi.fn(async () => [{ id: "existing-booking" }]),
  itemFind: vi.fn(async () => [{ id: "existing-item" }]),
  count: vi.fn(async () => 1),
  productCount: vi.fn(async () => 0),
  audit: vi.fn(),
  hash: vi.fn(async () => "hashed-password"),
}));
vi.mock("node:child_process", () => ({ spawnSync: mocks.run }));
vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    admin = { findUnique: mocks.find, create: mocks.create };
    $disconnect = mocks.disconnect;
    $queryRaw = mocks.query;
    booking = { findMany: mocks.bookingFind, count: mocks.count };
    bookingItem = { findMany: mocks.itemFind, count: mocks.count };
    product = { count: mocks.productCount };
    auditLog = { create: mocks.audit };
  },
}));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: class {} }));
vi.mock("bcryptjs", () => ({ hash: mocks.hash }));
import { productionSetup } from "../scripts/production-setup.mjs";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
function settings() {
  vi.stubEnv("DATABASE_URL", "postgresql://test/test");
  vi.stubEnv("APP_URL", "https://example.invalid");
  vi.stubEnv("S3_ENDPOINT", "https://storage.example.invalid");
  vi.stubEnv("S3_BUCKET", "test-bucket");
  vi.stubEnv("S3_ACCESS_KEY_ID", "test-only-key");
  vi.stubEnv("S3_SECRET_ACCESS_KEY", "test-only-secret");
  vi.stubEnv("INITIALIZE_CATALOGUE", "false");
  vi.stubEnv("INITIALIZE_ADMIN", "false");
}
describe("Railway setup", () => {
  it("leaves an existing live catalogue unchanged even if its initial setup flag remains enabled", async () => {
    settings();
    vi.stubEnv("INITIALIZE_CATALOGUE", "true");
    mocks.productCount.mockResolvedValueOnce(220);
    await productionSetup();
    expect(mocks.run).toHaveBeenCalledTimes(1);
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "CUSTOMER_DETAILS_MIGRATION" }),
      }),
    );
  });
  it("refuses startup if an existing booking or item is missing after migration", async () => {
    settings();
    mocks.count.mockResolvedValueOnce(0);
    await expect(productionSetup()).rejects.toThrow(
      "preservation check failed",
    );
    expect(mocks.audit).not.toHaveBeenCalled();
    expect(mocks.disconnect).toHaveBeenCalled();
  });
  it("fails safely when migration execution fails", async () => {
    settings();
    mocks.run.mockReturnValueOnce({ status: 1 });
    await expect(productionSetup()).rejects.toThrow(
      "Deployment setup step failed",
    );
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("runs only migrations on an ordinary redeployment", async () => {
    settings();
    await productionSetup();
    expect(mocks.run).toHaveBeenCalledTimes(1);
    expect(mocks.run.mock.calls[0][1]).toEqual(["run", "db:migrate"]);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("imports and verifies the catalogue only when explicitly enabled", async () => {
    settings();
    vi.stubEnv("INITIALIZE_CATALOGUE", "true");
    await productionSetup();
    expect(mocks.run.mock.calls.map((c) => c[1])).toEqual([
      ["run", "db:migrate"],
      ["run", "catalogue:import"],
      ["run", "catalogue:verify"],
    ]);
  });
  it("does not replace an existing admin password on restart", async () => {
    settings();
    vi.stubEnv("INITIALIZE_ADMIN", "true");
    vi.stubEnv("ADMIN_EMAIL", "admin@example.invalid");
    mocks.find.mockResolvedValueOnce({ id: "existing" });
    await productionSetup();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.hash).not.toHaveBeenCalled();
  });
  it("creates a new admin using a hashed password", async () => {
    settings();
    vi.stubEnv("INITIALIZE_ADMIN", "true");
    vi.stubEnv("ADMIN_EMAIL", "Admin@example.invalid");
    vi.stubEnv("ADMIN_PASSWORD", "development-test-password");
    mocks.find.mockResolvedValueOnce(null);
    await productionSetup();
    expect(mocks.hash).toHaveBeenCalledWith("development-test-password", 12);
    expect(mocks.create).toHaveBeenCalledWith({
      data: { email: "admin@example.invalid", passwordHash: "hashed-password" },
    });
  });
  it("refuses a weak password and invalid setup flags", async () => {
    settings();
    vi.stubEnv("INITIALIZE_ADMIN", "true");
    vi.stubEnv("ADMIN_EMAIL", "admin@example.invalid");
    vi.stubEnv("ADMIN_PASSWORD", "short");
    mocks.find.mockResolvedValueOnce(null);
    await expect(productionSetup()).rejects.toThrow("14 characters");
    expect(mocks.create).not.toHaveBeenCalled();
    vi.stubEnv("INITIALIZE_ADMIN", "yes");
    await expect(productionSetup()).rejects.toThrow("true or false");
  });
});
