# Owner email alerts

Alerts are off until an email account is connected. The public booking flow does not wait for email delivery, and bookings remain visible in Admin even if the email service is unavailable.

## Setup, one account-side step at a time

1. Create a Resend account using the same email address as the portal's first administrator. Keep passwords and API keys private.
2. In Resend, create an API key with permission to send emails. Add it privately to the **Ortho-Congress-Portal** Railway service as `RESEND_API_KEY`. Never paste the key into chat or GitHub.
3. Set `BOOKING_EMAIL_TO=admin` to use the first administrator's stored sign-in address. Set `BOOKING_EMAIL_FROM=onboarding@resend.dev` for the initial account-email test. This restricted Resend sender can only deliver to the Resend account email. A verified sender domain is recommended for a branded production sender or any different recipient; set `BOOKING_EMAIL_FROM` to a plain verified email address when available.
4. Set `BOOKING_EMAIL_ENABLED=true` only when setup is complete, then apply the Railway changes. No additional Railway service is needed.
5. Open Admin → Email alerts. Make one clearly labelled test pre-booking, confirm it appears in Admin and that its email reaches the owner's inbox, then cancel that test booking. This feature does not email customers.

The email includes the saved reference, customer name, country, submission time in IST, selected products/quantities, the customer-visible prices and a protected booking-detail link. It omits phone numbers, customer email addresses and remarks. Original CFA source prices and historical display snapshots are unchanged.

Check the email provider's current sending allowance before distribution. Provider quotas and delivery/spam filtering still apply; no paid email plan is purchased automatically. Account/sender setup errors and failed deliveries are visible in the protected Email alerts page.

## Reliability and data safety

- Migration `20261014140000_booking_email_alerts` adds one initially empty PostgreSQL queue table and indexes. It does not reset data, edit prices or backfill notifications for old bookings.
- When enabled, one queue entry is saved in the same transaction as each genuinely new booking. The unique booking ID and existing request key prevent duplicate queue entries on customer retries.
- A small background worker runs inside the existing Railway application process. It uses at most two separate database connections, makes at most five sequential delivery attempts per batch, and checks every fifteen seconds. The public application does not wait for its HTTP requests.
- Row leases and `SKIP LOCKED` protect concurrent instances. Crashed leases can resume after two minutes. The email payload and destination are frozen before sending; changing settings cannot alter an in-flight retry's content or recipient.
- A stable provider idempotency key covers ambiguous retries. Automatic retries stop after eight attempts or twenty-three hours from the first attempt, before the provider's twenty-four-hour idempotency window expires. Uncertain old deliveries are marked for review rather than blindly sent again. Check Resend before sending such an alert manually.
- “Accepted by email service” means the provider accepted the send request. It is not proof of inbox delivery. Check spam, bounces and the provider dashboard when needed.
- Disabled alerts create no new jobs. Queued unsent jobs remain in PostgreSQL if the worker is disabled and can be reviewed in Admin. No old bookings are automatically backfilled when enabled later.
- API keys remain server-side. There are no public send-email endpoints, arbitrary recipients, customer-triggered test-email endpoints or anonymous analytics changes.

## Verification

Unit and database tests exercise saved CFA/USD prices, mixed and request-only bookings, settings validation, provider failures/quotas, atomic queue uniqueness, frozen retry content, crashed leases, completed-job deduplication and safe expiration. Browser tests exercise the actual booking route's queue and retry behavior and protected admin visibility. All test email HTTP calls use a fake provider; real owner inbox delivery requires the final account-side setup/test.
