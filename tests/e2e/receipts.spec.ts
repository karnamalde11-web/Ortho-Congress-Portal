import "dotenv/config";
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { execFileSync } from "node:child_process";
import { publicProducts } from "./public-products";
const base = process.env.APP_URL || "http://localhost:3000";
if (
  !["localhost", "127.0.0.1"].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  ) ||
  !["localhost", "127.0.0.1"].includes(new URL(base).hostname)
)
  throw new Error("Receipt fixtures are local only.");
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
test.afterAll(() => db.$disconnect());
for (const [index, scenario] of [
  { country: "Senegal", mode: "priced", width: 375 },
  { country: "Senegal", mode: "mixed", width: 390 },
  { country: "Senegal", mode: "request", width: 430 },
  { country: "India", mode: "priced", width: 1440 },
  { country: "India", mode: "mixed", width: 375 },
  { country: "India", mode: "request", width: 390 },
].entries())
  test(`saved ${scenario.country} ${scenario.mode} receipt, quantities, print dialog and PDF at ${scenario.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: scenario.width, height: 844 });
    await page.goto("/");
    await page
      .getByLabel("Country *", { exact: true })
      .selectOption(scenario.country);
    const products = await publicProducts(page);
    const codes =
      scenario.mode === "priced"
        ? ["INS-001"]
        : scenario.mode === "mixed"
          ? ["INS-001", "AR-006"]
          : ["AR-006"];
    for (const code of codes) {
      await page.getByLabel("Search products").fill(code);
      await page
        .getByLabel("Quantity to reserve")
        .fill(code === "INS-001" ? "3" : "2");
    }
    await page
      .getByLabel("Name *", { exact: true })
      .fill(`Dr Receipt Test ${index}`);
    await page.getByLabel("Specialty *", { exact: true }).selectOption("Other");
    await page
      .getByLabel("Your specialty *", { exact: true })
      .fill("Receipt audit");
    await page
      .getByLabel("Hospital / Clinic *", { exact: true })
      .fill("Smoke test clinic");
    await page.getByLabel("City *", { exact: true }).fill("Test City");
    await page.getByLabel("WhatsApp country code *", { exact: true }).fill("1");
    await page
      .getByLabel("WhatsApp phone number *", { exact: true })
      .fill(`202555016${index}`);
    if (index === 0)
      await page.getByLabel("Email (optional)").fill("receipt@example.invalid");
    const responsePromise = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/bookings") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Submit pre-booking" }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(201);
    expect(response.headers()["cache-control"]).toBe("no-store");
    const receipt = await response.json();
    const confirmation = page.getByRole("status");
    await expect(confirmation).toContainText(receipt.reference);
    await expect(confirmation).toContainText(`Dr Receipt Test ${index}`);
    await expect(confirmation).toContainText("Other: Receipt audit");
    await expect(confirmation).toContainText("Test City");
    await expect(confirmation).toContainText(`+1202555016${index}`);
    const amount = scenario.country === "India" ? "$39" : "24,000 CFA";
    const summary = page.getByRole("region", {
      name: "Receipt pricing summary",
    });
    if (scenario.mode === "mixed") {
      await expect(
        summary
          .locator("dt")
          .filter({ hasText: /^Final total:$/ })
          .locator("..")
          .locator("dd"),
      ).toHaveText(`${amount} + price of the Price on Request item(s)`);
      await expect(summary).toContainText("1 item");
      await expect(summary).toContainText(
        "The final amount will be confirmed by our team",
      );
      expect(receipt.priceOnRequestCount).toBe(1);
    } else if (scenario.mode === "request") {
      await expect(
        summary
          .locator("dt")
          .filter({ hasText: /^Final total:$/ })
          .locator("..")
          .locator("dd"),
      ).toHaveText("On Request");
      await expect(summary).toContainText("Our team will confirm the prices");
      await expect(confirmation).not.toContainText("0 CFA");
      await expect(confirmation).not.toContainText("$0");
    } else {
      await expect(
        summary
          .locator("dt")
          .filter({ hasText: /^Total:$/ })
          .locator("..")
          .locator("dd"),
      ).toHaveText(amount);
      await expect(confirmation).not.toContainText("Price on Request");
    }
    const table = page.getByRole("table", { name: "Pre-booked products" });
    for (const code of codes) await expect(table).toContainText(code);
    for (const code of codes)
      expect(
        receipt.items.find((item: { code: string }) => item.code === code)
          ?.quantity,
      ).toBe(code === "INS-001" ? 3 : 2);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.evaluate(() => {
      (window as unknown as { printCalls: number }).printCalls = 0;
      window.print = () => {
        (window as unknown as { printCalls: number }).printCalls++;
      };
    });
    await page.getByRole("button", { name: "Print / Save Receipt" }).click();
    expect(
      await page.evaluate(
        () => (window as unknown as { printCalls: number }).printCalls,
      ),
    ).toBe(1);
    await page.emulateMedia({ media: "print" });
    await expect(page.locator("body > header")).toBeHidden();
    await expect(page.locator("body > footer")).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Print / Save Receipt" }),
    ).toBeHidden();
    await expect(
      page.getByRole("heading", { name: "Pre-booking submitted successfully" }),
    ).toBeHidden();
    await expect(page.locator(".receipt-print-title")).toBeVisible();
    await expect(table.locator("thead")).toBeVisible();
    expect(
      await table
        .locator("tbody tr")
        .first()
        .evaluate((el) => getComputedStyle(el).display),
    ).toBe("table-row");
    const pdfPath = `/tmp/ortho-receipt-${index}.pdf`;
    await page.pdf({
      path: pdfPath,
      preferCSSPageSize: true,
      printBackground: true,
    });
    const pdfText = execFileSync("pdftotext", ["-layout", pdfPath, "-"], {
      encoding: "utf8",
    });
    expect(pdfText).toContain(receipt.reference);
    expect(pdfText).toContain("NM Ortho Pricing & Pre-Booking Portal");
    expect(pdfText).toContain("Collection during the Congress");
    expect(pdfText).not.toContain("Return to catalogue");
    expect(pdfText).not.toContain("Search products");
    for (const code of codes) expect(pdfText).toContain(code);
    await page.emulateMedia({ media: "screen" });
    await page.screenshot({
      path: `/tmp/ortho-receipt-${index}.png`,
      fullPage: true,
    });
    // Change only the disposable local catalogue. Both an idempotent response and
    // the authenticated saved receipt must keep the original unit/line prices.
    if (index === 0) {
      const p = products.find((p) => p.code === "INS-001")!;
      const before = await db.product.findUniqueOrThrow({
        where: { id: p.id },
      });
      try {
        await db.product.update({
          where: { id: p.id },
          data: { priceCfa: 999999, name: "Changed catalogue name" },
        });
        const replay = await page.request.post("/api/bookings", {
          headers: { Origin: base },
          data: response.request().postDataJSON(),
        });
        expect(replay.status()).toBe(201);
        expect(await replay.json()).toEqual(receipt);
        await page.goto(`/admin/bookings/${receipt.id}/receipt`);
        await expect(page).toHaveURL(/\/admin\/login$/);
        await page
          .getByLabel("Email", { exact: true })
          .fill("smoke-receipts@example.invalid");
        await page
          .getByLabel("Password")
          .fill("development-only-smoke-password");
        await page
          .getByRole("button", { name: "Sign in", exact: true })
          .click();
        await expect(
          page.getByRole("heading", { name: "Exhibition dashboard" }),
        ).toBeVisible();
        await page.goto(`/admin/bookings/${receipt.id}/receipt`);
        await expect(page.locator("#booking-receipt")).toContainText(
          "24,000 CFA",
        );
        await expect(page.locator("#booking-receipt")).not.toContainText(
          "999,999",
        );
        await expect(page.locator("#booking-receipt")).not.toContainText(
          "Changed catalogue name",
        );
        await expect(page.locator("#booking-receipt")).toContainText(
          "receipt@example.invalid",
        );
        await page
          .getByRole("button", { name: "Print / Save Receipt" })
          .click({ trial: true });
      } finally {
        await db.product.update({
          where: { id: p.id },
          data: {
            priceCfa: before.priceCfa,
            name: before.name,
            updatedAt: before.updatedAt,
          },
        });
      }
    }
  });
