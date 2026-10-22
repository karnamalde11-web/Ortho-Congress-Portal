"use server";

import { compare, hash as hashPassword } from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { checkOrigin, hash, rateLimit, requireAdmin } from "@/lib/security";

export async function changeAdminPassword(form: FormData) {
  await checkOrigin();
  const admin = await requireAdmin();
  await rateLimit(`password-change:${hash(admin.id)}`, 8);

  const current = form.get("currentPassword");
  const next = form.get("newPassword");
  const confirmation = form.get("confirmPassword");
  if (typeof current !== "string" || typeof next !== "string" || typeof confirmation !== "string") {
    redirect("/admin/settings/password?error=invalid");
  }
  if (
    next.length < 14 ||
    Buffer.byteLength(next, "utf8") > 72 ||
    next !== confirmation ||
    next === current
  ) {
    redirect("/admin/settings/password?error=invalid");
  }

  // Re-read the stored hash, not just the hash cached in the session.
  const record = await db.admin.findUnique({
    where: { id: admin.id },
    select: { passwordHash: true },
  });
  if (!record || !(await compare(current, record.passwordHash))) {
    redirect("/admin/settings/password?error=current");
  }
  const passwordHash = await hashPassword(next, 12);

  // Only one concurrent password change may succeed against a given old hash.
  const changed = await db.$transaction(async (tx) => {
    const result = await tx.admin.updateMany({
      where: { id: admin.id, passwordHash: record.passwordHash },
      data: { passwordHash },
    });
    if (result.count !== 1) return false;
    await tx.session.deleteMany({ where: { adminId: admin.id } });
    await tx.auditLog.create({
      data: { adminId: admin.id, action: "ADMIN_PASSWORD_CHANGED", detail: "Admin changed password from authenticated settings" },
    });
    return true;
  });
  if (!changed) redirect("/admin/settings/password?error=retry");

  (await cookies()).delete("ortho_session");
  redirect("/admin/login?changed=1");
}
