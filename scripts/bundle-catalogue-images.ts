import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  inspectWorkbook,
  inspectImageArchive,
  matchImages,
  approvedCorrectionsFor,
  normalizeImage,
} from "../lib/import";

const source = await Promise.all([
  readFile("catalogue-source/Exhibition Product List.xlsx"),
  readFile("catalogue-source/Pictures.zip"),
]);
const workbook = await inspectWorkbook(source[0]);
const pictures = inspectImageArchive(source[1]);
const mapped = matchImages(
  workbook.products,
  pictures,
  approvedCorrectionsFor(source[1]),
);
if (workbook.malformedRows.length || workbook.invalidPrices.length || workbook.duplicateProductCodes.length ||
    pictures.invalidImageFiles.length || mapped.missingImages.length || mapped.matched.length !== workbook.products.length) {
  throw new Error(JSON.stringify({
    message: "Cannot bundle orthopedic images: incomplete or invalid source.",
    expected: workbook.products.length, matched: mapped.matched.length,
    missing: mapped.missingImages,
    invalid: pictures.invalidImageFiles,
  }));
}
const folder = join(process.cwd(), "public", "images", "products");
await mkdir(folder, { recursive: true });
for (const picture of mapped.matched) {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(picture.code)) throw new Error("Unexpected product code");
  await writeFile(join(folder, picture.code + ".webp"), await normalizeImage(picture.data));
}
console.log(`Bundled ${mapped.matched.length} orthopedic product photos for local delivery.`);
