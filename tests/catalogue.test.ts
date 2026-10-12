import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import AdmZip from "adm-zip";
import {
  inspectWorkbook,
  inspectImageArchive,
  matchImages,
  approvedCorrectionsFor,
} from "../lib/import";
import { bookingTotals } from "../lib/booking-pricing";
import { parseCfaPrice, money } from "../lib/validation";

describe("real exhibition files", () => {
  it("reads all sheets, preserves exact source text and prices, and reports every blank price", async () => {
    const buffer = await readFile(
      "catalogue-source/Exhibition Product List.xlsx",
    );
    const report = await inspectWorkbook(buffer);
    expect(report.products).toHaveLength(220);
    expect(new Set(report.products.map((p) => p.category)).size).toBe(6);
    expect(report.products.filter((p) => p.priceCfa === null)).toHaveLength(14);
    expect(report.malformedRows).toEqual([]);
    expect(report.invalidPrices).toEqual([]);
    expect(report.duplicateProductCodes).toEqual([]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
    );
    for (const sheet of workbook.worksheets)
      for (let row = 2; row <= sheet.rowCount; row++) {
        const source = sheet.getRow(row);
        const p = report.products.find(
          (p) => p.code === source.getCell(1).text,
        )!;
        expect(p.name).toBe(source.getCell(2).text);
        expect(p.category).toBe(sheet.name);
        expect(p.priceCfa).toBe(parseCfaPrice(source.getCell(3).text));
      }
  });
  it("applies only the two explicitly approved filename corrections to this exact ZIP", async () => {
    const [excel, zip] = await Promise.all([
      readFile("catalogue-source/Exhibition Product List.xlsx"),
      readFile("catalogue-source/Pictures.zip"),
    ]);
    const products = (await inspectWorkbook(excel)).products;
    const images = inspectImageArchive(zip);
    const raw = matchImages(products, images);
    expect(raw.missingImages).toEqual(["TI-049"]);
    expect(raw.unmatchedImages).toEqual([
      "Pictures/Trauma Implants/TI-051.jpeg",
    ]);
    const corrected = matchImages(
      products,
      images,
      approvedCorrectionsFor(zip),
    );
    expect(corrected.matched).toHaveLength(220);
    expect(corrected.missingImages).toEqual([]);
    expect(corrected.unmatchedImages).toEqual([]);
    expect(corrected.matched.find((i) => i.code === "TI-049")?.filename).toBe(
      "TI-050.jpeg",
    );
    expect(corrected.matched.find((i) => i.code === "TI-050")?.filename).toBe(
      "TI-051.jpeg",
    );
    expect(approvedCorrectionsFor(Buffer.from("another archive"))).toEqual([]);
  });
});
describe("ambiguous and malformed source data", () => {
  it("reports duplicates across worksheets, malformed rows and invalid prices together", async () => {
    const w = new ExcelJS.Workbook();
    for (const category of ["A", "B"]) {
      const s = w.addWorksheet(category);
      s.addRow(["Code", "Product Name", "Price CFA"]);
      s.addRow(["DUP", "Same code", 10]);
    }
    w.worksheets[0].addRow(["BAD", "Invalid price", -1]);
    w.worksheets[0].addRow(["EMPTY", "", 2]);
    const report = await inspectWorkbook(
      Buffer.from(await w.xlsx.writeBuffer()),
    );
    expect(report.duplicateProductCodes[0].code).toBe("DUP");
    expect(report.invalidPrices[0].code).toBe("BAD");
    expect(report.malformedRows[0].code).toBe("EMPTY");
  });
  it("does not guess when two filenames match the same product code", () => {
    const zip = new AdmZip();
    const jpeg = Buffer.from([255, 216, 255, 0]);
    zip.addFile("a/P1.jpg", jpeg);
    zip.addFile("b/P1.jpg", jpeg);
    zip.addFile("P2.jpeg", jpeg);
    zip.addFile("P2.jpg", jpeg);
    const report = inspectImageArchive(zip.toBuffer());
    expect(report.duplicateImageFilenames).toHaveLength(1);
    expect(report.ambiguousImageCodes).toHaveLength(2);
    expect(
      matchImages([{ code: "P1" }, { code: "P2" }], report).matched,
    ).toHaveLength(0);
  });
});
describe("CFA bookings with unpriced products", () => {
  it("keeps blank prices unknown and separate from genuinely free products", () => {
    expect(parseCfaPrice("")).toBeNull();
    expect(parseCfaPrice(0)).toBe("0.00");
    expect(money(null)).toBe("Price on Request");
    expect(money("8000.00")).toBe("8,000 CFA");
  });
  it("stores an exact priced subtotal and an unknown full total for mixed bookings", () => {
    expect(
      bookingTotals([
        { unitPriceCfa: "8000.00", quantity: 2 },
        { unitPriceCfa: null, quantity: 3 },
      ]),
    ).toEqual({ pricedSubtotalCfa: "16000.00", totalCfa: null });
    expect(bookingTotals([{ unitPriceCfa: "0.01", quantity: 3 }])).toEqual({
      pricedSubtotalCfa: "0.03",
      totalCfa: "0.03",
    });
    expect(bookingTotals([{ unitPriceCfa: null, quantity: 1 }])).toEqual({
      pricedSubtotalCfa: "0.00",
      totalCfa: null,
    });
  });
});
