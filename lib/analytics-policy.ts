export const ANALYTICS_IDLE_MS = 30 * 60 * 1000;
export const ANALYTICS_RETENTION_DAYS = 90;
export const VISITOR_COOKIE = "nm_visitor";
export const VISIT_COOKIE = "nm_visit";
export const OPT_OUT_COOKIE = "nm_analytics_opt_out";
export const sources = new Set([
  "google",
  "bing",
  "facebook",
  "instagram",
  "linkedin",
  "whatsapp",
  "email",
  "newsletter",
  "qr",
  "qr-code",
  "congress",
  "ajanta",
  "neu-micromed",
  "nm-ortho",
  "telegram",
  "youtube",
  "x",
  "twitter",
  "tiktok",
]);
export const mediums = new Set([
  "social",
  "paid-social",
  "cpc",
  "ppc",
  "email",
  "referral",
  "organic",
  "qr",
  "qr-code",
  "print",
  "offline",
  "banner",
  "whatsapp",
]);
export const campaigns = new Set([
  "congress",
  "exhibition",
  "congress2026",
  "ortho2026",
  "ortho-congress",
  "ortho-congress-2026",
  "congress-2026",
  "senegal-congress",
  "exhibition-2026",
  "nm-ortho",
  "nm-ortho-2026",
  "orthopaedic-congress-2026",
]);
export function campaignTag(
  value: string | null | undefined,
  allowlist: Set<string>,
) {
  const tag = value?.toLowerCase().replace(/_/g, "-");
  return tag && allowlist.has(tag) ? tag : undefined;
}
export function deviceCategory(width: number) {
  return width < 768 ? "mobile" : width < 1024 ? "tablet" : "desktop";
}
export type ClientAnalyticsEvent = {
  type:
    | "ACTIVITY"
    | "OPENED"
    | "PRODUCT_INTERACTION"
    | "QUANTITY_ENTERED"
    | "FORM_STARTED"
    | "COUNTRY_SELECTED"
    | "CATEGORY_VIEWED";
  productId?: string;
  category?: string;
  country?: string;
};
export function analyticsStageCounts(
  visits: {
    productInteractionAt: Date | null;
    quantityEnteredAt: Date | null;
    formStartedAt: Date | null;
    submittedAt: Date | null;
    visitorHash: string;
    lastSeenAt: Date;
  }[],
  now = new Date(),
) {
  const opened = visits.length;
  const meaningful = (visit: (typeof visits)[number]) =>
    !!(
      visit.productInteractionAt ||
      visit.quantityEnteredAt ||
      visit.formStartedAt
    );
  const submitted = visits.filter((visit) => visit.submittedAt);
  const convertedVisitors = new Set(
    submitted.map((visit) => visit.visitorHash),
  );
  return {
    sessions: opened,
    uniqueVisitors: new Set(visits.map((visit) => visit.visitorHash)).size,
    convertedSessions: submitted.length,
    conversionRate: opened ? (submitted.length / opened) * 100 : 0,
    sessionsNotSubmitted: opened - submitted.length,
    visitorsNotSubmitted: new Set(
      visits
        .filter((visit) => !convertedVisitors.has(visit.visitorHash))
        .map((visit) => visit.visitorHash),
    ).size,
    startedNotSubmitted: visits.filter(
      (visit) => meaningful(visit) && !visit.submittedAt,
    ).length,
    abandoned: visits.filter(
      (visit) =>
        meaningful(visit) &&
        !visit.submittedAt &&
        now.getTime() - visit.lastSeenAt.getTime() >= ANALYTICS_IDLE_MS,
    ).length,
    funnel: [
      opened,
      visits.filter((visit) => visit.productInteractionAt).length,
      visits.filter(
        (visit) => visit.productInteractionAt && visit.quantityEnteredAt,
      ).length,
      visits.filter(
        (visit) =>
          visit.productInteractionAt &&
          visit.quantityEnteredAt &&
          visit.formStartedAt,
      ).length,
      submitted.length,
    ],
  };
}
