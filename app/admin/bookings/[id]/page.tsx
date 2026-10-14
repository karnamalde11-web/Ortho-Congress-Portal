import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/security";
import { db } from "@/lib/db";
import { bookingReference } from "@/lib/booking-reference";
import { recordedPricing, displayMoney } from "@/lib/currency";
import { money } from "@/lib/validation";
import {
  safeBookingBack,
  adminDate,
  statusLabels,
} from "@/lib/booking-filters";
import { bookingHistory } from "@/lib/booking-management";
import { logout } from "../../actions";
import StatusForm from "../../status-form";
export const dynamic = "force-dynamic";
export default async function BookingDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  try {
    await requireAdmin();
  } catch {
    redirect("/admin/login");
  }
  const { id } = await params;
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) notFound();
  const [b, history] = await Promise.all([
    db.booking.findUnique({
      where: { id },
      include: { items: { orderBy: [{ code: "asc" }, { id: "asc" }] } },
    }),
    bookingHistory(id),
  ]);
  if (!b) notFound();
  const back = safeBookingBack((await searchParams).back);
  const pricing = recordedPricing(b);
  const hasSnapshot = b.pricedSubtotalDisplay !== null;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <a href={back}>← Back to Bookings</a>
        <form action={logout}>
          <button>Sign out</button>
        </form>
      </div>
      <h1 className="mb-4">Pre-booking details</h1>
      <article className="card">
        <div className="flex flex-wrap justify-between gap-3">
          <h2>{b.doctorName}</h2>
          <p>
            {displayMoney(pricing.totalDisplay, pricing.currency)}
            {pricing.totalDisplay === null && (
              <>
                {" "}
                · Priced subtotal:{" "}
                {displayMoney(pricing.pricedSubtotalDisplay, pricing.currency)}
              </>
            )}
          </p>
        </div>
        <dl className="my-4 grid gap-3 break-words text-sm sm:grid-cols-2">
          {[
            ["Name", b.doctorName],
            [
              "Specialty",
              b.specialty === "Other"
                ? `Other: ${b.specialtyOther ?? "Not recorded"}`
                : (b.specialty ?? "Not recorded (earlier booking)"),
            ],
            ["Hospital / Clinic", b.hospital],
            ["City", b.city ?? "Not recorded (earlier booking)"],
            ["Country", b.country ?? "Not recorded (earlier booking)"],
            ["WhatsApp number", b.phone],
            ["Email", b.email || "Not provided"],
            ["Remarks", b.notes || "Not provided"],
            ["Booking reference", bookingReference(b.id, b.createdAt)],
            ["Submission date/time (IST)", adminDate(b.createdAt)],
            ["Booking status", statusLabels[b.status]],
            ["Display Currency", pricing.currency],
            [
              "Displayed priced subtotal",
              displayMoney(pricing.pricedSubtotalDisplay, pricing.currency),
            ],
            [
              "Price on Request products",
              b.items
                .filter((i) => i.unitPriceCfa === null)
                .map((i) => i.code)
                .join(", ") || "None",
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="font-bold">{label}</dt>
              <dd className="whitespace-pre-wrap">{value}</dd>
            </div>
          ))}
          {!b.phoneCountryCode && (
            <p>
              Earlier booking: WhatsApp number shown exactly as originally
              recorded.
            </p>
          )}
        </dl>
        <h3 className="mb-2 font-bold">
          Selected products, quantities and customer prices
        </h3>
        <ul className="space-y-2">
          {b.items.map((i) => (
            <li key={i.id}>
              {i.code} — {i.name} ({i.category}) × {i.quantity} @{" "}
              {displayMoney(
                (hasSnapshot ? i.unitPriceDisplay : i.unitPriceCfa)?.toFixed(
                  2,
                ) ?? null,
                pricing.currency,
              )}{" "}
              · Line subtotal:{" "}
              {displayMoney(
                (hasSnapshot
                  ? i.lineSubtotalDisplay
                  : i.unitPriceCfa?.mul(i.quantity)
                )?.toFixed(2) ?? null,
                pricing.currency,
              )}
            </li>
          ))}
        </ul>
        {pricing.currency === "USD" && (
          <details className="my-4 text-sm">
            <summary>Original CFA pricing (internal)</summary>
            <p>
              Original CFA priced subtotal:{" "}
              {money(b.pricedSubtotalCfa.toFixed(2))}
            </p>
            <ul>
              {b.items.map((i) => (
                <li key={i.id}>
                  {i.code} × {i.quantity}:{" "}
                  {money(i.unitPriceCfa?.toFixed(2) ?? null)} per unit
                </li>
              ))}
            </ul>
          </details>
        )}
        <StatusForm id={b.id} status={b.status} />
        <section className="mt-6 border-t border-slate-200 pt-4">
          <h2>Status history</h2>
          {history.length ? (
            <ol className="mt-3 space-y-2 text-sm">
              {history.map((entry, index) => (
                <li key={index}>
                  {adminDate(entry.at)} IST ·{" "}
                  {entry.fromStatus
                    ? `${statusLabels[entry.fromStatus as keyof typeof statusLabels] ?? entry.fromStatus} → `
                    : "Status set to "}
                  {statusLabels[entry.status as keyof typeof statusLabels] ??
                    entry.status}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-sm">
              No recorded status changes. Earlier changes appear here when an
              audit entry exists.
            </p>
          )}
        </section>
      </article>
    </>
  );
}
