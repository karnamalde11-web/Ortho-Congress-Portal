import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/security";
import { db } from "@/lib/db";
import { bookingReceipt } from "@/lib/booking-receipt";
import BookingReceipt from "@/app/booking-receipt";
export const dynamic = "force-dynamic";
export default async function SavedReceipt({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    await requireAdmin();
  } catch {
    redirect("/admin/login");
  }
  const { id } = await params;
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) notFound();
  const booking = await db.booking.findUnique({
    where: { id },
    include: { items: { orderBy: [{ code: "asc" }, { id: "asc" }] } },
  });
  if (!booking) notFound();
  return (
    <BookingReceipt
      receipt={bookingReceipt(booking)}
      backHref={`/admin/bookings/${encodeURIComponent(id)}`}
    />
  );
}
