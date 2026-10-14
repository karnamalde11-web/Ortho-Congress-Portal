import ExcelJS from "exceljs";
import { PassThrough, Readable } from "node:stream";
import { requireAdmin } from "@/lib/security";
import { db } from "@/lib/db";
import { parseBookingFilters, stockFilters } from "@/lib/booking-filters";
import {
  bookingWhere,
  bookingOrder,
  stockReport,
} from "@/lib/booking-management";
import {
  exportHeaders,
  bookingExportRows,
  csvLine,
  type ExportCell,
  type ExportKind,
} from "@/lib/booking-export";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return Response.json(
      { error: "Admin sign-in required." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") ?? "summary";
  const format = url.searchParams.get("format") ?? "csv";
  if (
    !["summary", "items", "stock"].includes(kind) ||
    !["csv", "xlsx"].includes(format)
  )
    return Response.json(
      { error: "Please choose a supported export." },
      { status: 400 },
    );
  const parsed = parseBookingFilters(Object.fromEntries(url.searchParams));
  if (parsed.errors.length)
    return Response.json({ error: parsed.errors.join(" ") }, { status: 400 });
  const filters = kind === "stock" ? stockFilters(parsed) : parsed;
  const reportKind = kind as ExportKind;
  async function* rows(): AsyncGenerator<ExportCell[]> {
    if (reportKind === "stock") {
      for (const row of await stockReport(filters))
        yield [row.code, row.name, row.category, row.bookings, row.quantity];
      return;
    }
    let cursor: string | undefined;
    while (true) {
      const batch = await db.booking.findMany({
        where: bookingWhere(filters),
        orderBy: bookingOrder(filters),
        take: 200,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: { items: { orderBy: [{ code: "asc" }, { id: "asc" }] } },
      });
      for (const booking of batch)
        for (const row of bookingExportRows(booking, reportKind)) yield row;
      if (batch.length < 200) break;
      cursor = batch[batch.length - 1].id;
    }
  }
  const filename = `nm-bookings-${kind}-${filters.status.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.${format}`;
  const headers = {
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    Vary: "Cookie",
  };
  if (format === "csv") {
    async function* csv() {
      yield "\uFEFF" + csvLine(exportHeaders[reportKind]);
      for await (const row of rows()) yield csvLine(row);
    }
    return new Response(
      Readable.toWeb(
        Readable.from(csv(), { objectMode: false }),
      ) as ReadableStream,
      { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" } },
    );
  }
  const stream = new PassThrough();
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream,
    useStyles: true,
    useSharedStrings: false,
  });
  const sheet = workbook.addWorksheet(
    kind === "stock"
      ? "Product Requirements"
      : kind === "items"
        ? "Booking Items"
        : "Bookings",
    { views: [{ state: "frozen", ySplit: 1 }] },
  );
  sheet.columns = exportHeaders[reportKind].map((header) => ({
    header,
    key: header,
    width: header.includes("Name") || header === "Remarks" ? 32 : 24,
  }));
  sheet.getRow(1).font = { bold: true };
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: exportHeaders[reportKind].length },
  };
  sheet.getRow(1).commit();
  void (async () => {
    try {
      for await (const row of rows())
        sheet.addRow(row.map((value) => value ?? "")).commit();
      sheet.commit();
      await workbook.commit();
    } catch {
      stream.destroy(
        new Error("The export could not be completed. Please try again."),
      );
    }
  })();
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      ...headers,
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
