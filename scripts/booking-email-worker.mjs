import { Pool } from "pg";
import { bookingEmailPayload, emailSettings } from "../lib/booking-email.mjs";
export const RETRY_DELAYS_SECONDS = [60, 300, 900, 1800, 3600, 7200, 14400];
const SAFE_RETRY_MS = 23 * 60 * 60 * 1000;

export async function deliverEmail(payload, key, env, fetcher = fetch) {
  try {
    const response = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY.trim()}`,
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      // PostgreSQL JSONB reorders keys. Keep identical bytes across attempts
      // as well as identical content for the provider's idempotency checks.
      body: JSON.stringify(payload, Object.keys(payload).sort()),
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok) {
      const data = await response.json();
      if (typeof data.id === "string" && data.id.length <= 200)
        return { sent: true, providerId: data.id };
      return { sent: false, error: "TEMPORARY", retryable: true };
    }
    // Never log/store provider response bodies, recipient data or API keys.
    if (response.status === 429)
      return { sent: false, error: "RATE_LIMITED", retryable: true };
    if ([401, 403].includes(response.status))
      return { sent: false, error: "CONFIGURATION", retryable: true };
    if (response.status >= 500 || response.status === 408)
      return { sent: false, error: "TEMPORARY", retryable: true };
    return { sent: false, error: "REJECTED", retryable: false };
  } catch {
    return { sent: false, error: "TEMPORARY", retryable: true };
  }
}

// A short lease survives a crash/redeploy. SKIP LOCKED also prevents replicas
// from delivering the same row concurrently. Provider idempotency covers the
// narrow crash window after acceptance but before recording the response.
/** @param {any} pool @param {Record<string, string | undefined>} [env] @param {typeof fetch} [fetcher] */
export async function processEmailBatch(
  pool,
  env = process.env,
  fetcher = fetch,
) {
  const settings = emailSettings(env);
  if (!settings.ready) return 0;
  const recipient =
    settings.to === "admin"
      ? (await pool.query('SELECT email FROM "Admin" ORDER BY id ASC LIMIT 1'))
          .rows[0]?.email
      : settings.to;
  if (!recipient) return 0;
  let processed = 0;
  for (let n = 0; n < 5; n++) {
    const result = await pool.query(`
      WITH due AS (
        SELECT id FROM "BookingEmail"
        WHERE (status = 'PENDING' AND "availableAt" <= NOW())
          OR (status = 'SENDING' AND "leaseUntil" < NOW())
        ORDER BY "availableAt", id FOR UPDATE SKIP LOCKED LIMIT 1
      )
      UPDATE "BookingEmail" e SET status = 'SENDING',
        attempts = attempts + 1, "leaseUntil" = NOW() + INTERVAL '2 minutes',
        "firstAttemptAt" = COALESCE("firstAttemptAt", NOW())
      FROM due WHERE e.id = due.id RETURNING e.*
    `);
    const job = result.rows[0];
    if (!job) break;
    processed++;
    if (
      Date.now() - new Date(job.firstAttemptAt).getTime() > SAFE_RETRY_MS ||
      job.attempts > 8
    ) {
      await pool.query(
        `UPDATE "BookingEmail" SET status='FAILED', "leaseUntil"=NULL, "lastError"=$3 WHERE id=$1 AND attempts=$2`,
        [job.id, job.attempts, "RETRY_WINDOW"],
      );
      continue;
    }
    let payload = job.payload;
    if (!payload) {
      const row = await pool.query('SELECT * FROM "Booking" WHERE id=$1', [
        job.bookingId,
      ]);
      const booking = row.rows[0];
      // The FK makes absence exceptional; a deleted row needs no email.
      if (!booking) continue;
      booking.items = (
        await pool.query(
          'SELECT * FROM "BookingItem" WHERE "bookingId"=$1 ORDER BY code,id',
          [job.bookingId],
        )
      ).rows;
      payload = bookingEmailPayload(booking, settings, recipient);
      // Freeze sender, recipient, link and content before sending. Configuration
      // changes between retries cannot break the provider's idempotency check.
      const saved = await pool.query(
        "UPDATE \"BookingEmail\" SET payload=$3::jsonb WHERE id=$1 AND attempts=$2 AND status='SENDING' RETURNING id",
        [job.id, job.attempts, JSON.stringify(payload)],
      );
      if (!saved.rowCount) continue;
    }
    const outcome = await deliverEmail(
      payload,
      `booking-alert/${job.bookingId}`,
      env,
      fetcher,
    );
    if (outcome.sent) {
      await pool.query(
        `UPDATE "BookingEmail" SET status='SENT', "sentAt"=NOW(), "providerId"=$3, "lastError"=NULL, "leaseUntil"=NULL WHERE id=$1 AND attempts=$2 AND status='SENDING'`,
        [job.id, job.attempts, outcome.providerId],
      );
    } else {
      const retry = outcome.retryable && job.attempts < 8;
      const delay = RETRY_DELAYS_SECONDS[job.attempts - 1] ?? 14400;
      await pool.query(
        `UPDATE "BookingEmail" SET status=$3, "lastError"=$4, "leaseUntil"=NULL, "availableAt"=NOW()+$5*INTERVAL '1 second' WHERE id=$1 AND attempts=$2 AND status='SENDING'`,
        [
          job.id,
          job.attempts,
          retry ? "PENDING" : "FAILED",
          retry
            ? outcome.error
            : outcome.retryable
              ? "RETRY_EXHAUSTED"
              : outcome.error,
          delay,
        ],
      );
    }
  }
  return processed;
}

export function startBookingEmails(env = process.env) {
  if (!emailSettings(env).ready) return () => {};
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    application_name: "ortho-booking-emails",
  });
  pool.on("error", () => console.error("Booking email connection will retry."));
  let busy = false,
    stopped = false;
  const tick = async () => {
    if (busy || stopped) return;
    busy = true;
    try {
      await processEmailBatch(pool, env);
    } catch {
      console.error(
        "Booking email delivery will retry; check Email alerts in Admin.",
      );
    } finally {
      busy = false;
      if (stopped) await pool.end();
    }
  };
  const first = setTimeout(() => void tick(), 1000);
  first.unref();
  const timer = setInterval(() => void tick(), 15000);
  timer.unref();
  return () => {
    stopped = true;
    clearTimeout(first);
    clearInterval(timer);
    if (!busy) void pool.end();
  };
}
