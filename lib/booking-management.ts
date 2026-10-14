import { Prisma } from "@prisma/client";
import { db } from "./db";
import {
  type BookingFilters,
  PAGE_SIZE,
  dateBounds,
  escapeLike,
  referenceSearch,
  stockFilters,
} from "./booking-filters";
export function bookingWhere(f: BookingFilters): Prisma.BookingWhereInput {
  if (f.errors.length) return { id: { in: [] } };
  const reference = referenceSearch(f.q);
  const text = escapeLike(f.q);
  return {
    status:
      f.status === "ACTIVE"
        ? { not: "CANCELLED" }
        : f.status === "ALL"
          ? undefined
          : f.status,
    country: f.country === "_NOT_RECORDED" ? null : f.country || undefined,
    createdAt: dateBounds(f),
    ...(f.q
      ? {
          OR: [
            ...(
              ["id", "doctorName", "hospital", "phone", "email"] as const
            ).map((key) => ({
              [key]: { contains: text, mode: "insensitive" as const },
            })),
            ...(reference
              ? [
                  {
                    AND: [
                      {
                        id: {
                          contains: escapeLike(reference.id),
                          mode: "insensitive" as const,
                        },
                      },
                      {
                        createdAt: { gte: reference.start, lt: reference.end },
                      },
                    ],
                  },
                ]
              : []),
          ],
        }
      : {}),
  };
}
// Whitelisted SQL mirrors the list filters so PostgreSQL aggregates stock without
// loading every booking item into the application process.
export function bookingWhereSql(f: BookingFilters): Prisma.Sql {
  if (f.errors.length) return Prisma.sql`FALSE`;
  const conditions: Prisma.Sql[] = [];
  if (f.status === "ACTIVE")
    conditions.push(Prisma.sql`b.status <> 'CANCELLED'::"BookingStatus"`);
  else if (f.status !== "ALL")
    conditions.push(Prisma.sql`b.status = ${f.status}::"BookingStatus"`);
  if (f.country)
    conditions.push(
      f.country === "_NOT_RECORDED"
        ? Prisma.sql`b.country IS NULL`
        : Prisma.sql`b.country=${f.country}`,
    );
  const dates = dateBounds(f);
  if (dates.gte) conditions.push(Prisma.sql`b."createdAt">=${dates.gte}`);
  if (dates.lt) conditions.push(Prisma.sql`b."createdAt"<${dates.lt}`);
  if (f.q) {
    const pattern = `%${escapeLike(f.q)}%`;
    const fields = ["id", "doctorName", "hospital", "phone", "email"];
    const terms = fields.map(
      (field) => Prisma.sql`${Prisma.raw(`b."${field}"`)} ILIKE ${pattern}`,
    );
    const reference = referenceSearch(f.q);
    if (reference)
      terms.push(
        Prisma.sql`(b.id ILIKE ${`%${escapeLike(reference.id)}%`} AND b."createdAt">=${reference.start} AND b."createdAt"<${reference.end})`,
      );
    conditions.push(Prisma.sql`(${Prisma.join(terms, " OR ")})`);
  }
  return conditions.length
    ? Prisma.join(conditions, " AND ")
    : Prisma.sql`TRUE`;
}
export function bookingOrder(
  f: BookingFilters,
): Prisma.BookingOrderByWithRelationInput[] {
  if (f.sort === "oldest") return [{ createdAt: "asc" }, { id: "asc" }];
  if (f.sort === "name") return [{ doctorName: "asc" }, { id: "asc" }];
  if (f.sort === "value")
    return [
      { pricedSubtotalCfa: "desc" },
      { createdAt: "desc" },
      { id: "desc" },
    ];
  return [{ createdAt: "desc" }, { id: "desc" }];
}
export async function bookingList(f: BookingFilters) {
  const where = bookingWhere(f);
  const count = await db.booking.count({ where });
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const page = Math.min(f.page, pages);
  const bookings = await db.booking.findMany({
    where,
    orderBy: bookingOrder(f),
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: { _count: { select: { items: true } } },
  });
  return { bookings, count, page, pages };
}
export async function bookingCountries() {
  return (
    await db.booking.findMany({
      select: { country: true },
      distinct: ["country"],
      orderBy: { country: "asc" },
    })
  ).map((b) => b.country);
}
export async function bookingSummary() {
  const [statuses, units] = await Promise.all([
    db.booking.groupBy({ by: ["status"], _count: { _all: true } }),
    db.bookingItem.aggregate({
      where: { booking: { status: { not: "CANCELLED" } } },
      _sum: { quantity: true },
    }),
  ]);
  const counts = new Map(statuses.map((s) => [s.status, s._count._all]));
  return {
    active: statuses
      .filter((s) => s.status !== "CANCELLED")
      .reduce((n, s) => n + s._count._all, 0),
    new: counts.get("NEW") ?? 0,
    confirmed: counts.get("CONFIRMED") ?? 0,
    paid: counts.get("PAID") ?? 0,
    cancelled: counts.get("CANCELLED") ?? 0,
    units: units._sum.quantity ?? 0,
  };
}
export async function stockReport(filters: BookingFilters) {
  const where = bookingWhereSql(stockFilters(filters));
  const rows = await db.$queryRaw<
    {
      productId: string;
      code: string;
      name: string;
      category: string;
      bookings: bigint;
      quantity: bigint;
    }[]
  >`
 SELECT i."productId", i.code, COALESCE(p.name,MIN(i.name)) AS name,COALESCE(p.category,MIN(i.category)) AS category,COUNT(DISTINCT i."bookingId") AS bookings,SUM(i.quantity)::bigint AS quantity
 FROM "BookingItem" i JOIN "Booking" b ON b.id=i."bookingId" LEFT JOIN "Product" p ON p.id=i."productId"
 WHERE ${where} GROUP BY i."productId",i.code,p.name,p.category ORDER BY i.code ASC`;
  return rows.map((r) => ({
    ...r,
    bookings: Number(r.bookings),
    quantity: Number(r.quantity),
  }));
}
export async function bookingHistory(id: string) {
  const entries = await db.auditLog.findMany({
    where: {
      action: "BOOKING_STATUS",
      detail: { contains: JSON.stringify(id) },
    },
    orderBy: { createdAt: "asc" },
  });
  return entries.flatMap((e) => {
    try {
      const value = JSON.parse(e.detail);
      if (value.id !== id || typeof value.status !== "string") return [];
      return [
        {
          at: e.createdAt,
          status: value.status,
          fromStatus:
            typeof value.fromStatus === "string" ? value.fromStatus : null,
        },
      ];
    } catch {
      return [];
    }
  });
}
