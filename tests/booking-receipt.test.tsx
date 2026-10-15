import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { renderToStaticMarkup } from "react-dom/server";
import { bookingReceipt } from "../lib/booking-receipt";
import BookingReceipt from "../app/booking-receipt";
const decimal = (value: number) => new Prisma.Decimal(value);
function savedBooking(
  currency: "CFA" | "USD",
  mode: "priced" | "mixed" | "request",
) {
  const unit = currency === "USD" ? 13 : 8000;
  const lines =
    mode === "priced"
      ? [false]
      : mode === "mixed"
        ? [false, true, true]
        : [true, true];
  const items = lines.map((por, index) => ({
    id: `line-${index}`,
    bookingId: "saved-booking",
    productId: `product-${index}`,
    code: `CODE-${index}`,
    name: `Saved product ${index}`,
    category: "Saved category",
    quantity: 3,
    unitPriceCfa: por ? null : decimal(8000),
    unitPriceDisplay: por ? null : decimal(unit),
    lineSubtotalDisplay: por ? null : decimal(unit * 3),
  }));
  return {
    id: "saved-booking",
    requestKey: "saved-key",
    doctorName: "Test Customer",
    phone: "+12025550123",
    phoneCountryCode: "+1",
    phoneNationalNumber: "2025550123",
    specialty: "Other",
    specialtyOther: "Research",
    hospital: "Test Clinic",
    city: "Dakar",
    country: currency === "CFA" ? "Senegal" : "India",
    email: null,
    notes: "Private admin notes must not be in a public receipt",
    consentAt: new Date("2026-10-15T08:00:00Z"),
    createdAt: new Date("2026-10-15T08:00:00Z"),
    status: "NEW" as const,
    currency,
    pricedSubtotalCfa: decimal(mode === "request" ? 0 : 24000),
    totalCfa: mode === "priced" ? decimal(24000) : null,
    pricedSubtotalDisplay: decimal(mode === "request" ? 0 : unit * 3),
    totalDisplay: mode === "priced" ? decimal(unit * 3) : null,
    items,
  };
}
describe("saved booking receipts", () => {
  for (const currency of ["CFA", "USD"] as const)
    for (const mode of ["priced", "mixed", "request"] as const)
      it(`${currency} ${mode} has clear totals and the correct saved products`, () => {
        const saved = savedBooking(currency, mode);
        const receipt = bookingReceipt(saved);
        const html = renderToStaticMarkup(<BookingReceipt receipt={receipt} />);
        const amount = currency === "USD" ? "$39" : "24,000 CFA";
        if (mode === "priced") {
          expect(html).toContain("Total:");
          expect(html).toContain(amount);
          expect(html).not.toContain("Price on Request");
          expect(html).not.toContain("The final amount");
        } else if (mode === "mixed") {
          expect(html).toContain("Confirmed priced items:");
          expect(html).toContain(
            `${amount} + price of the Price on Request item(s)`,
          );
          expect(html).toContain("2 items");
          expect(html).toContain(
            "The final amount will be confirmed by our team",
          );
          expect(receipt.priceOnRequestCount).toBe(2); // Products, not the six units.
        } else {
          expect(html).toContain("Final total:");
          expect(html).toContain("On Request");
          expect(html).not.toContain("0 CFA");
          expect(html).not.toContain("$0");
          expect(html).toContain(
            "Our team will confirm the prices of the selected products with you.",
          );
        }
        expect(receipt.items[0].quantity).toBe(3);
        expect(html).toContain("Saved product 0");
        expect(html).toContain("CODE-0");
        expect(html).toContain("+12025550123");
        expect(html).toContain("Other: Research");
        expect(html).not.toContain("Private admin notes");
        expect(html).not.toMatch(/exchange rate|conversion|625/);
      });
  it("does not reprice a saved booking from its current country or product", () => {
    const saved = savedBooking("CFA", "priced");
    saved.country = "India";
    const receipt = bookingReceipt(saved);
    expect(receipt.currency).toBe("CFA");
    expect(receipt.items[0]).toMatchObject({
      code: "CODE-0",
      name: "Saved product 0",
      unitPrice: "8000.00",
      lineTotal: "24000.00",
    });
    expect(receipt).not.toHaveProperty("notes");
    expect(receipt).not.toHaveProperty("requestKey");
  });
  it("preserves earlier CFA unit snapshots and handles optional customer details", () => {
    const saved = {
      ...savedBooking("USD", "priced"),
      pricedSubtotalDisplay: null,
      totalDisplay: null,
      specialty: null,
      specialtyOther: null,
      city: null,
      country: null,
      email: "customer@example.invalid",
    };
    const receipt = bookingReceipt(saved);
    expect(receipt.currency).toBe("CFA");
    expect(receipt.items[0]).toMatchObject({
      unitPrice: "8000.00",
      lineTotal: "24000.00",
    });
    expect(receipt.totalDisplay).toBe("24000.00");
    expect(receipt.specialty).toContain("earlier booking");
    expect(
      renderToStaticMarkup(<BookingReceipt receipt={receipt} />),
    ).toContain("customer@example.invalid");
  });
});
