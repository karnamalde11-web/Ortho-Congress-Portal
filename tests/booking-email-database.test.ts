import { describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { readFile } from "node:fs/promises";
import { processEmailBatch } from "../scripts/booking-email-worker.mjs";
const url = process.env.TEST_DATABASE_URL;
const env = {
  BOOKING_EMAIL_ENABLED: "true",
  APP_URL: "https://portal.example.invalid",
  RESEND_API_KEY: "test-only-not-a-real-key",
  BOOKING_EMAIL_TO: "owner@example.invalid",
  BOOKING_EMAIL_FROM: "onboarding@resend.dev",
};
describe.skipIf(!url)("durable booking alerts in PostgreSQL", () => {
  it("preserves historical data, atomically deduplicates, retries frozen payloads, and recovers crashed leases", async () => {
    const db = new Client({ connectionString: url });
    await db.connect();
    try {
      await db.query("BEGIN");
      await db.query("CREATE SCHEMA email_delivery_test");
      await db.query("SET LOCAL search_path TO email_delivery_test");
      for (const name of [
        "20261012120000_initial",
        "20261012123000_cfa_catalogue",
        "20261013090000_customer_details",
        "20261013140000_display_price_snapshots",
        "20261013153000_anonymous_analytics",
        "20261014090000_booking_management",
      ])
        await db.query(
          (
            await readFile(`prisma/migrations/${name}/migration.sql`, "utf8")
          ).replace(/^BEGIN;|^COMMIT;/gm, ""),
        );
      await db.query(
        `INSERT INTO "Booking" (id,"requestKey","doctorName",phone,hospital,"consentAt",country,currency,"pricedSubtotalDisplay","totalDisplay") VALUES ('email-booking','email-request','Audit test','+12025550171','Test',NOW(),'India','USD',39,NULL)`,
      );
      const before = (await db.query('SELECT * FROM "Booking"')).rows;
      await db.query(
        await readFile(
          "prisma/migrations/20261014140000_booking_email_alerts/migration.sql",
          "utf8",
        ),
      );
      expect((await db.query('SELECT * FROM "Booking"')).rows).toEqual(before);
      expect(
        (await db.query('SELECT * FROM "BookingEmail"')).rows,
      ).toHaveLength(0);
      await db.query(
        `INSERT INTO "BookingEmail" (id,"bookingId","availableAt") VALUES ('email-job','email-booking',NOW()-INTERVAL '1 second')`,
      );
      await db.query("SAVEPOINT duplicate");
      await expect(
        db.query(
          `INSERT INTO "BookingEmail" (id,"bookingId") VALUES ('duplicate-job','email-booking')`,
        ),
      ).rejects.toThrow();
      await db.query("ROLLBACK TO SAVEPOINT duplicate");
      const send = vi.fn<typeof fetch>(
        async () => new Response("{}", { status: 503 }),
      );
      expect(await processEmailBatch(db, env, send)).toBe(1);
      expect(send).toHaveBeenCalledTimes(1);
      let job = (await db.query('SELECT * FROM "BookingEmail"')).rows[0];
      expect(job.status).toBe("PENDING");
      expect(job.attempts).toBe(1);
      expect(job.lastError).toBe("TEMPORARY");
      expect(job.payload.to).toEqual(["owner@example.invalid"]);
      const body = send.mock.calls[0][1]!.body;
      expect(await processEmailBatch(db, env, send)).toBe(0);
      expect(send).toHaveBeenCalledTimes(1);
      await db.query(
        `UPDATE "BookingEmail" SET status='SENDING',"leaseUntil"=NOW()-INTERVAL '1 second'`,
      );
      send.mockImplementation(
        async () =>
          new Response(JSON.stringify({ id: "accepted-test-email" }), {
            status: 200,
          }),
      );
      expect(
        await processEmailBatch(
          db,
          {
            ...env,
            BOOKING_EMAIL_TO: "changed@example.invalid",
            APP_URL: "https://changed.example.invalid",
          },
          send,
        ),
      ).toBe(1);
      expect(send.mock.calls[1][1]!.body).toBe(body);
      expect(
        (send.mock.calls[1][1]!.headers as Record<string, string>)[
          "Idempotency-Key"
        ],
      ).toBe("booking-alert/email-booking");
      job = (await db.query('SELECT * FROM "BookingEmail"')).rows[0];
      expect(job.status).toBe("SENT");
      expect(job.providerId).toBe("accepted-test-email");
      expect(job.sentAt).toBeTruthy();
      expect(await processEmailBatch(db, env, send)).toBe(0);
      expect(send).toHaveBeenCalledTimes(2);
      // An uncertain delivery beyond the provider's idempotency lifetime must
      // never be blindly sent again.
      await db.query(
        `UPDATE "BookingEmail" SET status='PENDING',"availableAt"=NOW()-INTERVAL '1 second',"firstAttemptAt"=NOW()-INTERVAL '24 hours'`,
      );
      expect(await processEmailBatch(db, env, send)).toBe(1);
      expect(send).toHaveBeenCalledTimes(2);
      expect(
        (await db.query('SELECT status,"lastError" FROM "BookingEmail"'))
          .rows[0],
      ).toEqual({ status: "FAILED", lastError: "RETRY_WINDOW" });
      expect((await db.query('SELECT * FROM "Booking"')).rows).toEqual(before);
    } finally {
      await db.query("ROLLBACK");
      await db.end();
    }
  });
});
