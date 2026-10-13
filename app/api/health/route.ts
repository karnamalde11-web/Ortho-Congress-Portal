import { db } from "@/lib/db";
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    const columns = await db.$queryRaw<
      { count: bigint }[]
    >`SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Booking' AND column_name IN ('city', 'country', 'specialty', 'specialtyOther', 'phoneCountryCode', 'phoneNationalNumber')`;
    if (Number(columns[0]?.count) !== 6) throw new Error("Migration pending");
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
      existingBookingsPreserved:
        evidence?.release === release && evidence?.preserved === true,
    });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
