import type { BookingStatus } from "@prisma/client";
export const bookingStatuses = [
  "NEW",
  "CONTACTED",
  "QUOTATION_SENT",
  "INVOICE_SENT",
  "CONFIRMED",
  "PAID",
  "COLLECTED",
  "CANCELLED",
] as const;
export const statusOptions = ["ACTIVE", ...bookingStatuses, "ALL"] as const;
export const statusLabels: Record<(typeof statusOptions)[number], string> = {
  ACTIVE: "All Active",
  NEW: "New",
  CONTACTED: "Contacted",
  QUOTATION_SENT: "Quotation Sent",
  INVOICE_SENT: "Invoice Sent",
  CONFIRMED: "Confirmed",
  PAID: "Paid",
  COLLECTED: "Collected",
  CANCELLED: "Cancelled",
  ALL: "All",
};
export type BookingFilters = {
  status: (typeof statusOptions)[number];
  q: string;
  country: string;
  from: string;
  to: string;
  sort: "newest" | "oldest" | "name" | "value";
  page: number;
  errors: string[];
};
export type FilterParams = Record<string, string | string[] | undefined>;
export const PAGE_SIZE = 25;
const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1000)
    return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function parseBookingFilters(params: FilterParams): BookingFilters {
  const errors: string[] = [];
  const requested = first(params.status) || "ACTIVE";
  const status = statusOptions.find((s) => s === requested) ?? "ACTIVE";
  if (!statusOptions.includes(requested as typeof status))
    errors.push("Please choose a valid booking status.");
  const q = first(params.q).trim();
  const country = first(params.country).trim();
  const from = first(params.from);
  const to = first(params.to);
  if (q.length > 200) errors.push("Search must be 200 characters or fewer.");
  if (country.length > 120) errors.push("Please choose a valid country.");
  if ((from && !validDate(from)) || (to && !validDate(to)))
    errors.push("Please enter valid start and end dates.");
  else if (from && to && from > to)
    errors.push("The end date must be on or after the start date.");
  const requestedSort = first(params.sort);
  const sort =
    (["newest", "oldest", "name", "value"] as const).find(
      (s) => s === requestedSort,
    ) ?? "newest";
  const page = Math.max(
    1,
    Math.min(100000, Math.floor(Number(first(params.page)) || 1)),
  );
  return {
    status,
    q: q.slice(0, 200),
    country: country.slice(0, 120),
    from,
    to,
    sort,
    page,
    errors,
  };
}
export function dateBounds(filters: BookingFilters) {
  return {
    gte: filters.from ? new Date(`${filters.from}T00:00:00+05:30`) : undefined,
    lt: filters.to
      ? new Date(new Date(`${filters.to}T00:00:00+05:30`).getTime() + 86400000)
      : undefined,
  };
}
export function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}
export function referenceSearch(q: string) {
  const match = q.match(/^NM-(\d{4})(?:-(.*))?$/i);
  if (!match) return null;
  const year = Number(match[1]);
  if (year < 1000 || year >= 9999) return null;
  return {
    id: match[2] ?? "",
    start: new Date(`${match[1]}-01-01T00:00:00Z`),
    end: new Date(`${year + 1}-01-01T00:00:00Z`),
  };
}
export function bookingParams(filters: BookingFilters, includePage = false) {
  const p = new URLSearchParams({ status: filters.status, sort: filters.sort });
  for (const key of ["q", "country", "from", "to"] as const)
    if (filters[key]) p.set(key, filters[key]);
  if (includePage && filters.page > 1) p.set("page", String(filters.page));
  return p;
}
export function bookingListUrl(filters: BookingFilters) {
  return `/admin?${bookingParams(filters, true)}`;
}
export function safeBookingBack(value: string | undefined) {
  if (!value || value.length > 2000) return "/admin";
  try {
    const url = new URL(value, "https://local.invalid");
    if (url.origin !== "https://local.invalid" || url.pathname !== "/admin")
      return "/admin";
    return bookingListUrl(
      parseBookingFilters(Object.fromEntries(url.searchParams)),
    );
  } catch {
    return "/admin";
  }
}
export function stockFilters(filters: BookingFilters) {
  return {
    ...filters,
    status: filters.status === "ALL" ? "ACTIVE" : filters.status,
  } as BookingFilters;
}
export function isBookingStatus(value: string): value is BookingStatus {
  return bookingStatuses.some((s) => s === value);
}
export function adminDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}
