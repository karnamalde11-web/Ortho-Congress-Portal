import type { analyticsBodySchema } from "./analytics-validation";
import { cookies, headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { getDomain, parse as parseDomain } from "tldts";
import { z } from "zod";
import { db } from "./db";
import { hash, rateLimit, requireAdmin } from "./security";
import {
  ANALYTICS_IDLE_MS,
  ANALYTICS_RETENTION_DAYS,
  VISITOR_COOKIE,
  VISIT_COOKIE,
  OPT_OUT_COOKIE,
  campaignTag,
  sources,
  mediums,
  campaigns,
} from "./analytics-policy";
const uuid = z.string().uuid();
let cleanupAfter = 0;
export async function analyticsExcluded() {
  const [jar, requestHeaders] = await Promise.all([cookies(), headers()]);
  if (
    jar.get(OPT_OUT_COOKIE)?.value === "1" ||
    requestHeaders.get("dnt") === "1" ||
    requestHeaders.get("sec-gpc") === "1"
  )
    return true;
  if (jar.get("ortho_session")) {
    try {
      await requireAdmin();
      return true;
    } catch {}
  }
  return /\bbot\b|crawler|spider/i.test(requestHeaders.get("user-agent") ?? "");
}
export function safeReferrer(host: string | undefined) {
  if (!host || !/^[a-z0-9.-]+$/i.test(host) || parseDomain(host).isIp)
    return null;
  const domain = getDomain(host)?.toLowerCase();
  const own = process.env.APP_URL
    ? getDomain(new URL(process.env.APP_URL).hostname)
    : null;
  return domain && domain !== own ? domain : null;
}
export async function cleanupAnalytics(now = new Date()) {
  if (now.getTime() < cleanupAfter) return;
  cleanupAfter = now.getTime() + 24 * 60 * 60 * 1000;
  const cutoff = new Date(now.getTime() - ANALYTICS_RETENTION_DAYS * 86400000);
  try {
    await db.analyticsVisit.deleteMany({
      where: { openedAt: { lt: cutoff }, lastSeenAt: { lt: cutoff } },
    });
    await db.rateLimit.deleteMany({
      where: { key: { startsWith: "analytics:" }, windowStart: { lt: cutoff } },
    });
  } catch {
    cleanupAfter = now.getTime() + 60000;
  }
}
export async function recordAnalytics(
  data: z.infer<typeof analyticsBodySchema>,
) {
  const jar = await cookies();
  const now = new Date();
  const cutoff = new Date(now.getTime() - ANALYTICS_IDLE_MS);
  const existingVisitor = jar.get(VISITOR_COOKIE)?.value;
  const visitor = uuid.safeParse(existingVisitor).success
    ? existingVisitor!
    : randomUUID();
  const visitorHash = hash(visitor);
  await rateLimit(`analytics:${visitorHash}`, 120);
  const visitCookie = jar.get(VISIT_COOKIE)?.value;
  const result = await db.$transaction(async (tx) => {
    // Serialize session creation for one browser so concurrent tabs/refreshes
    // with the same visitor cookie reuse a single active visit.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${visitorHash}))::text`;
    let visit = uuid.safeParse(visitCookie).success
      ? await tx.analyticsVisit.findFirst({
          where: { id: visitCookie, visitorHash, lastSeenAt: { gt: cutoff } },
        })
      : null;
    visit ??= await tx.analyticsVisit.findFirst({
      where: { visitorHash, lastSeenAt: { gt: cutoff } },
      orderBy: { lastSeenAt: "desc" },
    });
    visit ??= await tx.analyticsVisit.create({
      data: {
        visitorHash,
        device: data.device,
        selectedCountry: data.country,
        openedAt: now,
        lastSeenAt: now,
        referrerDomain: safeReferrer(data.referrerHost),
        utmSource: campaignTag(data.utmSource, sources) ?? null,
        utmMedium: campaignTag(data.utmMedium, mediums) ?? null,
        utmCampaign: campaignTag(data.utmCampaign, campaigns) ?? null,
      },
    });
    const storedEvents: {
      visitId: string;
      type: string;
      key: string;
      occurredAt: Date;
      productCode?: string;
      category?: string;
      country?: string;
    }[] = [
      {
        visitId: visit.id,
        type: "OPENED",
        key: "root",
        occurredAt: visit.openedAt,
      },
    ];
    let productAt = visit.productInteractionAt;
    let quantityAt = visit.quantityEnteredAt;
    let formAt = visit.formStartedAt;
    for (const event of data.events) {
      if (event.type === "OPENED" || event.type === "ACTIVITY") continue;
      let product: { code: string; category: string } | null = null;
      if (event.productId) {
        product = await tx.product.findFirst({
          where: { id: event.productId, active: true },
          select: { code: true, category: true },
        });
        if (!product) continue;
      }
      if (event.type === "QUANTITY_ENTERED" && !product) continue;
      let category = product?.category;
      if (event.type === "CATEGORY_VIEWED") {
        if (
          !event.category ||
          !(await tx.product.findFirst({
            where: { category: event.category, active: true },
            select: { id: true },
          }))
        )
          continue;
        category = event.category;
      }
      const key =
        event.type === "COUNTRY_SELECTED"
          ? event.country
          : event.type === "CATEGORY_VIEWED"
            ? category
            : (product?.code ?? "once");
      if (!key) continue;
      storedEvents.push({
        visitId: visit.id,
        type: event.type,
        key,
        occurredAt: now,
        productCode: product?.code,
        category,
        country: event.country,
      });
      if (
        event.type === "PRODUCT_INTERACTION" ||
        event.type === "QUANTITY_ENTERED"
      )
        productAt ??= now;
      if (event.type === "QUANTITY_ENTERED") quantityAt ??= now;
      if (event.type === "FORM_STARTED") formAt ??= now;
    }
    const existingCount = await tx.analyticsEvent.count({
      where: { visitId: visit.id },
    });
    if (existingCount < 1000)
      await tx.analyticsEvent.createMany({
        data: storedEvents.slice(0, 1000 - existingCount),
        skipDuplicates: true,
      });
    await tx.analyticsVisit.update({
      where: { id: visit.id },
      data: {
        lastSeenAt: now,
        selectedCountry: data.country,
        productInteractionAt: productAt,
        quantityEnteredAt: quantityAt,
        formStartedAt: formAt,
      },
    });
    return visit.id;
  });
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
  if (visitor !== existingVisitor)
    jar.set(VISITOR_COOKIE, visitor, {
      ...options,
      maxAge: ANALYTICS_RETENTION_DAYS * 86400,
    });
  jar.set(VISIT_COOKIE, result, {
    ...options,
    maxAge: ANALYTICS_IDLE_MS / 1000,
  });
  await cleanupAnalytics(now);
}
export async function recordAnalyticsSubmission(booking: {
  id: string;
  createdAt: Date;
  country: string | null;
}) {
  // Best effort after the booking transaction has committed: an analytics
  // failure must never reject or delete a successfully saved reservation.
  try {
    if (await analyticsExcluded()) return;
    const jar = await cookies();
    const visitor = jar.get(VISITOR_COOKIE)?.value;
    const id = jar.get(VISIT_COOKIE)?.value;
    if (!uuid.safeParse(visitor).success || !uuid.safeParse(id).success) return;
    const now = new Date();
    const visitorHash = hash(visitor!);
    await db.$transaction(async (tx) => {
      const visit = await tx.analyticsVisit.findFirst({
        where: {
          id,
          visitorHash,
          lastSeenAt: { gt: new Date(now.getTime() - ANALYTICS_IDLE_MS) },
          openedAt: { lte: booking.createdAt },
        },
      });
      if (!visit) return;
      const conversion = await tx.analyticsConversion.upsert({
        where: { bookingId: booking.id },
        create: {
          bookingId: booking.id,
          visitId: visit.id,
          submittedAt: booking.createdAt,
        },
        update: {},
      });
      if (conversion.visitId !== visit.id) return;
      await tx.analyticsVisit.update({
        where: { id: visit.id },
        data: {
          lastSeenAt: now,
          selectedCountry: booking.country ?? visit.selectedCountry,
          submittedAt: visit.submittedAt ?? booking.createdAt,
          productInteractionAt: visit.productInteractionAt ?? booking.createdAt,
          quantityEnteredAt: visit.quantityEnteredAt ?? booking.createdAt,
          formStartedAt: visit.formStartedAt ?? booking.createdAt,
        },
      });
      await tx.analyticsEvent.createMany({
        data: [
          {
            visitId: visit.id,
            type: "SUBMITTED",
            key: booking.id,
            occurredAt: booking.createdAt,
          },
        ],
        skipDuplicates: true,
      });
    });
  } catch {
    /* Booking success is independent of anonymous analytics. */
  }
}
