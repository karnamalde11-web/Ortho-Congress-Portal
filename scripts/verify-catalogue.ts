import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { db } from "../lib/db";
import { inspectWorkbook } from "../lib/import";
import { keyFromObjectUrl, verifyObject } from "../lib/storage";
try {
  const source = await inspectWorkbook(
    await readFile("catalogue-source/Exhibition Product List.xlsx"),
  );
  const products = await db.product.findMany();
  if (products.length !== source.products.length)
    throw new Error(
      `Expected ${source.products.length} products, found ${products.length}`,
    );
  for (const expected of source.products) {
    const actual = products.find((p) => p.code === expected.code);
    if (
      !actual ||
      actual.name !== expected.name ||
      actual.category !== expected.category ||
      (actual.priceCfa?.toFixed(2) ?? null) !== expected.priceCfa
    )
      throw new Error(`Database does not match source for ${expected.code}`);
    if (!actual.imageUrl)
      throw new Error(`Missing image URL for ${expected.code}`);
    await verifyObject(keyFromObjectUrl(actual.imageUrl));
  }
  const report = {
    verifiedAt: new Date().toISOString(),
    productsVerified: products.length,
    categoriesVerified: new Set(products.map((p) => p.category)).size,
    imageObjectsVerified: products.filter((p) => p.imageUrl).length,
    priceOnRequest: products.filter((p) => p.priceCfa === null).length,
    exactSourceFieldsVerified: ["code", "name", "category", "priceCfa"],
    storageMode: process.env.S3_ENDPOINT?.includes("127.0.0.1")
      ? "local development object-storage service"
      : "external object storage",
  };
  await writeFile(
    "docs/catalogue-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} finally {
  await db.$disconnect();
}
