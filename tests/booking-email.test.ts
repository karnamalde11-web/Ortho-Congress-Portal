import { afterEach, describe, expect, it, vi } from "vitest";
import {
  emailEnabled,
  emailSettings,
  bookingEmailPayload,
} from "../lib/booking-email.mjs";
import {
  deliverEmail,
  processEmailBatch,
} from "../scripts/booking-email-worker.mjs";
const env = {
  BOOKING_EMAIL_ENABLED: "true",
  APP_URL: "https://portal.example.invalid",
  RESEND_API_KEY: "test-only-not-a-real-key",
  BOOKING_EMAIL_TO: "admin",
  BOOKING_EMAIL_FROM: "onboarding@resend.dev",
};
const booking = {
  id: "test-booking",
  createdAt: new Date("2026-10-14T08:00:00Z"),
  doctorName: "Dr Test\r\nName",
  country: "India",
  currency: "USD",
  pricedSubtotalDisplay: "39.00",
  totalDisplay: null,
  pricedSubtotalCfa: "24000.00",
  totalCfa: null,
  phone: "+12025550171",
  email: "customer@example.invalid",
  items: [
    {
      code: "INS-001",
      name: "Instrument",
      quantity: 3,
      unitPriceDisplay: "13.00",
      unitPriceCfa: "8000.00",
    },
    {
      code: "AR-006",
      name: "Request item",
      quantity: 1,
      unitPriceDisplay: null,
      unitPriceCfa: null,
    },
  ],
};
afterEach(() => vi.restoreAllMocks());
describe("booking email settings and content", () => {
  it("defaults off and rejects unsafe/incomplete settings without blocking bookings", async () => {
    expect(emailEnabled({})).toBe(false);
    expect(emailSettings({})).toEqual({ enabled: false, ready: false });
    expect(emailSettings(env).ready).toBe(true);
    for (const overrides of [
      { RESEND_API_KEY: "" },
      { BOOKING_EMAIL_FROM: "header\r\ninjection@example.invalid" },
      { BOOKING_EMAIL_TO: "a@example.invalid,b@example.invalid" },
      { APP_URL: "http://public.example.invalid" },
      { APP_URL: "https://user:password@portal.example.invalid" },
    ])
      expect(emailSettings({ ...env, ...overrides }).ready).toBe(false);
    const query = vi.fn();
    const send = vi.fn();
    expect(
      await processEmailBatch({ query }, { ...env, RESEND_API_KEY: "" }, send),
    ).toBe(0);
    expect(query).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
  it("uses saved whole-USD prices and POR without exposing customer contacts or conversion details", () => {
    const payload = bookingEmailPayload(
      booking,
      emailSettings(env),
      "owner@example.invalid",
    );
    expect(payload.to).toEqual(["owner@example.invalid"]);
    expect(payload.text).toContain("Dr Test Name");
    expect(payload.text).toContain("$13 per unit");
    expect(payload.text).toContain("Priced subtotal: $39");
    expect(payload.text).toContain("Final total: On request");
    expect(payload.text).toContain("Price on Request");
    expect(payload.text).toContain(
      "https://portal.example.invalid/admin/bookings/test-booking",
    );
    expect(JSON.stringify(payload)).not.toMatch(
      /2025550171|customer@example|test-only-not-a-real-key|625|conversion|CFA/,
    );
  });
  it("renders CFA and request-only totals correctly and supports historical snapshots", () => {
    const cfa = {
      ...booking,
      country: "Senegal",
      currency: "CFA",
      pricedSubtotalDisplay: "16000.00",
      totalDisplay: "16000.00",
      items: [
        { ...booking.items[0], unitPriceDisplay: "8000.00", quantity: 2 },
      ],
    };
    expect(
      bookingEmailPayload(cfa, emailSettings(env), "owner@example.invalid")
        .text,
    ).toContain("Final total: 16,000 CFA");
    const por = {
      ...cfa,
      pricedSubtotalDisplay: "0.00",
      totalDisplay: null,
      items: [booking.items[1]],
    };
    expect(
      bookingEmailPayload(por, emailSettings(env), "owner@example.invalid")
        .text,
    ).toContain("Final total: On request");
    const legacy = {
      ...booking,
      pricedSubtotalDisplay: null,
      totalDisplay: null,
    };
    expect(
      bookingEmailPayload(legacy, emailSettings(env), "owner@example.invalid")
        .text,
    ).toContain("Priced subtotal: 24,000 CFA");
  });
});
describe("provider delivery", () => {
  it("uses a fixed provider endpoint and an idempotency key, and records acceptance", async () => {
    const send = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ id: "email-test-id" }), { status: 200 }),
    );
    expect(
      await deliverEmail(
        { text: "Test" },
        "booking-alert/test-booking",
        env,
        send,
      ),
    ).toEqual({ sent: true, providerId: "email-test-id" });
    expect(send.mock.calls[0][0]).toBe("https://api.resend.com/emails");
    const options = send.mock.calls[0][1] as unknown as RequestInit;
    expect(options.headers).toMatchObject({
      "Idempotency-Key": "booking-alert/test-booking",
      Authorization: "Bearer test-only-not-a-real-key",
    });
    expect(options.body).toBe('{"text":"Test"}');
  });
  it.each([
    [429, "RATE_LIMITED", true],
    [401, "CONFIGURATION", true],
    [403, "CONFIGURATION", true],
    [500, "TEMPORARY", true],
    [408, "TEMPORARY", true],
    [422, "REJECTED", false],
  ])(
    "handles HTTP %s without leaking the provider response",
    async (status, error, retryable) => {
      const send = vi.fn(
        async () =>
          new Response("sensitive provider response", {
            status: Number(status),
          }),
      );
      expect(await deliverEmail({}, "key", env, send)).toEqual({
        sent: false,
        error,
        retryable,
      });
    },
  );
  it("treats network failure and malformed success receipts as retryable", async () => {
    expect(
      await deliverEmail({}, "key", env, async () => {
        throw new Error("network");
      }),
    ).toMatchObject({ sent: false, error: "TEMPORARY", retryable: true });
    expect(
      await deliverEmail({}, "key", env, async () => new Response("{}")),
    ).toMatchObject({ sent: false, error: "TEMPORARY", retryable: true });
  });
});
