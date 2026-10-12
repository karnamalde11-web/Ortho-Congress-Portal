import sharp from "sharp";
import { createHash } from "node:crypto";
import filenameCorrections from "../catalogue-source/image-corrections.json";
import ExcelJS from "exceljs";
import AdmZip from "adm-zip";
import { productSchema, parseCfaPrice } from "./validation";
import type { z } from "zod";
export type CatalogueProduct = z.infer<typeof productSchema>;
export type RowIssue = {
  sheet: string;
  row: number;
  code: string;
  reason: string;
};
export type WorkbookReport = {
  products: CatalogueProduct[];
  malformedRows: RowIssue[];
  invalidPrices: RowIssue[];
  duplicateProductCodes: { code: string; locations: string[] }[];
  emptyRows: number;
};
function archive(buffer: Buffer) {
  if (buffer.length > 20 * 1024 * 1024) throw new Error("Upload exceeds 20 MB");
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  if (
    entries.length > 2000 ||
    entries.reduce((n, e) => n + e.header.size, 0) > 100 * 1024 * 1024
  )
    throw new Error("Archive expands beyond the allowed limit");
  return zip;
}
export async function inspectWorkbook(buffer: Buffer): Promise<WorkbookReport> {
  archive(buffer);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  const report: WorkbookReport = {
    products: [],
    malformedRows: [],
    invalidPrices: [],
    duplicateProductCodes: [],
    emptyRows: 0,
  };
  const occurrences = new Map<string, string[]>();
  let rowCount = 0;
  for (const sheet of workbook.worksheets) {
    const header = sheet.getRow(1);
    const labels = [1, 2, 3, 4, 5].map((n) => header.getCell(n).text);
    const exhibition =
      labels[0] === "Code" &&
      labels[1] === "Product Name" &&
      ["Price CFA", "Prices CFA"].includes(labels[2]);
    const legacy = labels.join("|") === "SKU|Name|Category|Description|Price";
    if (!exhibition && !legacy) {
      report.malformedRows.push({
        sheet: sheet.name,
        row: 1,
        code: "",
        reason:
          "Expected Code, Product Name, Price CFA (or Prices CFA) headers",
      });
      continue;
    }
    for (let n = 2; n <= sheet.rowCount; n++) {
      const row = sheet.getRow(n);
      const cols = exhibition ? 3 : 5;
      if (
        [1, 2, 3, 4, 5].every(
          (c) => row.getCell(c).value === null || row.getCell(c).text === "",
        )
      ) {
        report.emptyRows++;
        continue;
      }
      if (++rowCount > 5000)
        throw new Error("Workbook exceeds 5000 product rows");
      const code = row.getCell(1).text;
      const location = `${sheet.name}:${n}`;
      occurrences.set(code, [...(occurrences.get(code) || []), location]);
      const issue = (reason: string) => ({
        sheet: sheet.name,
        row: n,
        code,
        reason,
      });
      if (
        Array.from({ length: cols }, (_, i) => row.getCell(i + 1)).some(
          (c) => c.type === ExcelJS.ValueType.Formula,
        )
      ) {
        report.malformedRows.push(issue("Excel formulas are not supported"));
        continue;
      }
      let priceCfa: string | null;
      try {
        priceCfa = parseCfaPrice(row.getCell(exhibition ? 3 : 5).text);
      } catch (e) {
        report.invalidPrices.push(
          issue(e instanceof Error ? e.message : "Invalid price"),
        );
        continue;
      }
      const parsed = productSchema.safeParse({
        code,
        name: row.getCell(2).text,
        category: exhibition ? sheet.name : row.getCell(3).text,
        description: exhibition ? "" : row.getCell(4).text,
        priceCfa,
      });
      if (!parsed.success) {
        report.malformedRows.push(
          issue(
            parsed.error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; "),
          ),
        );
        continue;
      }
      report.products.push(parsed.data);
    }
  }
  for (const [code, locations] of occurrences)
    if (locations.length > 1)
      report.duplicateProductCodes.push({ code, locations });
  if (!workbook.worksheets.length)
    report.malformedRows.push({
      sheet: "",
      row: 0,
      code: "",
      reason: "Workbook has no worksheets",
    });
  return report;
}
export async function parseExcel(buffer: Buffer) {
  const report = await inspectWorkbook(buffer);
  if (report.duplicateProductCodes.length)
    throw new Error(
      `Duplicate product codes: ${report.duplicateProductCodes.map((x) => x.code).join(", ")}`,
    );
  if (report.malformedRows.length || report.invalidPrices.length)
    throw new Error(
      [...report.malformedRows, ...report.invalidPrices]
        .map((i) => `${i.sheet} row ${i.row}: ${i.reason}`)
        .join("; "),
    );
  if (!report.products.length) throw new Error("No products found");
  return report.products;
}
export type SourceImage = {
  code: string;
  filename: string;
  path: string;
  data: Buffer;
  type: string;
  ext: string;
};
export function inspectImageArchive(buffer: Buffer) {
  const zip = archive(buffer);
  const images: SourceImage[] = [];
  const invalidImageFiles: { path: string; reason: string }[] = [];
  const nonImageFiles: string[] = [];
  const names = new Map<string, string[]>();
  const stems = new Map<string, string[]>();
  for (const e of zip.getEntries()) {
    if (
      e.isDirectory ||
      e.entryName.startsWith("__MACOSX/") ||
      e.name.startsWith(".")
    )
      continue;
    names.set(e.name, [...(names.get(e.name) || []), e.entryName]);
    const match = e.name.match(/^(.+)\.(jpg|jpeg|png|webp)$/i);
    if (!match) {
      nonImageFiles.push(e.entryName);
      continue;
    }
    const code = match[1];
    stems.set(code, [...(stems.get(code) || []), e.entryName]);
    if (e.header.size > 5 * 1024 * 1024) {
      invalidImageFiles.push({
        path: e.entryName,
        reason: "Image exceeds 5 MB",
      });
      continue;
    }
    const data = e.getData();
    const ext = match[2].toLowerCase();
    const valid =
      ext === "png"
        ? data
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : ext === "webp"
          ? data.toString("ascii", 0, 4) === "RIFF" &&
            data.toString("ascii", 8, 12) === "WEBP"
          : data[0] === 255 && data[1] === 216 && data[2] === 255;
    if (!valid) {
      invalidImageFiles.push({
        path: e.entryName,
        reason: "Invalid image content",
      });
      continue;
    }
    images.push({
      code,
      filename: e.name,
      path: e.entryName,
      data,
      type:
        ext === "png"
          ? "image/png"
          : ext === "webp"
            ? "image/webp"
            : "image/jpeg",
      ext,
    });
  }
  const duplicateImageFilenames = [...names]
    .filter(([, paths]) => paths.length > 1)
    .map(([filename, paths]) => ({ filename, paths }));
  const ambiguousImageCodes = [...stems]
    .filter(([, paths]) => paths.length > 1)
    .map(([code, paths]) => ({ code, paths }));
  return {
    images,
    duplicateImageFilenames,
    ambiguousImageCodes,
    invalidImageFiles,
    nonImageFiles,
  };
}
export type ImageCorrection = { code: string; filename: string };
export function approvedCorrectionsFor(buffer: Buffer): ImageCorrection[] {
  return createHash("sha256").update(buffer).digest("hex") ===
    filenameCorrections.sourceZipSha256
    ? filenameCorrections.corrections
    : [];
}
export function matchImages(
  products: { code: string }[],
  source: ReturnType<typeof inspectImageArchive>,
  corrections: ImageCorrection[] = [],
) {
  const codes = new Set(products.map((p) => p.code));
  const ambiguous = new Set(source.ambiguousImageCodes.map((x) => x.code));
  const correctedCodes = new Set<string>();
  const usedPaths = new Set<string>();
  const corrected: SourceImage[] = [];
  for (const correction of corrections) {
    if (!codes.has(correction.code) || correctedCodes.has(correction.code))
      throw new Error(
        `Invalid or duplicate correction target: ${correction.code}`,
      );
    const candidates = source.images.filter(
      (i) => i.filename === correction.filename,
    );
    if (candidates.length !== 1)
      throw new Error(
        `Correction image is missing or ambiguous: ${correction.filename}`,
      );
    const image = candidates[0];
    if (usedPaths.has(image.path))
      throw new Error(`Correction reuses an image: ${image.path}`);
    correctedCodes.add(correction.code);
    usedPaths.add(image.path);
    corrected.push({ ...image, code: correction.code });
  }
  const matched = [
    ...source.images.filter(
      (i) =>
        codes.has(i.code) &&
        !ambiguous.has(i.code) &&
        !correctedCodes.has(i.code) &&
        !usedPaths.has(i.path),
    ),
    ...corrected,
  ];
  const assigned = new Set(matched.map((i) => i.code));
  const assignedPaths = new Set(matched.map((i) => i.path));
  return {
    matched,
    missingImages: products
      .filter((p) => !assigned.has(p.code))
      .map((p) => p.code),
    unmatchedImages: source.images
      .filter((i) => !assignedPaths.has(i.path) && !codes.has(i.code))
      .map((i) => i.path),
    appliedCorrections: corrections,
  };
}
export function parseImages(buffer: Buffer) {
  const source = inspectImageArchive(buffer);
  if (source.ambiguousImageCodes.length)
    throw new Error(
      `Duplicate image codes: ${source.ambiguousImageCodes.map((i) => i.code).join(", ")}`,
    );
  if (source.invalidImageFiles.length)
    throw new Error(
      source.invalidImageFiles.map((i) => `${i.path}: ${i.reason}`).join("; "),
    );
  if (source.nonImageFiles.length)
    throw new Error(
      `Unsupported image filenames: ${source.nonImageFiles.join(", ")}`,
    );
  if (!source.images.length) throw new Error("No images found");
  return source.images;
}
export async function normalizeImage(data: Buffer) {
  return sharp(data, { limitInputPixels: 25000000 })
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 85 })
    .toBuffer();
}
