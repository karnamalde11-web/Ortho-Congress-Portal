# Neu Micromed / Ajanta exhibition pre-booking

A mobile-first Next.js application with TypeScript, Tailwind, PostgreSQL, Prisma, database-backed admin sessions, Excel catalogue imports and private S3-compatible image storage. Doctors submit pre-bookings; no payment is collected.

## For the project owner

1. Your supplied catalogue is integrated: 220 products, six categories and 220 matched images. See docs/CATALOGUE-IMPORT.md for the import report and the two user-approved filename corrections.
2. You will need a Railway account for hosting and a private S3-compatible bucket. Cloudflare R2 is a suitable default. Keep account passwords and storage keys private; enter them in hosting settings when guided.
3. Before launch, confirm the displayed organisation name, price/tax wording, contact details, booking terms and privacy retention policy. The current privacy notice is a starting point.
4. The application must pass the production build and end-to-end checks before launch. See `docs/VALIDATION.md` for the current status.

## Development

Use Node 22.12+ or Node 24. Use the existing checkout; cloud tasks are already isolated and need no extra Git worktree.

```sh
cp .env.example .env
npm ci
npm run db:migrate
npm run dev
```

Use a dedicated development PostgreSQL database. `DATABASE_URL` is required. `APP_URL` must exactly match the public application origin, including scheme and port. Never use the example database password in production.

```sh
npm test
npm run build
npm run typecheck
```

Create an admin with `npm run admin:create`, after securely setting `ADMIN_EMAIL` and `ADMIN_PASSWORD` (at least 14 characters, at most 72 UTF-8 bytes) in the process environment. There is no public registration. Remove `ADMIN_PASSWORD` afterwards. Existing admins are not overwritten. Password recovery currently requires an operator; do not expose a reset route without a verified email workflow.

## Catalogue imports

The supported exhibition workbook has one worksheet per category. Sheet names are preserved exactly as categories, including `Equipments` and `Instrument Set`. Each sheet starts with `Code`, `Product Name`, and `Price CFA` (or `Prices CFA`). Codes and names are preserved verbatim; blank prices become **Price on Request**, never zero. CFA values are stored as exact PostgreSQL decimals, with no currency conversion or INR assumption. The older five-column template is still supported, with its Price column now interpreted as CFA.

The supplied originals are retained under `catalogue-source/` as import sources, not public images or a runtime database. All catalogue reads use PostgreSQL. Actual image files are served from private object storage via short-lived signed URLs; PostgreSQL contains only their stable object URLs.

```sh
npm run catalogue:inspect  # validate and write an inspection report; no catalogue writes
npm run catalogue:import   # upload images, verify storage and upsert the full source catalogue
npm run catalogue:verify   # compare every database product to Excel and verify every image object
```

Import first requires DATABASE_URL and the S3 settings in `.env.example`. Never use local simulator credentials in production. Uploaded archives are not blindly extracted. Formula rows, invalid prices and duplicate product codes block catalogue writes and are listed in the report. Duplicate image filenames/stems are reported and excluded from automatic matching. Matching is exact and case-sensitive. No product is invented for an unmatched image.

The two approved image corrections live in `catalogue-source/image-corrections.json` and apply only when the uploaded ZIP's SHA-256 matches the supplied source archive. TI-049 uses TI-050.jpeg; TI-050 uses TI-051.jpeg. Catalogue code/name/price values are not changed by these filename corrections.

Images are decoded, bounded to 25 million input pixels, resized to at most 1600 × 1600, stripped of metadata and stored as WebP objects. Up to 5 MB per image, 100 MB expanded per archive, and 20 MB uploaded. The repeatable source importer uses content-addressed object names; rerunning it creates no duplicate products. The admin uploader also accepts the original workbook/ZIP and recognises the approved corrections. Reports are visible in the dashboard.

Re-importing a code updates the current catalogue while preserving historical booking snapshots. Products omitted from a file are not silently deactivated. Failed uploads or replaced images can leave unreferenced objects; periodically clean these only after checking current product URLs.

## Data and security

- PostgreSQL is the source of truth; the temporary cart stays in React memory and contains no persistent order data.
- Submitted product IDs, quantities and doctor details are validated server-side. Client prices are rejected. Product availability and CFA prices are read from PostgreSQL; bookings store exact historical code, name, category and price snapshots. A booking containing any unpriced item has a null full total and a separately stored priced subtotal, so unknown prices cannot appear as free products.
- A request UUID prevents duplicate submissions. Booking confirmation exposes only the reference, not personal information.
- Admin passwords use bcrypt with cost 12. Sessions use random 256-bit tokens; only SHA-256 token hashes are stored. Cookies are HTTP-only, SameSite Strict and Secure in production, expiring after eight hours.
- Admin mutations and booking submissions verify the configured origin. Login throttling is stored in PostgreSQL; booking throttling is per phone. Add edge-level abuse protection before public launch.
- Import and booking-status actions produce audit records. Booking lists are paginated.
- Image buckets remain private; public catalogue image requests receive short-lived signed URLs.
- Never submit patient details. Establish a retention/deletion policy, database backups and monitoring before launch.

Deployment instructions: [Railway guide](docs/RAILWAY.md). Railway startup automatically applies migrations. The first catalogue import and admin creation are enabled through temporary Railway Variables; no terminal is needed for the owner. See [deployment status](docs/DEPLOYMENT-STATUS.md) for the pending account-side steps.

## Browser regression tests (development only)

Start PostgreSQL, set `.env` to the local development database and `APP_URL=http://localhost:3000`. For image checks run `node scripts/dev-storage.mjs` and use `S3_ENDPOINT=http://127.0.0.1:9000`, `S3_BUCKET=ortho-images`, `S3_REGION=auto`, and `S3_ACCESS_KEY_ID=S3_SECRET_ACCESS_KEY=S3RVER`. These are public simulator credentials, never production credentials. Start the production server after `npm run build`.

```sh
ALLOW_TEST_SEED=yes node scripts/seed-smoke.mjs
TEST_DATABASE_URL=postgresql://ortho:development-only@localhost:5432/ortho npm test
npm run test:e2e
ALLOW_TEST_SEED=yes node scripts/clean-smoke.mjs
```

Browser tests default to `/usr/bin/chromium`. Set `CHROMIUM_PATH` to your local Chromium executable. Tests modify only a disposable development database; never run them against production. The CI workflow currently covers database/validation tests, build, types and dependency audit; the browser workflow was run manually in this cloud environment.
