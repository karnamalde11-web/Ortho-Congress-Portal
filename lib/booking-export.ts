import type { Prisma } from "@prisma/client";
import { bookingReference } from "./booking-reference";
import { recordedPricing } from "./currency";
import { adminDate } from "./booking-filters";
export type ExportCell = string | number | null;
export type ExportKind = "summary" | "items" | "stock";
export const exportHeaders: Record<ExportKind, string[]> = {
  summary: [
    "Reference",
    "Submission Date (IST)",
    "Name",
    "Specialty",
    "Hospital / Clinic",
    "City",
    "Country",
    "WhatsApp",
    "Email",
    "Number of Products",
    "Currency",
    "Priced Subtotal",
    "Contains Price on Request",
    "Status",
    "Remarks",
  ],
  items: [
    "Booking Reference",
    "Customer Name",
    "Country",
    "Product Code",
    "Product Name",
    "Category",
    "Quantity",
    "Unit Price",
    "Currency",
    "Subtotal",
    "Price on Request",
    "Booking Status",
  ],
  stock: [
    "Product Code",
    "Product Name",
    "Category",
    "Number of Bookings",
    "Total Quantity Pre-Booked",
  ],
};
export type ExportBooking = Prisma.BookingGetPayload<{
  include: { items: true };
}>;
export function bookingExportRows(
  booking: ExportBooking,
  kind: "summary" | "items",
): ExportCell[][] {
  const pricing = recordedPricing(booking);
  const snapshot = booking.pricedSubtotalDisplay !== null;
  const reference = bookingReference(booking.id, booking.createdAt);
  if (kind === "summary")
    return [
      [
        reference,
        adminDate(booking.createdAt),
        booking.doctorName,
        booking.specialty === "Other"
          ? `Other: ${booking.specialtyOther ?? "Not recorded"}`
          : (booking.specialty ?? ""),
        booking.hospital,
        booking.city ?? "",
        booking.country ?? "",
        booking.phone,
        booking.email ?? "",
        booking.items.length,
        pricing.currency,
        Number(pricing.pricedSubtotalDisplay),
        booking.items.some((i) => i.unitPriceCfa === null) ? "Yes" : "No",
        booking.status,
        booking.notes,
      ],
    ];
  return booking.items.map((item) => {
    const unit = snapshot ? item.unitPriceDisplay : item.unitPriceCfa;
    const subtotal = snapshot
      ? item.lineSubtotalDisplay
      : item.unitPriceCfa?.mul(item.quantity);
    return [
      reference,
      booking.doctorName,
      booking.country ?? "",
      item.code,
      item.name,
      item.category,
      item.quantity,
      unit?.toNumber() ?? null,
      pricing.currency,
      subtotal?.toNumber() ?? null,
      unit === null ? "Yes" : "No",
      booking.status,
    ];
  });
}
export function csvLine(cells: ExportCell[]) {
  return (
    cells
      .map((cell) => {
        let value = cell === null ? "" : String(cell);
        if (
          typeof cell === "string" &&
          (/^[\s]*[=+\-@]/.test(value) || /^[\t\r\n]/.test(value))
        )
          value = `'${value}`;
        return `"${value.replace(/"/g, '""')}"`;
      })
      .join(",") + "\r\n"
  );
}
