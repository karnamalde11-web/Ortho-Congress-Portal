# Current validation evidence

These checks ran in the cloud environment against the real supplied catalogue and a production build.

- 20 unit/integration tests passed, including five Railway setup tests for migrations, conditional catalogue import, secure admin creation and restart safety. The original 15 checks cover: server validation, rejected client prices, exact CFA arithmetic, null versus zero prices, mixed-priced booking totals, every source worksheet, exact source text and prices, duplicates/malformed rows/invalid prices, ambiguous image mapping, archive-bound approved corrections, image decoding/resizing, bounded request bodies and PostgreSQL constraints/historical price preservation.
- The database migration deployed successfully to development PostgreSQL 17 and a separate migration-test database. Prisma schema comparison reported no differences.
- A repeat source import preserved all 220 product IDs and image URLs without duplicates.
- All 220 PostgreSQL products were compared to their source Excel rows. All six categories and 14 blank prices match. All 220 object-storage image objects were verified.
- Four Chromium browser tests passed at a 390 × 844 mobile viewport: real-category filtering, code/name search, real CFA values, both corrected images, quantity selection, a mixed-priced sample booking verified in admin, plus admin sessions/status updates and import/upload regression checks.
- TypeScript checks, ESLint (zero warnings), the production build and the production dependency audit passed.
- The sample booking is retained in development only and is explicitly marked SAMPLE ONLY — do not contact or fulfil. Temporary smoke-test products/admin credentials were removed; there are still exactly 220 catalogue products.

The configured storage is a local S3-compatible development service. Real Railway deployment, real bucket credentials and a physical-device check remain outstanding. The earlier Docker proxy/trust failures were resolved using the existing proxy and verified certificate trust. The Docker image builds successfully; a local container applied migrations to a fresh database, imported and verified all 220 products/images, created a first admin and passed health, mobile-image and admin-login checks. This container test uses development database/storage bindings, not a live Railway account.

TLS, package integrity and Prisma artifact checksum verification remained enabled. Real deployment must run the import against its own PostgreSQL and private object storage so that no localhost image URLs enter production. The source workbook and ZIP are retained as import sources, not hardcoded runtime catalogue data.
