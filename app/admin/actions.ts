"use server";
import { compare } from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  checkOrigin,
  createSession,
  hash,
  rateLimit,
  requireAdmin,
} from "@/lib/security";
import { isBookingStatus } from "@/lib/booking-filters";
export async function login(form: FormData) {
  let ok = false;
  try {
    await checkOrigin();
    const email = String(form.get("email") || "")
      .trim()
      .toLowerCase();
    const password = String(form.get("password") || "");
    if (email.length > 254 || Buffer.byteLength(password, "utf8") > 72)
      throw new Error("Invalid");
    await rateLimit("login:global", 100);
    await rateLimit(`login:${hash(email)}`, 5);
    const admin = await db.admin.findUnique({ where: { email } });
    const valid = await compare(
      password,
      admin?.passwordHash ??
        "$2b$12$zQtB05.kZXOUwBJM.eOnEuCJcqefEFoIMWvW.hFm2Fja61sj/mCcm",
    );
    if (admin && valid) {
      await createSession(admin.id);
      ok = true;
    }
  } catch {}
  redirect(ok ? "/admin" : "/admin/login?error=1");
}
export async function logout() {
  await checkOrigin();
  const token = (await cookies()).get("ortho_session")?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hash(token) } });
  (await cookies()).delete("ortho_session");
  redirect("/admin/login");
}
export async function updateStatus(
  _previous: { error?: string; success?: string },
  form: FormData,
): Promise<{ error?: string; success?: string }> {
  await checkOrigin();
  const admin = await requireAdmin();
  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "");
  const expected = String(form.get("expectedStatus") ?? "");
  if (
    !/^[a-zA-Z0-9_-]{1,80}$/.test(id) ||
    !isBookingStatus(status) ||
    !isBookingStatus(expected)
  )
    return { error: "Please choose a valid booking status." };
  const result = await db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!booking) return "missing";
    if (booking.status !== expected) return "conflict";
    if (booking.status === status) return "unchanged";
    const updated = await tx.booking.updateMany({
      where: { id, status: expected },
      data: { status },
    });
    if (updated.count !== 1) return "conflict";
    await tx.auditLog.create({
      data: {
        adminId: admin.id,
        action: "BOOKING_STATUS",
        detail: JSON.stringify({ id, fromStatus: expected, status }),
      },
    });
    return "updated";
  });
  if (result === "missing")
    return { error: "This booking could not be found." };
  if (result === "conflict")
    return {
      error:
        "Another administrator changed this booking. Refresh the page before updating it.",
    };
  revalidatePath("/admin");
  revalidatePath("/admin/stock");
  revalidatePath(`/admin/bookings/${id}`);
  return {
    success:
      result === "unchanged"
        ? "This status is already saved."
        : "Booking status updated.",
  };
}
