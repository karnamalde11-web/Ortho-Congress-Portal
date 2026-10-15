# Live deployment and pre-launch handover

Updated 14 October 2026. This replaces the original setup handover, whose pending-service notes are now obsolete.

- Live URL: https://ortho-congress-portal-production.up.railway.app.
- Repository/auto-deployment branch: `karnamalde11-web/Ortho-Congress-Portal`, `main`.
- Services: Next.js website, Railway PostgreSQL with persistent `postgres-volume`, and a separate private object-storage bucket.
- Catalogue: 220 products, six categories, 14 Price on Request items, and 220 distinct image-object references. Images match the original workbook/ZIP. TI-049 uses TI-050.jpeg; TI-050 uses TI-051.jpeg. Some source files share identical picture content; this is already present in the supplied ZIP.
- Image storage: bucket `expandable-cornucopia-ugma2w`, endpoint `https://t3.storageapi.dev`. The linked image objects occupy about 2.2 MB and are separate from the application's disposable container filesystem.
- Owner-confirmed plan: Pro, upgraded by the owner after reviewing its $20 monthly minimum, including $20 of usage credits. The assistant did not change billing. The initial Hobby audit reading was $0.11 usage against a $5 allowance.
- Owner-reported database volume: 500 MB maximum, about 105 MB used. This is a volume reading, not a direct `pg_database_size` measurement.
- Owner confirms the first PostgreSQL backup was created successfully and daily scheduled backups are enabled. This resolved the initial launch blocker. Backup evidence is the owner's private account-side confirmation; no production restore drill was performed.

## Safe deployment and verification

Read `/api/health` for the deployed commit and compare it with GitHub `main`. `status: ok`, all readiness flags and `existingBookingsPreserved: true` are required. Normal startup applies migrations and checks existing booking/item IDs. Never reset production, delete real bookings, restore development data, or share secrets.

The audit fixes concurrent retries of the same request key so they return the existing receipt rather than a uniqueness error. A global runtime database client bounds the shared application connection pool to ten connections. These fixes require no new migration, service, variable or storage/billing change.

The full audit's live measurements and verification artifacts are kept separately from this operational note. An owner must review authenticated production records privately. Any AUDIT TEST bookings must remain clearly labelled and be cancelled after review so they do not inflate active stock demand. Cancelling preserves history and does not delete customers' records.

## Optional owner email alerts

The booking-alert update adds an empty PostgreSQL delivery queue and a protected `/admin/notifications` page. Existing bookings and catalogue prices are unchanged. No alerts are sent retroactively. The worker runs inside the existing application service and uses at most two additional database connections only when email settings are ready.

Alerts remain disabled until a Resend account is connected. The owner chose the existing Admin sign-in email as recipient. See [email alert setup](EMAIL-ALERTS.md) for private Railway variable entry and the owner inbox test. No paid email subscription is authorised automatically. `/api/health` also reports `emailAlertsReady` for the queue migration; this readiness flag does not claim the external account is connected or mail reached an inbox.

## Receipt clarity update (15 October 2026)

Confirmations now distinguish fully priced, mixed and request-only bookings and include saved product lines and browser Print / Save Receipt. The protected admin receipt route uses the same saved booking snapshots. There is no migration or new service/variable; existing prices and records are unchanged. See [receipt behavior and verification](RECEIPTS.md).

## Recovery instructions

An application crash or normal redeployment does not erase the separate PostgreSQL volume or image bucket. The configured website restart policy allows three retries. If a deployment fails, keep the healthy release running or redeploy the last known good release through Railway; do not reset the database. Database rollback is a separate operation and requires a verified backup and migration review. A persistent volume alone is not a backup. CSV/XLSX reports are useful working copies, but are not a complete PostgreSQL restore backup.
