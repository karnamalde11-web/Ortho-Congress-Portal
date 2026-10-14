import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/security";
import {
  parseBookingFilters,
  bookingParams,
  stockFilters,
  statusLabels,
  type FilterParams,
} from "@/lib/booking-filters";
import { stockReport, bookingCountries } from "@/lib/booking-management";
import BookingFilterForm from "../booking-filters";
export const dynamic = "force-dynamic";
export default async function Stock({
  searchParams,
}: {
  searchParams: Promise<FilterParams>;
}) {
  try {
    await requireAdmin();
  } catch {
    redirect("/admin/login");
  }
  const filters = stockFilters(parseBookingFilters(await searchParams));
  const [rows, countries] = await Promise.all([
    stockReport(filters),
    bookingCountries(),
  ]);
  const p = bookingParams(filters);
  const exportLink = (format: string) => {
    const parameters = new URLSearchParams(p);
    parameters.set("kind", "stock");
    parameters.set("format", format);
    return `/api/admin/exports?${parameters}`;
  };
  return (
    <>
      <a href="/admin">← Back to Bookings</a>
      <h1 className="my-4">Product-wise stock requirements</h1>
      <p>
        Stock planning includes active bookings. Cancelled bookings are
        excluded, including when All is selected. Selecting Cancelled explicitly
        shows historical cancelled demand.
      </p>
      <BookingFilterForm
        filters={filters}
        countries={countries}
        action="/admin/stock"
        showSort={false}
      />
      {filters.errors.length > 0 && (
        <p role="alert" className="my-4 text-red-700">
          {filters.errors.join(" ")}
        </p>
      )}
      <div className="my-4 flex flex-wrap items-center justify-between gap-4">
        <p>
          {statusLabels[filters.status]} · {rows.length} products ·{" "}
          {rows.reduce((sum, row) => sum + row.quantity, 0)} units
        </p>
        <div className="flex gap-4">
          <a href={exportLink("csv")}>Export stock requirements (CSV)</a>
          <a href={exportLink("xlsx")}>Export stock requirements (XLSX)</a>
        </div>
      </div>
      <div
        className="overflow-x-auto rounded-xl border border-slate-200 bg-white"
        tabIndex={0}
        aria-label="Scrollable stock requirements table"
      >
        <table
          className="booking-table w-full text-left text-sm"
          aria-label="Product requirements"
        >
          <thead className="bg-slate-100">
            <tr>
              {[
                "Product Code",
                "Product Name",
                "Category",
                "Number of Bookings",
                "Total Quantity Pre-Booked",
              ].map((label) => (
                <th scope="col" className="p-3" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.productId}:${row.code}`}
                className="border-b border-slate-200"
              >
                <td className="whitespace-nowrap p-3">{row.code}</td>
                <td className="min-w-48 p-3">{row.name}</td>
                <td className="p-3">{row.category}</td>
                <td className="p-3">{row.bookings}</td>
                <td className="p-3">{row.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="p-6">No product demand matches these filters.</p>
        )}
      </div>
    </>
  );
}
