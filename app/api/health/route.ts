import { db } from "@/lib/db";
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    const columns = await db.$queryRaw<
      { count: bigint }[]
    >`SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Booking' AND column_name IN ('city', 'country', 'specialty', 'specialtyOther', 'phoneCountryCode', 'phoneNationalNumber')`;
    if (Number(columns[0]?.count) !== 6) throw new Error("Migration pending");
    const snapshotColumns = await db.$queryRaw<
      { count: bigint }[]
    >`SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_schema = 'public' AND ((table_name = 'Booking' AND column_name IN ('pricedSubtotalDisplay', 'totalDisplay')) OR (table_name = 'BookingItem' AND column_name IN ('unitPriceDisplay', 'lineSubtotalDisplay')))`;
    if (Number(snapshotColumns[0]?.count) !== 4)
      throw new Error("Migration pending");
    const [analyticsTables] = await db.$queryRaw<
      { ready: boolean }[]
    >`SELECT (to_regclass('public."AnalyticsVisit"') IS NOT NULL AND to_regclass('public."AnalyticsEvent"') IS NOT NULL AND to_regclass('public."AnalyticsConversion"') IS NOT NULL) AS ready`;
    if (!analyticsTables?.ready) throw new Error("Migration pending");
    const [management] = await db.$queryRaw<
      { ready: boolean }[]
    >`SELECT ((SELECT COUNT(*) FROM pg_enum WHERE enumtypid = '"BookingStatus"'::regtype AND enumlabel IN ('QUOTATION_SENT','INVOICE_SENT','PAID','COLLECTED')) = 4 AND to_regclass('public."Booking_status_createdAt_idx"') IS NOT NULL AND to_regclass('public."Booking_country_createdAt_idx"') IS NOT NULL) AS ready`;
    if (!management?.ready) throw new Error("Migration pending");
    const release = process.env.RAILWAY_GIT_COMMIT_SHA || "local";
    const audit = await db.auditLog.findFirst({
      where: { action: "CUSTOMER_DETAILS_MIGRATION" },
      orderBy: { createdAt: "desc" },
    });
    const evidence = audit ? JSON.parse(audit.detail) : null;
    return Response.json({
      status: "ok",
      release,
      customerDetailsReady: true,
      currencySnapshotsReady: true,
      analyticsReady: true,
      bookingManagementReady: true,
      existingBookingsPreserved:
        evidence?.release === release && evidence?.preserved === true,
    });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
