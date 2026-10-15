import type { Prisma } from "@prisma/client";
import { bookingReference } from "./booking-reference";
import { recordedPricing } from "./currency";

// Only the saved booking/items are accepted. No catalogue lookup or country
// conversion belongs in a receipt, including when an old request is retried.
export function bookingReceipt(
  booking: Prisma.BookingGetPayload<{ include: { items: true } }>,
) {
  const snapshot = booking.pricedSubtotalDisplay !== null;
  const items = booking.items.map((item) => ({
    code: item.code,
    name: item.name,
    quantity: item.quantity,
    unitPrice:
      (snapshot ? item.unitPriceDisplay : item.unitPriceCfa)?.toFixed(2) ??
      null,
    lineTotal:
      (snapshot
        ? item.lineSubtotalDisplay
        : item.unitPriceCfa?.mul(item.quantity)
      )?.toFixed(2) ?? null,
  }));
  const priceOnRequestCount = items.filter(
    (item) => item.unitPrice === null,
  ).length;
  return {
    id: booking.id,
    reference: bookingReference(booking.id, booking.createdAt),
    submittedAt: booking.createdAt.toISOString(),
    customerName: booking.doctorName,
    specialty:
      booking.specialty === "Other"
        ? `Other: ${booking.specialtyOther || "Not recorded"}`
        : booking.specialty || "Not recorded (earlier booking)",
    hospital: booking.hospital,
    city: booking.city || "Not recorded (earlier booking)",
    country: booking.country || "Not recorded (earlier booking)",
    phone: booking.phone,
    email: booking.email || null,
    selectedProductCount: items.length,
    hasPriceOnRequest: priceOnRequestCount > 0,
    priceOnRequestCount,
    pricedProductCount: items.length - priceOnRequestCount,
    ...recordedPricing(booking),
    items,
  };
}
export type BookingReceiptData = ReturnType<typeof bookingReceipt>;
