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
import { BookingStatus } from "@prisma/client";
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
export async function updateStatus(form: FormData) {
  await checkOrigin();
  const admin = await requireAdmin();
  const id = String(form.get("id"));
  const status = String(form.get("status"));
  if (!Object.values(BookingStatus).includes(status as BookingStatus))
    throw new Error("Invalid status");
  await db.$transaction([
    db.booking.update({
      where: { id },
      data: { status: status as BookingStatus },
    }),
    db.auditLog.create({
      data: {
        adminId: admin.id,
        action: "BOOKING_STATUS",
        detail: JSON.stringify({ id, status }),
      },
    }),
  ]);
  revalidatePath("/admin");
}
