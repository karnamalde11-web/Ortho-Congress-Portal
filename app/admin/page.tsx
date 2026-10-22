import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/security";
import { bookingReference } from "@/lib/booking-reference";
import { recordedPricing, displayMoney } from "@/lib/currency";
import {
  parseBookingFilters,
  bookingListUrl,
  adminDate,
  statusLabels,
  type FilterParams,
} from "@/lib/booking-filters";
import {
  bookingList,
  bookingSummary,
  bookingCountries,
} from "@/lib/booking-management";
import { logout } from "./actions";
import ImportForm from "./import-form";
import BookingRow from "./booking-row";
import BookingFilterForm, { BookingTabs, ExportLinks } from "./booking-filters";
export const dynamic = "force-dynamic";
export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<FilterParams>;
}) {
  try {
    await requireAdmin();
  } catch {
    redirect("/admin/login");
  }
  const filters = parseBookingFilters(await searchParams);
  const [list, summary, countries] = await Promise.all([
    bookingList(filters),
    bookingSummary(),
    bookingCountries(),
  ]);
  const current = { ...filters, page: list.page };
  const back = bookingListUrl(current);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1>Exhibition dashboard</h1>
        <form action={logout}>
          <button>Sign out</button>
        </form>
      </div>
      <nav className="my-4 flex flex-wrap gap-4">
        <a href="/admin/analytics">Visitor analytics</a>
        <a href="/admin/stock">Stock requirements</a>
        <a href="/admin/notifications">Email alerts</a>
        <a href="/admin/settings/password">Change admin password</a>
      </nav>
      <div className="my-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
        {[
          ["Active Bookings", summary.active],
          ["New", summary.new],
          ["Confirmed", summary.confirmed],
          ["Paid", summary.paid],
          ["Total Products Pre-Booked", summary.units],
          ["Cancelled", summary.cancelled],
        ].map(([label, value]) => (
          <section
            className="rounded-xl border border-slate-200 bg-white p-3"
            key={label}
          >
            <h2 className="text-sm">{label}</h2>
            <p className="mt-1 text-2xl font-bold">{value}</p>
            {label === "Total Products Pre-Booked" && (
              <p className="text-xs">Units in active bookings</p>
            )}
          </section>
        ))}
      </div>
      <p className="text-sm">
        Summary cards cover all bookings. Cancelled bookings are excluded from
        active counts and units.
      </p>
      <h2 className="mt-6">Central pre-bookings</h2>
      <BookingTabs filters={current} />
      <BookingFilterForm filters={current} countries={countries} />
      {filters.errors.length > 0 && (
        <p role="alert" className="my-4 text-red-700">
          {filters.errors.join(" ")}
        </p>
      )}
      <p className="my-3">
        {list.count} matching bookings · {statusLabels[filters.status]} · Page{" "}
        {list.page} of {list.pages}
      </p>
      <div
        className="overflow-x-auto rounded-xl border border-slate-200 bg-white"
        tabIndex={0}
        aria-label="Scrollable bookings table"
      >
        <table
          className="booking-table w-full text-left text-sm"
          aria-label="Pre-bookings"
        >
          <thead className="bg-slate-100">
            <tr>
              {[
                "Booking Reference",
                "Date (IST)",
                "Customer Name",
                "Hospital / Clinic",
                "City",
                "Country",
                "WhatsApp",
                "Products",
                "Display Total",
                "Status",
                "Action",
              ].map((label) => (
                <th key={label} scope="col" className="p-3">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.bookings.map((booking) => {
              const pricing = recordedPricing(booking);
              const href = `/admin/bookings/${encodeURIComponent(booking.id)}?back=${encodeURIComponent(back)}`;
              return (
                <BookingRow key={booking.id} href={href}>
                  <td className="max-w-48 break-words p-3">
                    <a href={href}>
                      {bookingReference(booking.id, booking.createdAt)}
                    </a>
                  </td>
                  <td className="whitespace-nowrap p-3">
                    {adminDate(booking.createdAt)}
                  </td>
                  <td className="min-w-36 p-3 font-bold">
                    <a href={href}>{booking.doctorName}</a>
                  </td>
                  <td className="min-w-36 p-3">{booking.hospital}</td>
                  <td className="p-3">{booking.city ?? "Not recorded"}</td>
                  <td className="p-3">{booking.country ?? "Not recorded"}</td>
                  <td className="whitespace-nowrap p-3">{booking.phone}</td>
                  <td className="p-3">{booking._count.items}</td>
                  <td className="min-w-36 p-3">
                    {pricing.totalDisplay !== null ? (
                      displayMoney(pricing.totalDisplay, pricing.currency)
                    ) : Number(pricing.pricedSubtotalDisplay) > 0 ? (
                      <>
                        {displayMoney(
                          pricing.pricedSubtotalDisplay,
                          pricing.currency,
                        )}
                        <span className="block text-xs">
                          + Price on Request
                        </span>
                      </>
                    ) : (
                      "Price on Request"
                    )}
                    <span className="block text-xs">{pricing.currency}</span>
                  </td>
                  <td className="whitespace-nowrap p-3">
                    {statusLabels[booking.status]}
                  </td>
                  <td className="p-3">
                    <a
                      className="font-bold"
                      href={href}
                      aria-label={`View ${booking.doctorName}`}
                    >
                      View
                    </a>
                  </td>
                </BookingRow>
              );
            })}
          </tbody>
        </table>
        {!list.bookings.length && (
          <p className="p-6">No bookings match these filters.</p>
        )}
      </div>
      <nav
        className="my-5 flex flex-wrap justify-between gap-4"
        aria-label="Booking pages"
      >
        {list.page > 1 && (
          <a href={bookingListUrl({ ...current, page: list.page - 1 })}>
            Previous
          </a>
        )}
        {list.page < list.pages && (
          <a href={bookingListUrl({ ...current, page: list.page + 1 })}>Next</a>
        )}
      </nav>
      <ExportLinks filters={current} />
      <details className="card my-6">
        <summary className="cursor-pointer font-bold">Catalogue import</summary>
        <ImportForm />
      </details>
    </>
  );
}
