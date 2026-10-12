import { readLimitedBody } from "@/lib/body";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin, checkOrigin } from "@/lib/security";
import { db } from "@/lib/db";
import {
  inspectWorkbook,
  inspectImageArchive,
  matchImages,
  approvedCorrectionsFor,
  normalizeImage,
} from "@/lib/import";
import { upload } from "@/lib/storage";
export const runtime = "nodejs";
export async function POST(req: Request) {
  let admin;
  try {
    await checkOrigin();
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let report: Record<string, unknown> = {};
  try {
    const raw = await readLimitedBody(req, 21 * 1024 * 1024);
    const form = await new Response(new Uint8Array(raw), {
      headers: { "content-type": req.headers.get("content-type") || "" },
    }).formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size > 20 * 1024 * 1024)
      throw new Error("Choose a file under 20 MB");
    const buffer = Buffer.from(await file.arrayBuffer());
    let count = 0;
    const kind = form.get("kind");
    if (kind === "excel") {
      if (!file.name.toLowerCase().endsWith(".xlsx"))
        throw new Error("Choose an .xlsx file");
      const workbook = await inspectWorkbook(buffer);
      report = {
        malformedRows: workbook.malformedRows,
        invalidPrices: workbook.invalidPrices,
        duplicateProductCodes: workbook.duplicateProductCodes,
        priceOnRequest: workbook.products
          .filter((p) => p.priceCfa === null)
          .map((p) => p.code),
        categories: [...new Set(workbook.products.map((p) => p.category))],
      };
      if (
        workbook.malformedRows.length ||
        workbook.invalidPrices.length ||
        workbook.duplicateProductCodes.length
      )
        throw new Error(
          "Catalogue validation failed. No products were changed. Review the report below.",
        );
      if (!workbook.products.length) throw new Error("No products found");
      await db.$transaction(
        async (tx) => {
          for (const p of workbook.products)
            await tx.product.upsert({
              where: { code: p.code },
              create: p,
              update: p,
            });
          await tx.auditLog.create({
            data: {
              adminId: admin.id,
              action: "EXCEL_IMPORT",
              detail: JSON.stringify({
                count: workbook.products.length,
                report,
              }),
            },
          });
        },
        { timeout: 60000 },
      );
      count = workbook.products.length;
    } else if (kind === "images") {
      if (!file.name.toLowerCase().endsWith(".zip"))
        throw new Error("Choose a .zip file");
      const source = inspectImageArchive(buffer);
      const products = await db.product.findMany({ select: { code: true } });
      const mapping = matchImages(
        products,
        source,
        approvedCorrectionsFor(buffer),
      );
      report = {
        missingImages: mapping.missingImages,
        unmatchedImages: mapping.unmatchedImages,
        duplicateImageFilenames: source.duplicateImageFilenames,
        ambiguousImageCodes: source.ambiguousImageCodes,
        invalidImageFiles: source.invalidImageFiles,
        nonImageFiles: source.nonImageFiles,
        intentionalFilenameCorrections: mapping.appliedCorrections,
      };
      if (source.invalidImageFiles.length)
        throw new Error(
          "Image validation failed. No products were changed. Review the report below.",
        );
      const prepared = [];
      for (const image of mapping.matched)
        prepared.push({ ...image, body: await normalizeImage(image.data) });
      const updates = [];
      for (const i of prepared) {
        const imageUrl = await upload(
          `products/${encodeURIComponent(i.code)}/${randomUUID()}.webp`,
          i.body,
          "image/webp",
        );
        updates.push({ code: i.code, imageUrl });
      }
      await db.$transaction([
        ...updates.map((i) =>
          db.product.update({
            where: { code: i.code },
            data: { imageUrl: i.imageUrl },
          }),
        ),
        db.auditLog.create({
          data: {
            adminId: admin.id,
            action: "IMAGE_IMPORT",
            detail: JSON.stringify({ count: updates.length, report }),
          },
        }),
      ]);
      count = updates.length;
    } else throw new Error("Invalid import type");
    revalidatePath("/");
    revalidatePath("/admin");
    return NextResponse.json({
      message: `Imported ${count} ${kind === "excel" ? "products" : "images"}.`,
      report,
    });
  } catch (e) {
    console.error("Import failed", e instanceof Error ? e.name : "Unknown");
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed", report },
      { status: 400 },
    );
  }
}
