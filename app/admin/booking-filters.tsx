import {
  bookingParams,
  statusOptions,
  statusLabels,
  type BookingFilters,
} from "@/lib/booking-filters";
export default function BookingFilterForm({
  filters,
  countries,
  action = "/admin",
  showSort = true,
}: {
  filters: BookingFilters;
  countries: (string | null)[];
  action?: string;
  showSort?: boolean;
}) {
  return (
    <form
      action={action}
      method="get"
      className="my-4 grid gap-x-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6"
    >
      <label className="sm:col-span-2">
        Search bookings
        <input
          name="q"
          defaultValue={filters.q}
          placeholder="Reference, name, clinic, WhatsApp or email"
          maxLength={200}
        />
      </label>
      <label>
        Status
        <select aria-label="Status" name="status" defaultValue={filters.status}>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {statusLabels[status]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Country
        <select
          aria-label="Country"
          name="country"
          defaultValue={filters.country}
        >
          <option value="">All countries</option>
          {countries.map((country) => (
            <option
              key={country ?? "_NOT_RECORDED"}
              value={country ?? "_NOT_RECORDED"}
            >
              {country ?? "Not recorded (earlier bookings)"}
            </option>
          ))}
        </select>
      </label>
      <label>
        From date
        <input type="date" name="from" defaultValue={filters.from} />
      </label>
      <label>
        To date
        <input type="date" name="to" defaultValue={filters.to} />
      </label>
      {showSort && (
        <label>
          Sort by
          <select aria-label="Sort by" name="sort" defaultValue={filters.sort}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Customer name</option>
            <option value="value">Value: highest (CFA basis)</option>
          </select>
        </label>
      )}
      <div className="flex flex-wrap items-end gap-3 py-3 sm:col-span-2 lg:col-span-5">
        <button type="submit">Apply filters</button>
        <a href={action}>Reset filters</a>
        <p className="text-sm">
          Dates use IST.
          {showSort && " Value sorting uses the original CFA priced subtotal."}
        </p>
      </div>
    </form>
  );
}
export function BookingTabs({ filters }: { filters: BookingFilters }) {
  return (
    <nav
      aria-label="Booking status filters"
      className="my-4 flex flex-wrap gap-2"
    >
      {statusOptions.map((status) => {
        const p = bookingParams({ ...filters, status, page: 1 });
        return (
          <a
            key={status}
            href={`/admin?${p}`}
            aria-current={filters.status === status ? "page" : undefined}
            className={`rounded-full border px-3 py-2 text-sm no-underline ${filters.status === status ? "border-teal-700 bg-teal-700 text-white" : "border-slate-300 bg-white"}`}
          >
            {statusLabels[status]}
          </a>
        );
      })}
    </nav>
  );
}
export function ExportLinks({ filters }: { filters: BookingFilters }) {
  const current = bookingParams(filters);
  const link = (kind: string, format: string, all = false) => {
    const p = all
      ? new URLSearchParams({ status: "ACTIVE", sort: "newest" })
      : new URLSearchParams(current);
    p.set("kind", kind);
    p.set("format", format);
    return `/api/admin/exports?${p}`;
  };
  return (
    <section className="card my-4" aria-label="Export reports">
      <h2>Export reports</h2>
      <p className="my-2 text-sm">
        Filtered exports include all matching bookings across every page. Prices
        use the currency recorded at submission.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <h3 className="font-bold">Current filtered bookings</h3>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
            {(["csv", "xlsx"] as const).map((format) => (
              <a key={format} href={link("summary", format)}>
                Summary ({format.toUpperCase()})
              </a>
            ))}
            {(["csv", "xlsx"] as const).map((format) => (
              <a key={format} href={link("items", format)}>
                Booking items ({format.toUpperCase()})
              </a>
            ))}
          </div>
        </div>
        <div>
          <h3 className="font-bold">All active bookings</h3>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
            {(["csv", "xlsx"] as const).map((format) => (
              <a key={format} href={link("summary", format, true)}>
                Export All Active Bookings ({format.toUpperCase()})
              </a>
            ))}
          </div>
          <p className="mt-2 text-sm">
            Includes every active booking; clears search, country and date
            filters.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-4">
        <a href={`/admin/stock?${current}`}>
          View product-wise stock requirements
        </a>
        <a href={link("stock", "csv")}>Stock requirements (CSV)</a>
        <a href={link("stock", "xlsx")}>Stock requirements (XLSX)</a>
      </div>
      <p className="mt-2 text-sm">
        Stock reports exclude Cancelled even under All. Choose Cancelled
        explicitly to report historical cancelled demand.
      </p>
    </section>
  );
}
