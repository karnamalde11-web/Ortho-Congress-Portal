import "dotenv/config";
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createHash } from "node:crypto";
import { analyticsStageCounts } from "../../lib/analytics-policy";
const databaseUrl = process.env.DATABASE_URL;
if (
  !databaseUrl ||
  !["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname) ||
  !["localhost", "127.0.0.1"].includes(
    new URL(process.env.APP_URL || "http://localhost:3000").hostname,
  )
)
  throw new Error(
    "Analytics integration fixtures are only permitted on local development services.",
  );
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});
test.afterAll(() => db.$disconnect());
async function session(page: Page) {
  await expect
    .poll(
      async () =>
        (await page.context().cookies()).find(
          (cookie) => cookie.name === "nm_visit",
        )?.value,
    )
    .toBeTruthy();
  return (await page.context().cookies()).find(
    (cookie) => cookie.name === "nm_visit",
  )!.value;
}
async function event(page: Page, type: string) {
  const id = await session(page);
  await expect
    .poll(() => db.analyticsEvent.count({ where: { visitId: id, type } }))
    .toBeGreaterThan(0);
  return id;
}
const body = {
  path: "/",
  country: "Senegal",
  device: "mobile",
  events: [{ type: "OPENED" }],
};
const origin = "http://localhost:3000";
test("new and returning anonymous visitor, refresh deduplication and 30-minute session rollover", async ({
  page,
}) => {
  await page.goto("/");
  const first = await session(page);
  const visit = await db.analyticsVisit.findUniqueOrThrow({
    where: { id: first },
  });
  const visitorCookie = (await page.context().cookies()).find(
    (cookie) => cookie.name === "nm_visitor",
  )!;
  expect(visit.visitorHash).toBe(
    createHash("sha256").update(visitorCookie.value).digest("hex"),
  );
  expect(visitorCookie.httpOnly).toBe(true);
  expect(visitorCookie.secure).toBe(true);
  await event(page, "OPENED");
  for (let n = 0; n < 3; n++) {
    const response = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/analytics") &&
        response.request().method() === "POST",
    );
    await page.reload();
    expect((await response).status()).toBe(204);
    expect(await session(page)).toBe(first);
  }
  expect(
    await db.analyticsVisit.count({
      where: { visitorHash: visit.visitorHash },
    }),
  ).toBe(1);
  expect(
    await db.analyticsEvent.count({
      where: { visitId: first, type: "OPENED" },
    }),
  ).toBe(1);
  await db.analyticsVisit.update({
    where: { id: first },
    data: { lastSeenAt: new Date(Date.now() - 31 * 60000) },
  });
  const response = page.waitForResponse((response) =>
    response.url().endsWith("/api/analytics"),
  );
  await page.reload();
  await response;
  const second = await session(page);
  expect(second).not.toBe(first);
  const returning = await db.analyticsVisit.findUniqueOrThrow({
    where: { id: second },
  });
  expect(returning.visitorHash).toBe(visit.visitorHash);
  const visits = await db.analyticsVisit.findMany({
    where: { visitorHash: visit.visitorHash },
  });
  expect(analyticsStageCounts(visits).sessions).toBe(2);
  expect(analyticsStageCounts(visits).uniqueVisitors).toBe(1);
});
test("product, quantity, category, selected-country and form-start events contain no entered profile values", async ({
  page,
}) => {
  const payloads: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/analytics"))
      payloads.push(request.postData()!);
  });
  await page.goto("/");
  const id = await session(page);
  await page.getByLabel("Category").selectOption("Instruments");
  await page.getByLabel("Search products").fill("INS-001");
  await page.getByLabel("Quantity to reserve").fill("2");
  await page
    .getByLabel("Name *", { exact: true })
    .fill("Private person never recorded");
  await page
    .getByLabel("Email (optional)")
    .fill("private-person@example.invalid");
  await page
    .getByLabel("WhatsApp phone number *", { exact: true })
    .fill("771234567");
  await page.getByLabel("Country *", { exact: true }).selectOption("India");
  for (const type of [
    "PRODUCT_INTERACTION",
    "QUANTITY_ENTERED",
    "FORM_STARTED",
    "COUNTRY_SELECTED",
    "CATEGORY_VIEWED",
  ])
    await event(page, type);
  const stored = await db.analyticsVisit.findUniqueOrThrow({ where: { id } });
  expect(stored.selectedCountry).toBe("India");
  expect(stored.productInteractionAt).not.toBeNull();
  expect(stored.quantityEnteredAt).not.toBeNull();
  expect(stored.formStartedAt).not.toBeNull();
  expect(stored.submittedAt).toBeNull();
  expect(payloads.join(" ")).not.toMatch(
    /Private person|private-person@|771234567/,
  );
  const quantity = await db.analyticsEvent.findMany({
    where: { visitId: id, type: "QUANTITY_ENTERED" },
  });
  expect(quantity).toHaveLength(1);
  expect(quantity[0].productCode).toBe("INS-001");
  await page.getByLabel("Quantity to reserve").fill("3");
  await page.getByLabel("Quantity to reserve").fill("4");
  expect(
    await db.analyticsEvent.count({
      where: { visitId: id, type: "QUANTITY_ENTERED" },
    }),
  ).toBe(1);
  await db.analyticsVisit.update({
    where: { id },
    data: { lastSeenAt: new Date(Date.now() - 31 * 60000) },
  });
  const expired = await db.analyticsVisit.findUniqueOrThrow({ where: { id } });
  expect(analyticsStageCounts([expired]).abandoned).toBe(1);
});
test("successful booking is authoritatively linked once to its visit and analytics remains protected", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const id = await session(page);
  await page.getByLabel("Search products").fill("INS-001");
  await page.getByLabel("Quantity to reserve").fill("1");
  await page
    .getByLabel("Name *", { exact: true })
    .fill("Dr Analytics Conversion");
  await page
    .getByLabel("Specialty *", { exact: true })
    .selectOption("Orthopaedic Surgeon");
  await page
    .getByLabel("Hospital / Clinic *", { exact: true })
    .fill("Smoke test clinic");
  await page.getByLabel("City *", { exact: true }).fill("Dakar");
  await page.getByLabel("WhatsApp country code *", { exact: true }).fill("1");
  await page
    .getByLabel("WhatsApp phone number *", { exact: true })
    .fill("2025550180");
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/bookings") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Submit pre-booking" }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  const receipt = await response.json();
  await expect
    .poll(() =>
      db.analyticsConversion.count({
        where: { bookingId: receipt.id, visitId: id },
      }),
    )
    .toBe(1);
  await event(page, "SUBMITTED");
  const retry = await page.context().request.post("/api/bookings", {
    headers: { Origin: origin },
    data: response.request().postDataJSON(),
  });
  expect(retry.status()).toBe(201);
  expect((await retry.json()).id).toBe(receipt.id);
  expect(
    await db.analyticsConversion.count({ where: { bookingId: receipt.id } }),
  ).toBe(1);
  expect(
    await db.analyticsEvent.count({
      where: { visitId: id, type: "SUBMITTED" },
    }),
  ).toBe(1);
  const visit = await db.analyticsVisit.findUniqueOrThrow({ where: { id } });
  expect(analyticsStageCounts([visit]).funnel).toEqual([1, 1, 1, 1, 1]);
  expect(analyticsStageCounts([visit]).conversionRate).toBe(100);
  await page.goto("/admin/analytics");
  await expect(page).toHaveURL(/\/admin\/login/);
  expect((await request.get("/admin/analytics")).url()).toContain(
    "/admin/login",
  );
});
test("mobile, tablet and desktop classifications use broad screen categories", async ({
  browser,
}) => {
  for (const [width, device] of [
    [375, "mobile"],
    [800, "tablet"],
    [1440, "desktop"],
  ] as const) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    const page = await context.newPage();
    await page.goto("/");
    const id = await session(page);
    expect(
      (await db.analyticsVisit.findUniqueOrThrow({ where: { id } })).device,
    ).toBe(device);
    await context.close();
  }
});
test("admin routes and signed-in administrator catalogue visits are excluded", async ({
  page,
}) => {
  const before = await db.analyticsVisit.count();
  const analyticsRequests: string[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/api/analytics")) analyticsRequests.push(r.url());
  });
  await page.goto("/admin/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill("smoke-analytics@example.invalid");
  await page.getByLabel("Password").fill("development-only-smoke-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("link", { name: "Visitor analytics", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Visitor analytics", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Pre-booking funnel" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Unique Visitors", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "By day (IST)", exact: true }),
  ).toBeVisible();
  expect(analyticsRequests).toHaveLength(0);
  expect(await db.analyticsVisit.count()).toBe(before);
  await page.goto("/");
  const rootResponse = page.waitForResponse((response) =>
    response.url().endsWith("/api/analytics"),
  );
  await page.getByLabel("Search products").fill("INS-001");
  await rootResponse;
  expect(await db.analyticsVisit.count()).toBe(before);
  expect(
    (await page.context().cookies()).some(
      (cookie) => cookie.name === "nm_visitor",
    ),
  ).toBe(false);
});
test("privacy controls honor opt-out and DNT without interfering with pre-booking", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await session(page);
  await page.goto("/privacy");
  await page
    .getByRole("button", { name: "Turn off anonymous analytics" })
    .click();
  await expect(page.getByRole("status")).toContainText("disabled");
  const before = await db.analyticsVisit.count();
  await page.goto("/");
  await page.getByLabel("Search products").fill("INS-001");
  const post = page.waitForResponse((response) =>
    response.url().endsWith("/api/analytics"),
  );
  await page.getByLabel("Quantity to reserve").fill("2");
  await post;
  expect(await db.analyticsVisit.count()).toBe(before);
  expect(
    (await page.context().cookies()).some(
      (cookie) => cookie.name === "nm_visitor",
    ),
  ).toBe(false);
  for (const signal of ["DNT", "Sec-GPC"]) {
    const context = await browser.newContext({
      extraHTTPHeaders: { [signal]: "1" },
    });
    const privatePage = await context.newPage();
    const wait = privatePage.waitForResponse((response) =>
      response.url().endsWith("/api/analytics"),
    );
    await privatePage.goto("/");
    await wait;
    expect(
      (await context.cookies()).some((cookie) => cookie.name === "nm_visitor"),
    ).toBe(false);
    expect(await db.analyticsVisit.count()).toBe(before);
    await context.close();
  }
});
test("campaign/source tags are allowlisted; sensitive metadata, forged conversions and admin referers cannot be recorded", async ({
  page,
}) => {
  await page.goto(
    "/?utm_source=whatsapp&utm_medium=qr&utm_campaign=ortho-congress-2026&utm_term=private-person@example.invalid",
  );
  const id = await session(page);
  const visit = await db.analyticsVisit.findUniqueOrThrow({ where: { id } });
  expect(visit.utmSource).toBe("whatsapp");
  expect(visit.utmMedium).toBe("qr");
  expect(visit.utmCampaign).toBe("ortho-congress-2026");
  const count = await db.analyticsVisit.count();
  for (const data of [
    { ...body, name: "Private name" },
    { ...body, events: [{ type: "SUBMITTED" }] },
    { ...body, path: "/admin" },
  ]) {
    const result = await page.context().request.post("/api/analytics", {
      headers: { Origin: origin, Referer: `${origin}/` },
      data,
    });
    expect(result.status()).toBe(204);
  }
  await page.context().request.post("/api/analytics", {
    headers: { Origin: origin, Referer: `${origin}/admin` },
    data: body,
  });
  expect(await db.analyticsVisit.count()).toBe(count);
  expect(
    await db.analyticsEvent.count({
      where: { visitId: id, type: "SUBMITTED" },
    }),
  ).toBe(0);
});
