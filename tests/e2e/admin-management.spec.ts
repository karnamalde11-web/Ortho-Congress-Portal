import "dotenv/config";
import { test, expect, type Page, type Cookie } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import ExcelJS from "exceljs";
import { bookingStatuses } from "../../lib/booking-filters";
import { bookingReference } from "../../lib/booking-reference";
const url = process.env.DATABASE_URL!;
if (
  !["localhost", "127.0.0.1"].includes(new URL(url).hostname) ||
  !["localhost", "127.0.0.1"].includes(
    new URL(process.env.APP_URL ?? "http://localhost:3000").hostname,
  )
)
  throw new Error(
    "Admin management fixtures require local development services.",
  );
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});
let cookies: Cookie[] = [];
let fixtures: Awaited<ReturnType<typeof db.booking.findMany>> = [];
const fixtureWhere = {
  hospital: "Admin management test clinic",
  requestKey: { startsWith: "management-fixture-" },
};
const query = "Admin Management";
const table = (page: Page) =>
  page.getByRole("table", { name: "Pre-bookings", exact: true });
const rows = (page: Page) => table(page).locator("tbody tr");
async function filtered(page: Page, extra: Record<string, string> = {}) {
  await page.goto(`/admin?${new URLSearchParams({ q: query, ...extra })}`);
}
function readCsv(value: string) {
  const result: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  value = value.replace(/^\uFEFF/, "");
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === '"') {
      if (quoted && value[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" && !quoted) {
      row.push(cell.replace(/\r$/, ""));
      result.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  return result;
}
test.beforeAll(async ({ browser }) => {
  await db.booking.deleteMany({ where: fixtureWhere });
  const product = await db.product.findUniqueOrThrow({
    where: { code: "INS-001" },
  });
  const por = await db.product.findUniqueOrThrow({ where: { code: "AR-006" } });
  for (let i = 0; i < 32; i++) {
    const quantity = (i % 3) + 1;
    const hasPor = i % 5 === 0;
    const usd = i % 2 === 1;
    const legacy = i === 30;
    await db.booking.create({
      data: {
        requestKey: `management-fixture-${i}`,
        doctorName: `Dr Admin Management ${String(i).padStart(2, "0")}`,
        hospital: "Admin management test clinic",
        city: "Fixture city",
        country: usd || legacy ? "India" : "Senegal",
        phone: `+120255501${String(i).padStart(2, "0")}`,
        email: `admin-${i}@example.invalid`,
        specialty: "Orthopaedic Surgeon",
        notes:
          i === 0
            ? '=HYPERLINK("https://example.invalid","Fixture")'
            : `Stock fixture ${i}`,
        consentAt: new Date(),
        createdAt: new Date(`2026-01-0${(i % 4) + 1}T12:00:00Z`),
        status: bookingStatuses[i % 8],
        currency: usd ? "USD" : "CFA",
        pricedSubtotalCfa: 8000 * quantity,
        totalCfa: hasPor ? null : 8000 * quantity,
        pricedSubtotalDisplay: legacy ? null : (usd ? 13 : 8000) * quantity,
        totalDisplay: legacy || hasPor ? null : (usd ? 13 : 8000) * quantity,
        items: {
          create: [
            {
              productId: product.id,
              code: product.code,
              name: product.name,
              category: product.category,
              quantity,
              unitPriceCfa: 8000,
              unitPriceDisplay: legacy ? null : usd ? 13 : 8000,
              lineSubtotalDisplay: legacy ? null : (usd ? 13 : 8000) * quantity,
            },
            ...(hasPor
              ? [
                  {
                    productId: por.id,
                    code: por.code,
                    name: por.name,
                    category: por.category,
                    quantity: 2,
                    unitPriceCfa: null,
                    unitPriceDisplay: null,
                    lineSubtotalDisplay: null,
                  },
                ]
              : []),
          ],
        },
      },
    });
  }
  fixtures = await db.booking.findMany({
    where: fixtureWhere,
    orderBy: { doctorName: "asc" },
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/admin/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill("smoke-management@example.invalid");
  await page.getByLabel("Password").fill("development-only-smoke-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(table(page)).toBeVisible();
  cookies = await context.cookies();
  await context.close();
});
test.beforeEach(async ({ context }) => {
  await context.addCookies(cookies);
});
test.afterAll(async () => {
  await db.auditLog.deleteMany({
    where: {
      action: "BOOKING_STATUS",
      OR: fixtures.map((b) => ({ detail: { contains: b.id } })),
    },
  });
  await db.booking.deleteMany({ where: fixtureWhere });
  await db.$disconnect();
});
test("default Active excludes cancelled, pagination preserves filters, Cancelled and All remain accessible", async ({
  page,
}) => {
  await filtered(page);
  await expect(
    page.getByRole("link", { name: "All Active", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(rows(page)).toHaveCount(25);
  await expect(rows(page).filter({ hasText: "Cancelled" })).toHaveCount(0);
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/q=Admin\+Management/);
  await expect(rows(page)).toHaveCount(3);
  await page.getByRole("link", { name: "Cancelled", exact: true }).click();
  await expect(rows(page)).toHaveCount(4);
  await expect(rows(page).filter({ hasText: "Cancelled" })).toHaveCount(4);
  await page.getByRole("link", { name: "All", exact: true }).click();
  await expect(rows(page)).toHaveCount(25);
  expect(await db.booking.count({ where: fixtureWhere })).toBe(32);
});
test("search finds references, names, clinics, WhatsApp and email; literal wildcards do not broaden results", async ({
  page,
}) => {
  const b = fixtures[3];
  for (const q of [
    bookingReference(b.id, b.createdAt).toLowerCase(),
    b.doctorName,
    b.phone,
    b.email!,
  ]) {
    await filtered(page, { q, status: "ALL" });
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page)).toContainText(b.doctorName);
  }
  await filtered(page, { q: "Admin management test clinic", status: "ALL" });
  await expect(rows(page)).toHaveCount(25);
  await filtered(page, { q: "%", status: "ALL" });
  await expect(rows(page)).toHaveCount(0);
});
test("status, country, inclusive date range and sorts filter on the server", async ({
  page,
}) => {
  await filtered(page, { status: "ALL" });
  await page.getByLabel("Status", { exact: true }).selectOption("INVOICE_SENT");
  await page.getByLabel("Country", { exact: true }).selectOption("India");
  await page.getByLabel("From date").fill("2026-01-04");
  await page.getByLabel("To date").fill("2026-01-04");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(rows(page)).toHaveCount(4);
  await expect(rows(page).filter({ hasText: "Invoice Sent" })).toHaveCount(4);
  for (const row of await rows(page).all())
    await expect(row).toContainText("India");
  for (const sort of ["oldest", "name", "value"]) {
    await filtered(page, { status: "NEW", sort });
    const text = await rows(page).allTextContents();
    const expected = await db.booking.findMany({
      where: { ...fixtureWhere, status: "NEW" },
      orderBy:
        sort === "oldest"
          ? [{ createdAt: "asc" }, { id: "asc" }]
          : sort === "name"
            ? [{ doctorName: "asc" }, { id: "asc" }]
            : [
                { pricedSubtotalCfa: "desc" },
                { createdAt: "desc" },
                { id: "desc" },
              ],
    });
    expect(
      text.map((t) => expected.find((b) => t.includes(b.doctorName))!.id),
    ).toEqual(expected.map((b) => b.id));
  }
  await filtered(page, { from: "2026-01-04", to: "2026-01-01" });
  await expect(
    page.getByRole("alert").filter({ hasText: "end date" }),
  ).toContainText("end date");
  await expect(rows(page)).toHaveCount(0);
});
test("row and View open one complete booking, preserve filtered Back action and recorded historical currency", async ({
  page,
}) => {
  await filtered(page, { q: fixtures[1].doctorName, status: "ALL" });
  await rows(page).first().click();
  await expect(
    page.getByRole("heading", { name: "Pre-booking details" }),
  ).toBeVisible();
  await expect(page.locator("article")).toContainText(fixtures[1].phone);
  await expect(page.locator("article")).toContainText("Display CurrencyUSD");
  await expect(page.locator("article")).toContainText("Line subtotal: $26");
  await page.getByRole("link", { name: "← Back to Bookings" }).click();
  await expect(rows(page)).toHaveCount(1);
  await page
    .getByRole("link", { name: `View ${fixtures[1].doctorName}`, exact: true })
    .click();
  await expect(page.locator("article")).toContainText("RemarksStock fixture 1");
  await page.goto(`/admin/bookings/${fixtures[30].id}`);
  await expect(page.locator("article")).toContainText("Display CurrencyCFA");
  await expect(page.locator("article")).toContainText("8,000 CFA");
});
test("summary CSV/XLSX exports include all matching pages, retain customer snapshots and prevent CSV formulas", async ({
  page,
  context,
}) => {
  await filtered(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Summary (CSV)", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("summary-active");
  expect(await download.failure()).toBeNull();
  const response = await context.request.get(
    `/api/admin/exports?kind=summary&format=csv&q=${query}`,
  );
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  const csv = readCsv(await response.text());
  expect(csv).toHaveLength(29);
  const headers = csv[0];
  expect(headers).toContain("Specialty");
  expect(headers).toContain("Remarks");
  expect(csv.slice(1).every((row) => row[13] !== "CANCELLED")).toBe(true);
  const usd = csv.find((row) => row[2] === fixtures[1].doctorName)!;
  expect(usd[10]).toBe("USD");
  expect(usd[11]).toBe("26");
  const legacy = csv.find((row) => row[2] === fixtures[30].doctorName)!;
  expect(legacy[10]).toBe("CFA");
  expect(legacy[11]).toBe("8000");
  expect(csv.find((row) => row[2] === fixtures[0].doctorName)![14]).toMatch(
    /^'=HYPERLINK/,
  );
  const xlsx = await context.request.get(
    `/api/admin/exports?kind=summary&format=xlsx&q=${query}`,
  );
  expect(xlsx.status()).toBe(200);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(new Uint8Array(await xlsx.body()).buffer);
  const sheet = workbook.worksheets[0];
  expect(sheet.rowCount).toBe(29);
  const usdRow = sheet
    .getRows(2, 28)!
    .find((row) => row.getCell(3).value === fixtures[1].doctorName)!;
  expect(usdRow.getCell(12).value).toBe(26);
  expect(
    sheet
      .getRows(2, 28)!
      .find((row) => row.getCell(3).value === fixtures[0].doctorName)!
      .getCell(15).value,
  ).toEqual('=HYPERLINK("https://example.invalid","Fixture")');
});
test("all-active export clears restrictions, filtered cancelled export is explicit and item reports preserve quantities/prices/POR", async ({
  page,
  context,
}) => {
  await filtered(page, {
    country: "India",
    status: "CANCELLED",
    from: "2026-01-04",
  });
  const all = page.getByRole("link", {
    name: "Export All Active Bookings (CSV)",
    exact: true,
  });
  const href = await all.getAttribute("href");
  expect(href).not.toContain("country=");
  expect(href).not.toContain("q=");
  expect(href).not.toContain("from=");
  const active = readCsv(await (await context.request.get(href!)).text());
  expect(active.slice(1).every((r) => r[13] !== "CANCELLED")).toBe(true);
  expect(active.some((r) => r[2] === fixtures[0].doctorName)).toBe(true);
  const cancelled = readCsv(
    await (
      await context.request.get(
        `/api/admin/exports?kind=summary&status=CANCELLED&q=${query}`,
      )
    ).text(),
  );
  expect(cancelled).toHaveLength(5);
  const items = readCsv(
    await (
      await context.request.get(
        `/api/admin/exports?kind=items&q=${fixtures[0].doctorName}`,
      )
    ).text(),
  );
  expect(items).toHaveLength(3);
  const priced = items.find((r) => r[3] === "INS-001")!;
  expect(priced.slice(6, 11)).toEqual(["1", "8000", "CFA", "8000", "No"]);
  const por = items.find((r) => r[3] === "AR-006")!;
  expect(por.slice(6, 11)).toEqual(["2", "", "CFA", "", "Yes"]);
  const xlsx = await context.request.get(
    `/api/admin/exports?kind=items&format=xlsx&q=${fixtures[1].doctorName}`,
  );
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(new Uint8Array(await xlsx.body()).buffer);
  expect(wb.worksheets[0].getRow(2).getCell(8).value).toBe(13);
  expect(wb.worksheets[0].getRow(2).getCell(10).value).toBe(26);
});
test("stock aggregation counts active bookings and quantities exactly, excludes Cancelled under All and supports status/report exports", async ({
  page,
  context,
}) => {
  await page.goto(`/admin/stock?q=${query}`);
  const active = fixtures.filter((b) => b.status !== "CANCELLED");
  const expectedQty = active.reduce(
    (n, b) => n + ((Number(b.doctorName.slice(-2)) % 3) + 1),
    0,
  );
  const stock = page.getByRole("table", { name: "Product requirements" });
  const ins = stock.getByRole("row").filter({ hasText: "INS-001" });
  await expect(ins.locator("td").nth(3)).toHaveText("28");
  await expect(ins.locator("td").nth(4)).toHaveText(String(expectedQty));
  const csv = readCsv(
    await (
      await context.request.get(
        `/api/admin/exports?kind=stock&status=ALL&q=${query}`,
      )
    ).text(),
  );
  expect(csv.find((r) => r[0] === "INS-001")!.slice(3)).toEqual([
    "28",
    String(expectedQty),
  ]);
  expect(csv.find((r) => r[0] === "AR-006")![4]).toBe("12");
  await page.getByLabel("Status", { exact: true }).selectOption("CONFIRMED");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(ins.locator("td").nth(3)).toHaveText("4");
  const xlsx = await context.request.get(
    `/api/admin/exports?kind=stock&format=xlsx&status=CONFIRMED&q=${query}`,
  );
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(new Uint8Array(await xlsx.body()).buffer);
  expect(
    wb.worksheets[0]
      .getRows(2, wb.worksheets[0].rowCount - 1)!
      .find((r) => r.getCell(1).value === "INS-001")!
      .getCell(4).value,
  ).toBe(4);
});
test("summary cards exclude Cancelled from active units and table remains usable on mobile", async ({
  page,
}) => {
  await page.goto("/admin");
  const active = await db.booking.count({
    where: { status: { not: "CANCELLED" } },
  });
  const units = await db.bookingItem.aggregate({
    where: { booking: { status: { not: "CANCELLED" } } },
    _sum: { quantity: true },
  });
  await expect(
    page
      .getByRole("heading", { name: "Active Bookings", exact: true })
      .locator("..")
      .locator("p")
      .first(),
  ).toHaveText(String(active));
  await expect(
    page
      .getByRole("heading", { name: "Total Products Pre-Booked", exact: true })
      .locator("..")
      .locator("p")
      .first(),
  ).toHaveText(String(units._sum.quantity));
  for (const width of [375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(table(page)).toBeVisible();
  }
});
test("all workflow statuses save an audit trail, Cancelled stays recoverable, stale edits cannot overwrite newer changes", async ({
  page,
  context,
}) => {
  const booking = fixtures[0];
  await page.goto(`/admin/bookings/${booking.id}`);
  for (const status of [
    "QUOTATION_SENT",
    "INVOICE_SENT",
    "CONFIRMED",
    "PAID",
    "COLLECTED",
    "CANCELLED",
  ]) {
    await page
      .getByLabel("Booking status", { exact: true })
      .selectOption(status);
    await page.getByRole("button", { name: "Update", exact: true }).click();
    await expect(page.getByRole("status")).toContainText(
      "Booking status updated",
    );
    await expect
      .poll(
        async () =>
          (await db.booking.findUniqueOrThrow({ where: { id: booking.id } }))
            .status,
      )
      .toBe(status);
    await expect(page.locator('input[name="expectedStatus"]')).toHaveValue(
      status,
    );
  }
  await expect(
    page.getByRole("heading", { name: "Status history" }).locator(".."),
  ).toContainText("Collected → Cancelled");
  await filtered(page, { q: booking.doctorName });
  await expect(rows(page)).toHaveCount(0);
  await page.getByRole("link", { name: "Cancelled", exact: true }).click();
  await expect(rows(page)).toHaveCount(1);
  await page
    .getByRole("link", { name: `View ${booking.doctorName}`, exact: true })
    .click();
  const second = await context.newPage();
  await second.goto(`/admin/bookings/${booking.id}`);
  await page.getByLabel("Booking status", { exact: true }).selectOption("NEW");
  await page.getByRole("button", { name: "Update", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("updated");
  await second
    .getByLabel("Booking status", { exact: true })
    .selectOption("PAID");
  await second.getByRole("button", { name: "Update", exact: true }).click();
  await expect(
    second.getByRole("alert").filter({ hasText: "Another administrator" }),
  ).toContainText("Another administrator");
  expect(
    (await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status,
  ).toBe("NEW");
  await second.close();
  expect(await db.booking.count({ where: fixtureWhere })).toBe(32);
});
test("private details, stock and every export reject anonymous access; invalid exports do not disclose rows", async ({
  browser,
  context,
}) => {
  const anon = await browser.newContext();
  for (const path of [`/admin/bookings/${fixtures[0].id}`, "/admin/stock"])
    expect((await anon.request.get(path)).url()).toContain("/admin/login");
  for (const kind of ["summary", "items", "stock"])
    expect(
      (
        await anon.request.get(`/api/admin/exports?kind=${kind}&format=xlsx`)
      ).status(),
    ).toBe(401);
  await anon.close();
  expect(
    (await context.request.get("/api/admin/exports?from=not-a-date")).status(),
  ).toBe(400);
  expect(
    (await context.request.get("/api/admin/exports?status=INVALID")).status(),
  ).toBe(400);
});

test("large exports stream past the 200-booking batch boundary without truncating or duplicating bookings/items", async ({
  context,
}) => {
  const batchWhere = {
    hospital: "Admin management test clinic",
    requestKey: { startsWith: "management-batch-" },
  };
  const product = await db.product.findUniqueOrThrow({
    where: { code: "INS-001" },
  });
  await db.booking.deleteMany({ where: batchWhere });
  try {
    await db.booking.createMany({
      data: Array.from({ length: 201 }, (_, i) => ({
        id: `management-batch-${i}`,
        requestKey: `management-batch-${i}`,
        doctorName: `Dr Export Batch ${String(i).padStart(3, "0")}`,
        hospital: "Admin management test clinic",
        phone: "+12025550100",
        country: "Senegal",
        createdAt: new Date("2026-01-02T12:00:00Z"),
        consentAt: new Date(),
        pricedSubtotalCfa: 8000,
        totalCfa: 8000,
        status: "NEW" as const,
      })),
    });
    await db.bookingItem.createMany({
      data: Array.from({ length: 201 }, (_, i) => ({
        bookingId: `management-batch-${i}`,
        productId: product.id,
        code: product.code,
        name: product.name,
        category: product.category,
        quantity: 1,
        unitPriceCfa: 8000,
      })),
    });
    for (const kind of ["summary", "items"]) {
      const response = await context.request.get(
        `/api/admin/exports?kind=${kind}&q=Export+Batch&sort=name`,
      );
      expect(response.status()).toBe(200);
      const data = readCsv(await response.text());
      expect(data).toHaveLength(202);
      expect(new Set(data.slice(1).map((row) => row[0])).size).toBe(201);
    }
    const xlsx = await context.request.get(
      "/api/admin/exports?kind=summary&format=xlsx&q=Export+Batch&sort=oldest",
    );
    expect(xlsx.status()).toBe(200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(await xlsx.body()).buffer);
    expect(workbook.worksheets[0].rowCount).toBe(202);
  } finally {
    await db.booking.deleteMany({ where: batchWhere });
  }
});
