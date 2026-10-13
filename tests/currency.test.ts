import { describe, expect, it } from "vitest";
import {
  currencyForCountry,
  displayMoney,
  recordedPricing,
  sellingPrice,
} from "../lib/currency";
import { bookingTotals, displayPricing } from "../lib/booking-pricing";
import { bookingSchema } from "../lib/validation";
import { COUNTRY_PRICING_POLICY } from "../lib/pricing-policy";

describe("country-only customer prices", () => {
  it("uses CFA for exactly the requested CFA-zone countries", () => {
    for (const country of [
      "Senegal",
      "Côte d’Ivoire",
      "Mali",
      "Benin",
      "Togo",
      "Niger",
      "Burkina Faso",
      "Guinea-Bissau",
      "Cameroon",
      "Gabon",
      "Chad",
      "Republic of the Congo",
      "Central African Republic",
      "Equatorial Guinea",
    ])
      expect(currencyForCountry(country)).toBe("CFA");
  });
  it("uses USD elsewhere, including similarly named non-CFA countries", () => {
    for (const country of [
      "India",
      "Ghana",
      "Guinea",
      "Liberia",
      "DR Congo",
      "Mauritania",
      "Nigeria",
      "United States",
      "United Kingdom",
      "South Africa",
    ])
      expect(currencyForCountry(country)).toBe("USD");
  });
  it("rounds nonnegative USD unit prices exactly to whole dollars", () => {
    for (const [cfa, usd] of [
      ["25000.00", "40.00"],
      ["8000.00", "13.00"],
      ["6500.00", "10.00"],
      ["312.49", "0.00"],
      ["312.50", "1.00"],
      ["937.50", "2.00"],
      ["9999999999.99", "16000000.00"],
    ])
      expect(sellingPrice(cfa, "USD")).toBe(usd);
    expect(sellingPrice("8000.00", "CFA")).toBe("8000.00");
  });
  it("formats selling prices and keeps Price on Request distinct from a rounded zero", () => {
    expect(displayMoney("25000.00", "CFA")).toBe("25,000 CFA");
    expect(displayMoney("40.00", "USD")).toBe("$40");
    expect(displayMoney("0.00", "USD")).toBe("$0");
    for (const currency of ["CFA", "USD"] as const) {
      expect(sellingPrice(null, currency)).toBeNull();
      expect(displayMoney(null, currency)).toBe("Price on Request");
    }
  });
  it("multiplies rounded USD units so displayed line items and subtotal agree", () => {
    expect(
      displayPricing(
        [
          { unitPriceCfa: "8000.00", quantity: 3 },
          { unitPriceCfa: "6500.00", quantity: 2 },
        ],
        "USD",
      ),
    ).toEqual({
      items: [
        { unitPriceDisplay: "13.00", lineSubtotalDisplay: "39.00" },
        { unitPriceDisplay: "10.00", lineSubtotalDisplay: "20.00" },
      ],
      pricedSubtotalDisplay: "59.00",
      totalDisplay: "59.00",
    });
    expect(
      displayPricing([{ unitPriceCfa: "25000.00", quantity: 5 }], "USD")
        .pricedSubtotalDisplay,
    ).toBe("200.00");
    expect(
      displayPricing([{ unitPriceCfa: "25000.00", quantity: 5 }], "CFA")
        .pricedSubtotalDisplay,
    ).toBe("125000.00");
  });
  it("preserves unknown full totals and separate priced subtotals in both currencies", () => {
    for (const currency of ["CFA", "USD"] as const) {
      const mixed = displayPricing(
        [
          { unitPriceCfa: "8000.00", quantity: 2 },
          { unitPriceCfa: null, quantity: 1 },
        ],
        currency,
      );
      expect(mixed.totalDisplay).toBeNull();
      expect(mixed.pricedSubtotalDisplay).toBe(
        currency === "USD" ? "26.00" : "16000.00",
      );
      expect(
        displayPricing([{ unitPriceCfa: null, quantity: 1 }], currency),
      ).toEqual({
        items: [{ unitPriceDisplay: null, lineSubtotalDisplay: null }],
        pricedSubtotalDisplay: "0.00",
        totalDisplay: null,
      });
    }
    expect(bookingTotals([{ unitPriceCfa: "8000.00", quantity: 2 }])).toEqual({
      pricedSubtotalCfa: "16000.00",
      totalCfa: "16000.00",
    });
  });
  it("uses stored history instead of repricing older bookings using today's country", () => {
    const amount = (value: string) => ({ toFixed: () => value });
    const historical = {
      currency: "CFA",
      pricedSubtotalCfa: amount("8000.00"),
      totalCfa: amount("8000.00"),
      pricedSubtotalDisplay: null,
      totalDisplay: null,
    };
    expect(recordedPricing(historical)).toEqual({
      currency: "CFA",
      pricedSubtotalDisplay: "8000.00",
      totalDisplay: "8000.00",
    });
    expect(
      recordedPricing({
        ...historical,
        currency: "USD",
        pricedSubtotalDisplay: amount("13.00"),
        totalDisplay: amount("13.00"),
      }),
    ).toEqual({
      currency: "USD",
      pricedSubtotalDisplay: "13.00",
      totalDisplay: "13.00",
    });
    expect(
      recordedPricing({
        ...historical,
        currency: "USD",
        pricedSubtotalDisplay: amount("0.00"),
        totalDisplay: null,
      }),
    ).toEqual({
      currency: "USD",
      pricedSubtotalDisplay: "0.00",
      totalDisplay: null,
    });
  });
  it("rejects customer-controlled currencies/prices and requests lacking current catalogue metadata", () => {
    const valid = {
      pricingPolicy: COUNTRY_PRICING_POLICY,
      requestKey: crypto.randomUUID(),
      doctorName: "Dr Currency",
      specialty: "Orthopaedic Surgeon",
      hospital: "Clinic",
      city: "Dakar",
      country: "Senegal",
      phoneCountryCode: "+1",
      phoneNationalNumber: "2025550130",
      items: [
        {
          productId: "p1",
          pricingVersion: "2026-10-13T00:00:00.000Z",
          quantity: 1,
        },
      ],
    };
    expect(bookingSchema.safeParse(valid).success).toBe(true);
    for (const data of [
      { ...valid, currency: "CFA" },
      { ...valid, pricedSubtotalDisplay: "1.00" },
      { ...valid, pricingPolicy: "old" },
      { ...valid, items: [{ productId: "p1", quantity: 1 }] },
    ])
      expect(bookingSchema.safeParse(data).success).toBe(false);
  });
});
