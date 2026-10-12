import "dotenv/config";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { db } from "../lib/db";
import {
  inspectWorkbook,
  inspectImageArchive,
  matchImages,
  normalizeImage,
  approvedCorrectionsFor,
} from "../lib/import";
import { upload, verifyObject } from "../lib/storage";
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const excelPath = args[0] || "catalogue-source/Exhibition Product List.xlsx";
const zipPath = args[1] || "catalogue-source/Pictures.zip";
const dryRun = process.argv.includes("--dry-run");
try {
  const workbook = await readFile(excelPath);
  const zip = await readFile(zipPath);
  const rows = await inspectWorkbook(workbook);
  const source = inspectImageArchive(zip);
  const rawMapping = matchImages(rows.products, source);
  const corrections = approvedCorrectionsFor(zip);
  const mapping = matchImages(rows.products, source, corrections);
  const report = {
    intentionalFilenameCorrections: mapping.appliedCorrections,
    beforeCorrections: {
      imagesMatched: rawMapping.matched.length,
      missingImages: rawMapping.missingImages,
      unmatchedImages: rawMapping.unmatchedImages,
    },
    source: {
      excel: excelPath,
      zip: zipPath,
      excelSha256: createHash("sha256").update(workbook).digest("hex"),
      zipSha256: createHash("sha256").update(zip).digest("hex"),
    },
    totalProducts: rows.products.length,
    totalCategories: new Set(rows.products.map((p) => p.category)).size,
    categories: [...new Set(rows.products.map((p) => p.category))].map(
      (category) => ({
        category,
        count: rows.products.filter((p) => p.category === category).length,
      }),
    ),
    imagesMatched: mapping.matched.length,
    missingImages: mapping.missingImages,
    unmatchedImages: mapping.unmatchedImages,
    priceOnRequest: rows.products
      .filter((p) => p.priceCfa === null)
      .map((p) => ({ code: p.code, name: p.name, category: p.category })),
    duplicateProductCodes: rows.duplicateProductCodes,
    duplicateImageFilenames: source.duplicateImageFilenames,
    ambiguousImageCodes: source.ambiguousImageCodes,
    malformedRows: rows.malformedRows,
    invalidPrices: rows.invalidPrices,
    invalidImageFiles: source.invalidImageFiles,
    nonImageFiles: source.nonImageFiles,
    emptyRows: rows.emptyRows,
    importedProducts: 0,
    uploadedImages: 0,
    storageVerified: false,
  };
  const reportPath = dryRun
    ? "docs/catalogue-inspection-report.json"
    : "docs/catalogue-import-report.json";
  await mkdir("docs", { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
  if (
    rows.malformedRows.length ||
    rows.invalidPrices.length ||
    rows.duplicateProductCodes.length ||
    source.invalidImageFiles.length
  )
    throw new Error(
      "Source validation failed. See docs/catalogue-import-report.json; no database changes were made.",
    );
  if (dryRun) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    // Decode every matched image before uploading or changing catalogue data.
    const prepared = [];
    for (const image of mapping.matched) {
      const body = await normalizeImage(image.data);
      const digest = createHash("sha256").update(body).digest("hex");
      prepared.push({
        code: image.code,
        body,
        key: `products/${encodeURIComponent(image.code)}/${digest}.webp`,
      });
    }
    const imageUrls = new Map<string, string>();
    for (const i of prepared) {
      const url = await upload(i.key, i.body, "image/webp");
      const object = await verifyObject(i.key);
      if (object.ContentLength !== i.body.length)
        throw new Error(`Storage verification failed for ${i.code}`);
      imageUrls.set(i.code, url);
    }
    await db.$transaction(
      async (tx) => {
        for (const p of rows.products)
          await tx.product.upsert({
            where: { code: p.code },
            create: { ...p, imageUrl: imageUrls.get(p.code) ?? null },
            update: { ...p, imageUrl: imageUrls.get(p.code) ?? null },
          });
        await tx.auditLog.create({
          data: {
            adminId: "catalogue-import",
            action: "SOURCE_CATALOGUE_IMPORT",
            detail: JSON.stringify({
              source: report.source,
              products: rows.products.length,
              images: prepared.length,
            }),
          },
        });
      },
      { timeout: 60000 },
    );
    report.importedProducts = rows.products.length;
    report.uploadedImages = prepared.length;
    report.storageVerified = true;
    await writeFile(
      "docs/catalogue-import-report.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
      JSON.stringify({
        products: report.importedProducts,
        categories: report.totalCategories,
        images: report.uploadedImages,
        missingImages: report.missingImages,
        unmatchedImages: report.unmatchedImages,
        priceOnRequest: report.priceOnRequest.length,
      }),
    );
  }
} finally {
  await db.$disconnect();
}
