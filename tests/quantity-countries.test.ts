import { describe, expect, it } from "vitest";
import { countries, countryFromName } from "../lib/countries";
import { parseQuantityInput } from "../lib/quantity";
import { bookingSchema } from "../lib/validation";

describe("quantity entry", () => {
  it("keeps blank input blank while treating it as zero", () => {
    expect(parseQuantityInput("")).toEqual({ display: "", quantity: 0 });
    expect(parseQuantityInput("0")).toEqual({ display: "0", quantity: 0 });
  });
  it("normalizes directly typed whole numbers without leading zeros", () => {
    expect(parseQuantityInput("2")).toEqual({ display: "2", quantity: 2 });
    expect(parseQuantityInput("002")).toEqual({ display: "2", quantity: 2 });
    expect(parseQuantityInput("100")).toEqual({
      display: "100",
      quantity: 100,
    });
  });
  it("rejects negative numbers, fractions, exponents, invalid text and values beyond the booking limit", () => {
    for (const value of [
      "-1",
      "+2",
      "2.5",
      "1e2",
      "NaN",
      "invalid",
      "101",
      "999999999999999999999999999",
      " 2 ",
    ])
      expect(parseQuantityInput(value)).toBeNull();
  });
});
describe("standardized countries and independent WhatsApp codes", () => {
  it("provides every ISO country/territory and Kosovo with unique names", () => {
    expect(countries).toHaveLength(250);
    expect(new Set(countries.map((c) => c.code)).size).toBe(250);
    expect(new Set(countries.map((c) => c.name)).size).toBe(250);
    expect(countryFromName("Invented Country")).toBeUndefined();
    expect(countryFromName("Antarctica")?.callingCode).toBeNull();
  });
  it("suggests all requested country calling codes", () => {
    for (const [name, code] of [
      ["Senegal", "+221"],
      ["India", "+91"],
      ["Côte d’Ivoire", "+225"],
      ["Mali", "+223"],
      ["Ghana", "+233"],
      ["Cameroon", "+237"],
      ["DR Congo", "+243"],
      ["Benin", "+229"],
      ["Mauritania", "+222"],
      ["Guinea", "+224"],
      ["Liberia", "+231"],
    ])
      expect(countryFromName(name)?.callingCode).toBe(code);
  });
  it("accepts a valid manually overridden WhatsApp number and rejects arbitrary country names", () => {
    const booking = {
      requestKey: crypto.randomUUID(),
      doctorName: "Dr Test",
      specialty: "Trauma Surgeon",
      hospital: "Clinic",
      city: "Dakar",
      country: "Senegal",
      phoneCountryCode: "+1",
      phoneNationalNumber: "2025550123",
      items: [{ productId: "p1", quantity: 1 }],
    };
    expect(bookingSchema.safeParse(booking).success).toBe(true);
    expect(
      bookingSchema.safeParse({ ...booking, country: "My Country" }).success,
    ).toBe(false);
    expect(
      bookingSchema.safeParse({ ...booking, phoneNationalNumber: "123" })
        .success,
    ).toBe(false);
  });
});
