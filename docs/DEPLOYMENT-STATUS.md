# Live deployment and pre-launch handover

Updated 14 October 2026. This replaces the original setup handover, whose pending-service notes are now obsolete.

- Live URL: https://ortho-congress-portal-production.up.railway.app.
- Repository/auto-deployment branch: `karnamalde11-web/Ortho-Congress-Portal`, `main`.
- Services: Next.js website, Railway PostgreSQL with persistent `postgres-volume`, and a separate private object-storage bucket.
- Catalogue: 220 products, six categories, 14 Price on Request items, and 220 distinct image-object references. Images match the original workbook/ZIP. TI-049 uses TI-050.jpeg; TI-050 uses TI-051.jpeg. Some source files share identical picture content; this is already present in the supplied ZIP.
- Image storage: bucket `expandable-cornucopia-ugma2w`, endpoint `https://t3.storageapi.dev`. The linked image objects occupy about 2.2 MB and are separate from the application's disposable container filesystem.
- Owner-confirmed plan: Hobby, $0.11 usage against a $5 allowance at the time of the audit. No billing change is authorised by this note.
- Owner-reported database volume: 500 MB maximum, about 105 MB used. This is a volume reading, not a direct `pg_database_size` measurement.
- **Launch blocker:** owner confirms no PostgreSQL backups exist. Railway's account UI requires Pro to create backups, schedules or point-in-time recovery. A first recoverable backup and an ongoing backup method must be established before launch; do not change billing automatically.

## Safe deployment and verification

Read `/api/health` for the deployed commit and compare it with GitHub `main`. `status: ok`, all readiness flags and `existingBookingsPreserved: true` are required. Normal startup applies migrations and checks existing booking/item IDs. Never reset production, delete real bookings, restore development data, or share secrets.

The audit fixes concurrent retries of the same request key so they return the existing receipt rather than a uniqueness error. A global runtime database client bounds the shared application connection pool to ten connections. These fixes require no new migration, service, variable or storage/billing change.

The full audit's live measurements and verification artifacts are kept separately from this operational note. An owner must review authenticated production records privately. Any AUDIT TEST bookings must remain clearly labelled and be cancelled after review so they do not inflate active stock demand. Cancelling preserves history and does not delete customers' records.

## Recovery

An application crash or normal redeployment does not erase the separate PostgreSQL volume or image bucket. The configured website restart policy allows three retries. If a deployment fails, keep the healthy release running or redeploy the last known good release through Railway; do not reset the database. Database rollback is a separate operation and requires a verified backup and migration review. A persistent volume alone is not a backup. CSV/XLSX reports are useful working copies, but are not a complete PostgreSQL restore backup.
