import { db } from "./db";
import { ANALYTICS_IDLE_MS, analyticsStageCounts } from "./analytics-policy";
export async function analyticsReport(days: number, now = new Date()) {
  const since = new Date(now.getTime() - days * 86400000);
  const [visits, bookings, conversions, events] = await Promise.all([
    db.analyticsVisit.findMany({
      where: { openedAt: { gte: since } },
      orderBy: { openedAt: "desc" },
    }),
    db.booking.count({ where: { createdAt: { gte: since } } }),
    db.analyticsConversion.count({
      where: { submittedAt: { gte: since }, visitId: { not: null } },
    }),
    db.analyticsEvent.groupBy({
      by: ["type", "productCode", "category"],
      where: {
        occurredAt: { gte: since },
        type: {
          in: ["PRODUCT_INTERACTION", "QUANTITY_ENTERED", "CATEGORY_VIEWED"],
        },
      },
      _count: { _all: true },
    }),
  ]);
  const metrics = analyticsStageCounts(visits, now);
  function breakdown(key: (visit: (typeof visits)[number]) => string) {
    const groups = new Map<
      string,
      {
        label: string;
        sessions: number;
        visitors: Set<string>;
        converted: number;
        abandoned: number;
      }
    >();
    for (const visit of visits) {
      const label = key(visit);
      const group = groups.get(label) ?? {
        label,
        sessions: 0,
        visitors: new Set<string>(),
        converted: 0,
        abandoned: 0,
      };
      group.sessions++;
      group.visitors.add(visit.visitorHash);
      if (visit.submittedAt) group.converted++;
      else if (
        (visit.productInteractionAt ||
          visit.quantityEnteredAt ||
          visit.formStartedAt) &&
        now.getTime() - visit.lastSeenAt.getTime() >= ANALYTICS_IDLE_MS
      )
        group.abandoned++;
      groups.set(label, group);
    }
    return [...groups.values()]
      .map((group) => ({
        ...group,
        visitors: group.visitors.size,
        conversionRate: group.sessions
          ? (group.converted / group.sessions) * 100
          : 0,
      }))
      .sort((a, b) => b.sessions - a.sessions);
  }
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return {
    since,
    now,
    days,
    ...metrics,
    preBookings: bookings,
    linkedPreBookings: conversions,
    unattributedPreBookings: Math.max(0, bookings - conversions),
    uniqueProductVisitors: new Set(
      visits.filter((v) => v.productInteractionAt).map((v) => v.visitorHash),
    ).size,
    uniqueQuantityVisitors: new Set(
      visits.filter((v) => v.quantityEnteredAt).map((v) => v.visitorHash),
    ).size,
    uniqueFormVisitors: new Set(
      visits.filter((v) => v.formStartedAt).map((v) => v.visitorHash),
    ).size,
    countries: breakdown((v) => v.selectedCountry),
    devices: breakdown((v) => v.device),
    daysBreakdown: breakdown((v) => {
      const parts = formatter.formatToParts(v.openedAt);
      const part = (type: string) => parts.find((p) => p.type === type)!.value;
      return `${part("year")}-${part("month")}-${part("day")}`;
    }).sort((a, b) => a.label.localeCompare(b.label)),
    sources: breakdown(
      (v) => v.utmSource ?? v.referrerDomain ?? "Direct / unknown",
    ),
    campaigns: breakdown((v) => v.utmCampaign ?? "No approved campaign tag"),
    products: events
      .filter((e) => e.type === "PRODUCT_INTERACTION" && e.productCode)
      .map((e) => ({ label: e.productCode!, sessions: e._count._all }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 20),
    categories: events
      .filter((e) => e.type === "CATEGORY_VIEWED" && e.category)
      .map((e) => ({ label: e.category!, sessions: e._count._all }))
      .sort((a, b) => b.sessions - a.sessions),
    recent: visits.slice(0, 50).map((v) => ({
      openedAt: v.openedAt,
      lastSeenAt: v.lastSeenAt,
      country: v.selectedCountry,
      device: v.device,
      source: v.utmSource ?? v.referrerDomain ?? "Direct / unknown",
      status: v.submittedAt
        ? "Submitted"
        : v.productInteractionAt || v.quantityEnteredAt || v.formStartedAt
          ? now.getTime() - v.lastSeenAt.getTime() >= ANALYTICS_IDLE_MS
            ? "Abandoned"
            : "Started, still active"
          : "Opened only",
    })),
  };
}
