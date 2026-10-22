import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/security";
import { changeAdminPassword } from "./actions";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  try {
    await requireAdmin();
  } catch {
    redirect("/admin/login");
  }

  const { error } = await searchParams;
  const message =
    error === "current"
      ? "Current password is incorrect."
      : error === "retry"
        ? "Your password was updated in another session. Please sign in again."
        : error
          ? "Enter matching new passwords of at least 14 characters (maximum 72 UTF-8 bytes), different from your current password."
          : null;

  return (
    <section className="card mx-auto max-w-lg">
      <a href="/admin" className="text-sm">← Back to dashboard</a>
      <h1 className="mt-4">Change admin password</h1>
      <p className="mt-2 text-sm">
        Your current password is required. After changing it, all existing administrator sessions will be signed out.
      </p>
      {message && <p role="alert" className="my-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{message}</p>}
      <form action={changeAdminPassword} className="mt-5 space-y-4">
        <label>
          Current password
          <input name="currentPassword" type="password" autoComplete="current-password" required minLength={1} maxLength={128} />
        </label>
        <label>
          New password (at least 14 characters)
          <input name="newPassword" type="password" autoComplete="new-password" required minLength={14} maxLength={72} />
        </label>
        <label>
          Confirm new password
          <input name="confirmPassword" type="password" autoComplete="new-password" required minLength={14} maxLength={72} />
        </label>
        <button type="submit" className="w-full">Update password and sign out</button>
      </form>
    </section>
  );
}
