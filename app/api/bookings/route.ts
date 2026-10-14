import { recordAnalyticsSubmission } from "@/lib/analytics-server";
import { ZodError } from "zod";
import { normalizeWhatsApp } from "@/lib/phone";
import { bookingReference } from "@/lib/booking-reference";
import { currencyForCountry, recordedPricing } from "@/lib/currency";
import { bookingTotals, displayPricing } from "@/lib/booking-pricing";
import { readLimitedBody } from "@/lib/body";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookingSchema } from "@/lib/validation";
import { checkOrigin, hash, rateLimit } from "@/lib/security";
export async function POST(req: Request) {
  try {
    await checkOrigin();
    if (Number(req.headers.get("content-length") || 0) > 20000)
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    const raw = (await readLimitedBody(req, 20000)).toString("utf8");
    if (raw.length > 20000)
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    const data = bookingSchema.parse(JSON.parse(raw));
    const phone = normalizeWhatsApp(
      data.phoneCountryCode,
      data.phoneNationalNumber,
    );
    if (!phone) throw new Error("Invalid phone number");
    await rateLimit(`booking:${hash(phone.phone)}`, 10);
    const booking = await db.$transaction(async (tx) => {
      // Network retries can arrive concurrently. Serialize one request key so
      // every retry receives the saved receipt instead of a uniqueness error.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${data.requestKey}))::text`;
      const previous = await tx.booking.findUnique({
        where: { requestKey: data.requestKey },
        include: { items: true },
      });
      if (previous) return previous;
      const products = await tx.product.findMany({
        where: { id: { in: data.items.map((i) => i.productId) }, active: true },
      });
      if (products.length !== data.items.length)
        throw new Error(
          "A selected product is unavailable. Refresh the catalogue.",
        );
      const items = data.items.map((i) => {
        const p = products.find((p) => p.id === i.productId)!;
        if (i.pricingVersion !== p.updatedAt.toISOString())
          throw new Error(
            "Product details changed. Please refresh the catalogue and review your pre-booking.",
          );
        return {
          productId: p.id,
          code: p.code,
          name: p.name,
          unitPriceCfa: p.priceCfa?.toFixed(2) ?? null,
          category: p.category,
          quantity: i.quantity,
        };
      });
      const totals = bookingTotals(items);
      const currency = currencyForCountry(data.country);
      const display = displayPricing(items, currency);
      return tx.booking.create({
        data: {
          requestKey: data.requestKey,
          doctorName: data.doctorName,
          ...phone,
          specialty: data.specialty,
          specialtyOther:
            data.specialty === "Other" ? data.specialtyOther : null,
          city: data.city,
          country: data.country,
          email: data.email || null,
          hospital: data.hospital,
          notes: data.notes,
          consentAt: new Date(),
          ...totals,
          currency,
          pricedSubtotalDisplay: display.pricedSubtotalDisplay,
          totalDisplay: display.totalDisplay,
          items: {
            create: items.map((item, index) => ({
              ...item,
              ...display.items[index],
            })),
          },
        },
        include: { items: true },
      });
    });
    await Promise.race([
      recordAnalyticsSubmission(booking),
      new Promise<void>((resolve) => setTimeout(resolve, 150)),
    ]);
    return NextResponse.json(
      {
        id: booking.id,
        reference: bookingReference(booking.id, booking.createdAt),
        customerName: booking.doctorName,
        selectedProductCount: booking.items.length,
        ...recordedPricing(booking),
        hasPriceOnRequest: booking.items.some((i) => i.unitPriceCfa === null),
      },
      { status: 201 },
    );
  } catch (e) {
    if (
      e instanceof ZodError &&
      e.issues.some(
        (issue) =>
          issue.path.includes("pricingPolicy") ||
          issue.path.includes("pricingVersion"),
      )
    )
      return NextResponse.json(
        {
          error:
            "Please refresh the catalogue and review your pre-booking before submitting.",
        },
        { status: 400 },
      );
    if (e instanceof ZodError)
      return NextResponse.json(
        {
          error: "Please correct the highlighted fields.",
          fieldErrors: e.flatten().fieldErrors,
        },
        { status: 400 },
      );
    const msg = e instanceof Error ? e.message : "Invalid request";
    return NextResponse.json(
      {
        error:
          msg.includes("unavailable") ||
          msg.includes("Too many") ||
          msg.includes("exceeds") ||
          msg.includes("Product details changed")
            ? msg
            : "Unable to submit. Refresh the catalogue and check your required details and WhatsApp number.",
      },
      { status: 400 },
    );
  }
}
