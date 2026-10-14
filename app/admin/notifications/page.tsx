import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/security";
import { emailSettings, emailErrorMessages } from "@/lib/booking-email.mjs";
import { bookingReference } from "@/lib/booking-reference";
import { adminDate } from "@/lib/booking-filters";
export const dynamic = "force-dynamic";
export default async function Notifications({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  try {
    await requireAdmin();
  } catch {
    redirect("/admin/login");
  }
  const settings = emailSettings();
  const requestedStatus = (await searchParams).status;
  const selectedStatus = ["PENDING", "SENDING", "SENT", "FAILED"].includes(
    requestedStatus ?? "",
  )
    ? requestedStatus
    : undefined;
  const [counts, jobs] = await Promise.all([
    db.bookingEmail.groupBy({ by: ["status"], _count: true }),
    db.bookingEmail.findMany({
      where: selectedStatus ? { status: selectedStatus } : {},
      take: 50,
      orderBy: { createdAt: "desc" },
      include: {
        booking: { select: { id: true, createdAt: true, doctorName: true } },
      },
    }),
  ]);
  const labels: Record<string, string> = {
    PENDING: "Queued / retrying",
    SENDING: "Sending",
    SENT: "Accepted by email service",
    FAILED: "Needs review",
  };
  return (
    <>
      <a href="/admin">← Back to Bookings</a>
      <h1 className="my-4">Email alerts</h1>
      <section className="card mb-4">
        <p>
          {!settings.enabled
            ? "Email alerts are not enabled yet. Bookings continue to save normally."
            : !settings.ready
              ? "Email account setup is incomplete. Bookings save normally; queued alerts will wait for setup."
              : "Email alerts are enabled for new pre-bookings."}
        </p>
        {settings.ready && (
          <p className="mt-2">
            Recipient:{" "}
            {settings.to === "admin"
              ? "Your first administrator's sign-in email address"
              : settings.to}
            . Sender: {settings.from}.
          </p>
        )}
        <p className="mt-2 text-sm">
          Emails go only to the configured administrator recipient. Customers
          receive no email from this feature. Earlier bookings are not emailed
          retroactively.
        </p>
        <p className="mt-2 text-sm">
          Acceptance by the email service does not confirm delivery to your
          inbox. Check your spam folder and the email provider if an alert is
          missing.
        </p>
      </section>
      <div className="my-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Object.entries(labels).map(([status, label]) => (
          <section key={status} className="card">
            <h2 className="text-sm">{label}</h2>
            <p className="text-2xl font-bold">
              {counts.find((c) => c.status === status)?._count ?? 0}
            </p>
          </section>
        ))}
      </div>
      <nav
        className="my-4 flex flex-wrap gap-4"
        aria-label="Email status filters"
      >
        <a href="/admin/notifications">All alerts</a>
        {Object.entries(labels).map(([status, label]) => (
          <a key={status} href={`/admin/notifications?status=${status}`}>
            {label}
          </a>
        ))}
      </nav>
      <p className="mb-3 text-sm">
        Latest 50 {selectedStatus ? labels[selectedStatus].toLowerCase() : ""}{" "}
        alerts.
      </p>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table
          className="w-full text-left text-sm"
          aria-label="Booking email alerts"
        >
          <thead>
            <tr>
              {[
                "Booking",
                "Customer",
                "Created (IST)",
                "Email status",
                "Attempts",
                "Details",
              ].map((label) => (
                <th key={label} className="p-3">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-t">
                <td className="max-w-60 break-words p-3">
                  <a href={`/admin/bookings/${job.bookingId}`}>
                    {bookingReference(job.bookingId, job.booking.createdAt)}
                  </a>
                </td>
                <td className="p-3">{job.booking.doctorName}</td>
                <td className="p-3">{adminDate(job.createdAt)}</td>
                <td className="p-3">{labels[job.status] ?? job.status}</td>
                <td className="p-3">{job.attempts}</td>
                <td className="p-3">
                  {job.lastError
                    ? (emailErrorMessages[
                        job.lastError as keyof typeof emailErrorMessages
                      ] ?? "Please check email service settings.")
                    : job.sentAt
                      ? `Accepted ${adminDate(job.sentAt)} IST`
                      : "Waiting for delivery"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!jobs.length && <p className="p-4">No booking alerts queued yet.</p>}
      </div>
    </>
  );
}
