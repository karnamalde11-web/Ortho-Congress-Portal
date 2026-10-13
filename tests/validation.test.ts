import { COUNTRY_PRICING_POLICY } from "../lib/pricing-policy";
import { describe, it, expect } from "vitest";
import { bookingSchema, parseCfaPrice } from "../lib/validation";
import { parseExcel, parseImages } from "../lib/import";
import ExcelJS from "exceljs";
import AdmZip from "adm-zip";
const valid = {
  pricingPolicy: COUNTRY_PRICING_POLICY,
  requestKey: "41fe6367-5da7-483e-a96b-91aba60c5fe3",
  doctorName: "Dr Test",
  phoneCountryCode: "+221",
  phoneNationalNumber: "77 123 45 67",
  specialty: "Orthopaedic Surgeon",
  city: "Dakar",
  country: "Senegal",
  hospital: "Clinic",
  items: [
    {
      productId: "p1",
      pricingVersion: "2026-10-13T00:00:00.000Z",
      quantity: 2,
    },
  ],
};
describe("booking validation", () => {
  it("accepts a legitimate pre-booking", () =>
    expect(bookingSchema.safeParse(valid).success).toBe(true));
  it("accepts optional email and a typed specialty and normalizes international numbers", async () => {
    const { normalizeWhatsApp } = await import("../lib/phone");
    expect(
      bookingSchema.safeParse({
        ...valid,
        specialty: "Other",
        specialtyOther: "Medical researcher",
        email: "",
      }).success,
    ).toBe(true);
    expect(normalizeWhatsApp("+221", "77 123 45 67")).toEqual({
      phone: "+221771234567",
      phoneCountryCode: "+221",
      phoneNationalNumber: "771234567",
    });
    expect(normalizeWhatsApp("+44", "07911 123456")?.phone).toBe(
      "+447911123456",
    );
    expect(normalizeWhatsApp("+221", "+221771234567")).toBeNull();
  });
  it("keeps readable references stable without changing or shortening IDs", async () => {
    const { bookingReference } = await import("../lib/booking-reference");
    expect(bookingReference("legacy-full-id", "2026-10-12T12:00:00Z")).toBe(
      "NM-2026-legacy-full-id",
    );
  });
  it("rejects client-supplied prices", () =>
    expect(
      bookingSchema.safeParse({
        ...valid,
        items: [
          {
            productId: "p1",
            pricingVersion: "2026-10-13T00:00:00.000Z",
            quantity: 2,
            price: 1,
          },
        ],
      }).success,
    ).toBe(false));
  it("rejects duplicates, invalid quantities and missing required details", () => {
    for (const data of [
      { ...valid, items: [valid.items[0], valid.items[0]] },
      {
        ...valid,
        items: [
          {
            productId: "p1",
            pricingVersion: "2026-10-13T00:00:00.000Z",
            quantity: 0,
          },
        ],
      },
      { ...valid, city: "" },
      { ...valid, country: "" },
      { ...valid, specialty: "Other", specialtyOther: "" },
      { ...valid, phoneNationalNumber: "123" },
      { ...valid, phoneCountryCode: "+999" },
      { ...valid, doctorName: "  " },
      { ...valid, hospital: " " },
      { ...valid, email: "invalid" },
    ])
      expect(bookingSchema.safeParse(data).success).toBe(false);
  });
  it("preserves CFA prices exactly and rejects invalid decimals", () => {
    expect(parseCfaPrice("123.45")).toBe("123.45");
    expect(parseCfaPrice("0.01")).toBe("0.01");
    for (const v of ["-1", "1.234", "NaN"])
      expect(() => parseCfaPrice(v)).toThrow();
  });
});
describe("imports", () => {
  it("imports a valid workbook and rejects duplicate SKUs", async () => {
    const w = new ExcelJS.Workbook();
    const s = w.addWorksheet("Products");
    s.addRow(["SKU", "Name", "Category", "Description", "Price"]);
    s.addRow(["ABC", "Implant", "Trauma", "Test", 123.45]);
    expect(await parseExcel(Buffer.from(await w.xlsx.writeBuffer()))).toEqual([
      {
        code: "ABC",
        name: "Implant",
        category: "Trauma",
        description: "Test",
        priceCfa: "123.45",
      },
    ]);
    s.addRow(["ABC", "Duplicate", "Trauma", "", 100]);
    await expect(
      parseExcel(Buffer.from(await w.xlsx.writeBuffer())),
    ).rejects.toThrow("Duplicate");
  });
  it("rejects formulas and misleading image types", async () => {
    const w = new ExcelJS.Workbook();
    const s = w.addWorksheet("Products");
    s.addRow(["SKU", "Name", "Category", "Description", "Price"]);
    s.addRow(["ABC", "Implant", "Trauma", "", { formula: "1+1", result: 2 }]);
    await expect(
      parseExcel(Buffer.from(await w.xlsx.writeBuffer())),
    ).rejects.toThrow("formulas");
    const zip = new AdmZip();
    zip.addFile("ABC.jpg", Buffer.from("<script>bad</script>"));
    expect(() => parseImages(zip.toBuffer())).toThrow("Invalid image");
  });
});

describe("image processing", () => {
  it("decodes valid images, strips metadata and bounds their dimensions", async () => {
    const sharp = (await import("sharp")).default;
    const { normalizeImage } = await import("../lib/import");
    const source = await sharp({
      create: { width: 2000, height: 1000, channels: 3, background: "#ffffff" },
    })
      .png()
      .toBuffer();
    const result = await normalizeImage(source);
    const metadata = await sharp(result).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(1600);
    expect(metadata.height).toBe(800);
    expect(metadata.exif).toBeUndefined();
  });
});

describe("bounded request bodies", () => {
  it("rejects oversized streamed bodies even without content-length", async () => {
    const { readLimitedBody } = await import("../lib/body");
    await expect(
      readLimitedBody(
        new Request("http://localhost", { method: "POST", body: "123456" }),
        5,
      ),
    ).rejects.toThrow("too large");
    expect(
      (
        await readLimitedBody(
          new Request("http://localhost", { method: "POST", body: "123" }),
          5,
        )
      ).toString(),
    ).toBe("123");
  });
});
