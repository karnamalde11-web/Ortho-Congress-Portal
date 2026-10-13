import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/security";
import { db } from "@/lib/db";
import { bookingReference } from "@/lib/booking-reference";
import { recordedPricing, displayMoney } from "@/lib/currency";
import { money } from "@/lib/validation";
import { logout, updateStatus } from "./actions";
import ImportForm from "./import-form";
export const dynamic = "force-dynamic";
export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  try {
    await requireAdmin();
  } catch {
    redirect("/admin/login");
  }
  const params = await searchParams;
  const page = Math.max(1, Math.min(100000, Number(params.page) || 1));
  const [bookings, count, products] = await Promise.all([
    db.booking.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      skip: (page - 1) * 25,
      include: { items: true },
    }),
    db.booking.count(),
    db.product.count(),
  ]);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1>Exhibition dashboard</h1>
        <form action={logout}>
          <button>Sign out</button>
        </form>
      </div>
      <p className="my-4">
        {count} pre-bookings · {products} products
      </p>
      <ImportForm />
      <h2 className="my-6">Central pre-bookings</h2>
      <div className="grid gap-4">
        {bookings.map((b) => {
          const pricing = recordedPricing(b);
          const hasSnapshot = b.pricedSubtotalDisplay !== null;
          return (
            <article className="card" key={b.id}>
              <div className="flex flex-wrap justify-between gap-3">
                <h2>{b.doctorName}</h2>
                <p>
                  {displayMoney(pricing.totalDisplay, pricing.currency)}
                  {pricing.totalDisplay === null && (
                    <>
                      {" "}
                      · Priced subtotal:{" "}
                      {displayMoney(
                        pricing.pricedSubtotalDisplay,
                        pricing.currency,
                      )}
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
                  ["Submission date/time (UTC)", b.createdAt.toISOString()],
                  ["Booking status", b.status],
                  ["Display Currency", pricing.currency],
                  [
                    "Displayed priced subtotal",
                    displayMoney(
                      pricing.pricedSubtotalDisplay,
                      pricing.currency,
                    ),
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
              <ul>
                {b.items.map((i) => (
                  <li key={i.id}>
                    {i.code} — {i.name} ({i.category}) × {i.quantity} @{" "}
                    {displayMoney(
                      (hasSnapshot
                        ? i.unitPriceDisplay
                        : i.unitPriceCfa
                      )?.toFixed(2) ?? null,
                      pricing.currency,
                    )}
                    {hasSnapshot && (
                      <>
                        {" "}
                        · Line subtotal:{" "}
                        {displayMoney(
                          i.lineSubtotalDisplay?.toFixed(2) ?? null,
                          pricing.currency,
                        )}
                      </>
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
              <form action={updateStatus} className="mt-4 flex flex-wrap gap-3">
                <input type="hidden" name="id" value={b.id} />
                <select
                  name="status"
                  defaultValue={b.status}
                  aria-label="Booking status"
                >
                  {["NEW", "CONTACTED", "CONFIRMED", "CANCELLED"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <button>Update</button>
              </form>
            </article>
          );
        })}
      </div>
      <nav className="my-6 flex gap-6">
        {page > 1 && <a href={`/admin?page=${page - 1}`}>Previous</a>}
        {page * 25 < count && <a href={`/admin?page=${page + 1}`}>Next</a>}
      </nav>
    </>
  );
}
