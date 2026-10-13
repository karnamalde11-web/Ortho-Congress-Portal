import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/security";
import { analyticsReport } from "@/lib/analytics-report";
export const dynamic = "force-dynamic";
const percent = (value: number) => `${value.toFixed(1)}%`;
function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: {
    label: string;
    sessions: number;
    visitors: number;
    converted: number;
    abandoned: number;
    conversionRate: number;
  }[];
}) {
  return (
    <section className="card min-w-0">
      <h2>{title}</h2>
      <div className="overflow-x-auto">
        <table className="my-3 w-full text-left text-sm">
          <thead>
            <tr>
              <th>Group</th>
              <th>Sessions</th>
              <th>Visitors</th>
              <th>Submitted sessions</th>
              <th>Conversion</th>
              <th>Abandoned</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="py-2 pr-4">{row.label}</td>
                <td>{row.sessions}</td>
                <td>{row.visitors}</td>
                <td>{row.converted}</td>
                <td>{percent(row.conversionRate)}</td>
                <td>{row.abandoned}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p>No tracked visits in this period.</p>}
      </div>
    </section>
  );
}
export default async function Analytics({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  try {
    await requireAdmin();
  } catch {
    redirect("/admin/login");
  }
  const requested = Number((await searchParams).days);
  const days = [7, 30, 90].includes(requested) ? requested : 30;
  const report = await analyticsReport(days);
  const time = (value: Date) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(value);
  const funnel = [
    "Website Opened",
    "Product Interaction",
    "Product Selected / Quantity Entered",
    "Customer Details Started",
    "Pre-Booking Submitted",
  ];
  return (
    <>
      <a href="/admin">← Back to bookings</a>
      <h1 className="my-4">Visitor analytics</h1>
      <nav className="my-4 flex flex-wrap gap-4">
        {[7, 30, 90].map((period) => (
          <a
            key={period}
            href={`/admin/analytics?days=${period}`}
            aria-current={days === period ? "page" : undefined}
          >
            Last {period} days
          </a>
        ))}
      </nav>
      <p className="mb-4 text-sm">
        Sessions opened between {time(report.since)} and {time(report.now)}{" "}
        (IST). Analytics starts when this feature is deployed; earlier visits
        cannot be reconstructed.
      </p>
      <div className="my-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          [
            "Unique Visitors",
            report.uniqueVisitors,
            "Approximate browsers/devices, not identified people.",
          ],
          [
            "Total Sessions",
            report.sessions,
            "Refreshes share a visit; a new visit starts after 30 minutes inactive.",
          ],
          [
            "Pre-Bookings",
            report.preBookings,
            `${report.linkedPreBookings} linked to tracked visits; ${report.unattributedPreBookings} untracked or earlier bookings.`,
          ],
          [
            "Conversion Rate",
            percent(report.conversionRate),
            "Submitted sessions ÷ public sessions; multiple bookings in one visit count once.",
          ],
          [
            "Started But Not Submitted",
            report.startedNotSubmitted,
            "Meaningful product or form interaction, including sessions still active.",
          ],
          [
            "Abandoned Sessions",
            report.abandoned,
            "Started, no submission, and at least 30 minutes inactive.",
          ],
          [
            "Sessions Without Submission",
            report.sessionsNotSubmitted,
            "Includes visitors who only opened the catalogue.",
          ],
          [
            "Visitors Without Submission",
            report.visitorsNotSubmitted,
            "Approximate browsers with no submitted session in this period.",
          ],
        ].map(([label, value, help]) => (
          <article className="card" key={label}>
            <h2 className="text-base">{label}</h2>
            <p className="my-2 text-3xl font-bold">{value}</p>
            <p className="text-sm">{help}</p>
          </article>
        ))}
      </div>
      <section className="card my-6">
        <h2>Pre-booking funnel</h2>
        <p className="my-2 text-sm">
          Counts are sessions reaching each stage, as a percentage of all
          sessions. Later funnel stages require the earlier actions to have
          occurred; they need not happen in that order.
        </p>
        <ol className="space-y-4">
          {funnel.map((label, index) => (
            <li key={label}>
              <div className="flex flex-wrap justify-between gap-2">
                <strong>{label}</strong>
                <span>
                  {report.funnel[index]} sessions ·{" "}
                  {percent(
                    report.sessions
                      ? (report.funnel[index] / report.sessions) * 100
                      : 0,
                  )}
                </span>
              </div>
              <div className="mt-1 h-3 rounded bg-teal-50">
                <div
                  className="h-3 rounded bg-teal-700"
                  style={{
                    width: `${report.sessions ? (report.funnel[index] / report.sessions) * 100 : 0}%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm">
          Approximate visitors: {report.uniqueProductVisitors} interacted with
          products; {report.uniqueQuantityVisitors} selected a positive
          quantity; {report.uniqueFormVisitors} began customer details. No typed
          customer details are stored in anonymous analytics.
        </p>
      </section>
      <div className="grid gap-6">
        <Breakdown title="By day (IST)" rows={report.daysBreakdown} />
        <Breakdown title="By selected country" rows={report.countries} />
        <p className="text-sm">
          Country is the catalogue selection, defaulting to Senegal. It is not
          an inferred physical location.
        </p>
        <Breakdown title="By device category" rows={report.devices} />
        <Breakdown title="Traffic sources" rows={report.sources} />
        <Breakdown title="Approved campaign tags" rows={report.campaigns} />
      </div>
      <div className="my-6 grid gap-6 sm:grid-cols-2">
        {[
          ["Products interacted with", report.products],
          ["Categories viewed through filtering", report.categories],
        ].map(([title, rows]) => (
          <section className="card" key={title as string}>
            <h2>{title as string}</h2>
            <ul className="my-3 space-y-2">
              {(rows as { label: string; sessions: number }[]).map((row) => (
                <li key={row.label}>
                  {row.label}: {row.sessions} sessions
                </li>
              ))}
            </ul>
            {!(rows as unknown[]).length && <p>No interactions yet.</p>}
          </section>
        ))}
      </div>
      <section className="card min-w-0">
        <h2>Recent visits</h2>
        <p className="my-2 text-sm">
          Latest 50 visits. Dates/times shown in IST; device categories use the
          screen width at session start.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th>Opened</th>
                <th>Last activity</th>
                <th>Country</th>
                <th>Device</th>
                <th>Source</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {report.recent.map((visit, index) => (
                <tr key={index}>
                  <td className="whitespace-nowrap py-3 pr-4">
                    {time(visit.openedAt)}
                  </td>
                  <td className="whitespace-nowrap pr-4">
                    {time(visit.lastSeenAt)}
                  </td>
                  <td className="pr-4">{visit.country}</td>
                  <td className="pr-4">{visit.device}</td>
                  <td className="pr-4">{visit.source}</td>
                  <td>{visit.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="my-6 text-sm">
        First-party tracking uses random cookies, not login, fingerprinting or
        personal identification. Cookie clearing, browser privacy settings,
        blocked JavaScript and automated traffic can affect estimates. Anonymous
        visit/event data is retained for up to 90 days and periodically removed.
        Actual booking records remain intact.
      </p>
    </>
  );
}
