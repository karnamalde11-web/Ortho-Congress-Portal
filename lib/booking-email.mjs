// Shared by the web application and its small background delivery worker.
// This module contains no credentials or network calls.
/** @param {Record<string, string | undefined>} [env] */
export function emailEnabled(env = process.env) {
  return env.BOOKING_EMAIL_ENABLED === "true";
}
/** @param {Record<string, string | undefined>} [env] */
export function emailSettings(env = process.env) {
  if (!emailEnabled(env)) return { enabled: false, ready: false };
  const from = env.BOOKING_EMAIL_FROM?.trim() || "onboarding@resend.dev";
  const to = env.BOOKING_EMAIL_TO?.trim() || "admin";
  const address = /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/;
  let url;
  try {
    url = new URL(env.APP_URL);
  } catch {}
  const ready = Boolean(
    env.RESEND_API_KEY?.trim() &&
    address.test(from) &&
    (to === "admin" || address.test(to)) &&
    url?.protocol === "https:" &&
    !url.username &&
    !url.password,
  );
  return { enabled: true, ready, from, to, appUrl: url?.origin };
}
function clean(value) {
  return String(value ?? "Not recorded").replace(
    /[\r\n\u0000-\u001f\u007f]+/g,
    " ",
  );
}
function money(value, currency) {
  if (value === null || value === undefined) return "Price on Request";
  const amount = new Intl.NumberFormat("en", {
    maximumFractionDigits: currency === "USD" ? 0 : 2,
  }).format(Number(value));
  return currency === "USD" ? `$${amount}` : `${amount} CFA`;
}
export function bookingEmailPayload(booking, settings, recipient) {
  const snapshot = booking.pricedSubtotalDisplay !== null;
  const currency = snapshot && booking.currency === "USD" ? "USD" : "CFA";
  const subtotal = snapshot
    ? booking.pricedSubtotalDisplay
    : booking.pricedSubtotalCfa;
  const total = snapshot ? booking.totalDisplay : booking.totalCfa;
  const reference = `NM-${new Date(booking.createdAt).getUTCFullYear()}-${booking.id}`;
  const lines = booking.items.map((item) => {
    const unit = snapshot ? item.unitPriceDisplay : item.unitPriceCfa;
    return `${clean(item.code)} — ${clean(item.name)} × ${item.quantity} — ${money(unit, currency)} per unit`;
  });
  const text = [
    "A new congress pre-booking has been submitted.",
    `Reference: ${reference}`,
    `Customer: ${clean(booking.doctorName)}`,
    `Country: ${clean(booking.country)}`,
    `Submitted: ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(booking.createdAt))} IST`,
    `Selected products: ${booking.items.length}`,
    "",
    ...lines,
    "",
    `Priced subtotal: ${money(subtotal, currency)}`,
    `Final total: ${total === null ? "On request" : money(total, currency)}`,
    "No payment has been collected.",
    "",
    `View in protected Admin: ${settings.appUrl}/admin/bookings/${encodeURIComponent(booking.id)}`,
    "Sign in to Admin to review customer contact details and manage this pre-booking.",
  ].join("\n");
  return {
    from: settings.from,
    to: [recipient],
    subject: `New pre-booking — ${reference}`,
    text,
  };
}
export const emailErrorMessages = {
  CONFIGURATION: "Email account setup needs attention.",
  RATE_LIMITED: "The email service limit was reached; delivery will retry.",
  TEMPORARY:
    "The email service is temporarily unavailable; delivery will retry.",
  REJECTED:
    "The email service rejected this alert. Check sender verification and account settings.",
  RETRY_EXHAUSTED:
    "Automatic retries have finished. Check the booking and email service before sending manually.",
  RETRY_WINDOW:
    "Delivery is uncertain and the safe retry window has ended. Check the email service before sending manually.",
};
