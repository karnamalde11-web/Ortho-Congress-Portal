import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import {
  parseBookingFilters,
  dateBounds,
  safeBookingBack,
  stockFilters,
  referenceSearch,
} from "../lib/booking-filters";
import { bookingWhere, bookingWhereSql } from "../lib/booking-management";
import {
  bookingExportRows,
  csvLine,
  type ExportBooking,
} from "../lib/booking-export";
const parse = (values: Record<string, string | undefined> = {}) =>
  parseBookingFilters(values);
describe("booking management filters and historical exports", () => {
  it("defaults to active, allows explicit cancelled/all, and does not widen invalid filters", () => {
    expect(bookingWhere(parse()).status).toEqual({ not: "CANCELLED" });
    expect(bookingWhere(parse({ status: "CANCELLED" })).status).toBe(
      "CANCELLED",
    );
    expect(bookingWhere(parse({ status: "ALL" })).status).toBeUndefined();
    expect(bookingWhere(parse({ status: "INVALID" }))).toEqual({
      id: { in: [] },
    });
    expect(stockFilters(parse({ status: "ALL" })).status).toBe("ACTIVE");
    expect(stockFilters(parse({ status: "CANCELLED" })).status).toBe(
      "CANCELLED",
    );
  });
  it("uses inclusive IST calendar dates, validates impossible/reversed ranges and caps pagination", () => {
    expect(dateBounds(parse({ from: "2026-01-01", to: "2026-01-02" }))).toEqual(
      {
        gte: new Date("2025-12-31T18:30:00Z"),
        lt: new Date("2026-01-02T18:30:00Z"),
      },
    );
    for (const values of [
      { from: "2026-02-30" },
      { from: "2026-03-03", to: "2026-03-01" },
      { to: "not-a-date" },
    ])
      expect(parse(values).errors.length).toBeGreaterThan(0);
    expect(parse({ page: "3.9" }).page).toBe(3);
    expect(parse({ page: "999999999" }).page).toBe(100000);
  });
  it("handles complete references and treats wildcard/search values as parameters", () => {
    const ref = referenceSearch("nm-2026-booking-id");
    expect(ref?.id).toBe("booking-id");
    expect(ref?.start).toEqual(new Date("2026-01-01T00:00:00Z"));
    const sql = bookingWhereSql(
      parse({ q: "100%_\\'; DROP TABLE Booking; --" }),
    );
    expect(sql.sql).not.toContain("DROP TABLE");
    expect(sql.values.some((v) => String(v).includes("\\%\\_\\\\"))).toBe(true);
  });
  it("only permits return links to the booking list", () => {
    for (const input of [
      "https://example.com",
      "//example.com",
      "/admin/login",
      "/api/admin/exports",
    ])
      expect(safeBookingBack(input)).toBe("/admin");
    expect(
      safeBookingBack("/admin?status=CANCELLED&q=Doctor&page=2"),
    ).toContain("status=CANCELLED");
  });
  it("protects CSV spreadsheet formulas and keeps numbers numeric", () => {
    expect(
      csvLine(["=1+1", "+221771234567", " @SUM(A1)", -1, 'a"b\nc', null]),
    ).toBe('"\'=1+1","\'+221771234567","\' @SUM(A1)","-1","a""b\nc",""\r\n');
  });
  it("exports recorded USD/CFA snapshots and preserves Price on Request without recalculating historical prices", () => {
    const decimal = (value: number) => new Prisma.Decimal(value);
    const booking = {
      id: "booking",
      createdAt: new Date("2026-01-01T12:00:00Z"),
      doctorName: "Doctor",
      hospital: "Clinic",
      phone: "+12025550123",
      country: "India",
      currency: "USD",
      pricedSubtotalCfa: decimal(16000),
      totalCfa: null,
      pricedSubtotalDisplay: decimal(26),
      totalDisplay: null,
      status: "NEW",
      notes: "Notes",
      specialty: "Other",
      specialtyOther: "Research",
      city: "City",
      email: null,
      items: [
        {
          code: "A",
          name: "Product A",
          category: "Trauma",
          quantity: 2,
          unitPriceCfa: decimal(8000),
          unitPriceDisplay: decimal(13),
          lineSubtotalDisplay: decimal(26),
        },
        {
          code: "B",
          name: "Product B",
          category: "Instruments",
          quantity: 1,
          unitPriceCfa: null,
          unitPriceDisplay: null,
          lineSubtotalDisplay: null,
        },
      ],
    } as unknown as ExportBooking;
    const summary = bookingExportRows(booking, "summary")[0];
    expect(summary[10]).toBe("USD");
    expect(summary[11]).toBe(26);
    expect(summary[12]).toBe("Yes");
    const items = bookingExportRows(booking, "items");
    expect(items[0].slice(6, 11)).toEqual([2, 13, "USD", 26, "No"]);
    expect(items[1].slice(6, 11)).toEqual([1, null, "USD", null, "Yes"]);
    const legacy = {
      ...booking,
      pricedSubtotalDisplay: null,
      totalDisplay: null,
      currency: "CFA",
    };
    expect(bookingExportRows(legacy, "summary")[0][11]).toBe(16000);
    expect(bookingExportRows(legacy, "items")[0].slice(6, 10)).toEqual([
      2,
      8000,
      "CFA",
      16000,
    ]);
  });
});
