# Railway deployment — guided, one action at a time

The application, real 220-product catalogue and image corrections are prepared. Local tests do not mean the website is live. GitHub publication, Railway accounts and the real private storage bucket must be completed before public verification.

The owner does not need to write code or run terminal commands. The developer will give one account-side action at a time and wait for confirmation. Do not paste passwords or access keys into chat.

## 1. Publish the code

The completed project is committed locally before publication. `.env`, dependencies and temporary test outputs are excluded. The originals in `catalogue-source/` are included so the production import can reproduce all 220 products and the two approved image corrections.

The owner authorises publication to `karnamalde11-web/Ortho-Congress-Portal`. The developer then pushes the reviewed commit to `main` using the existing GitHub connection, without a forced push, and verifies the remote commit. If access is rejected, use the platform's GitHub connection settings; do not supply a token in chat.

The next account-side action after confirmed publication is to sign into Railway. Follow-up actions will be given separately, not as an entire checklist to perform at once.

## 2. Services to create

| Where   | Service                                                         | Purpose                                                      |
| ------- | --------------------------------------------------------------- | ------------------------------------------------------------ |
| Railway | PostgreSQL, named `Postgres`                                    | Production products, prices, pre-bookings and admin sessions |
| Railway | Website from the GitHub repository                              | Public catalogue and admin dashboard                         |
| Railway | One private S3-compatible Bucket (already created by the owner) | Product images                                               |

No Redis or payment service is needed. The initial website has one replica. The development database, storage simulator, test accounts and sample booking must not be copied to production.

The developer will guide creation of an empty Railway project, addition of PostgreSQL, connection of the private Railway bucket and its generated credentials, and connection of the GitHub website service. Keep the bucket private and use its generated S3-compatible credentials.

## 3. Variables — who supplies them and which are private

Enter application variables in the **website service → Variables** panel, not in the PostgreSQL service. The developer will guide each entry separately.

| Name                   | Value/source                                                                                                | Who creates it?                                                                    | Private?                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `DATABASE_URL`         | `${{Postgres.DATABASE_URL}}` if the database service is named Postgres; select Railway's database reference | Railway generates the connection details; owner binds the reference to the website | **Yes**, the resolved URL contains database credentials                 |
| `PORT`                 | Supplied by Railway; application also defaults to 3000                                                      | Railway                                                                            | No; do not set it manually                                              |
| `NODE_ENV`             | `production` is already set in the Docker image                                                             | Application configuration                                                          | No; do not set it manually                                              |
| `APP_URL`              | Exact HTTPS URL generated for this website, with no extra path                                              | Railway generates the public domain; owner copies it into this setting             | No                                                                      |
| `S3_ENDPOINT`          | HTTPS S3 endpoint shown in the Railway bucket connection settings                                           | Railway; owner binds or copies it                                                  | No                                                                      |
| `S3_REGION`            | Region shown in the Railway bucket connection settings                                                      | Fixed application setting; owner enters it                                         | No                                                                      |
| `S3_BUCKET`            | Actual private bucket name                                                                                  | Railway supplies the actual bucket name                                            | No                                                                      |
| `S3_ACCESS_KEY_ID`     | Access Key ID from the Railway bucket credentials                                                           | Railway generates it                                                               | **Keep private**                                                        |
| `S3_SECRET_ACCESS_KEY` | Secret Access Key from the same Railway bucket credentials                                                  | Railway generates it                                                               | **Keep private**                                                        |
| `INITIALIZE_CATALOGUE` | `true` for the first catalogue setup; remove after successful verification                                  | Owner enables it when instructed                                                   | No                                                                      |
| `INITIALIZE_ADMIN`     | `true` for the first admin setup; remove after successful verification                                      | Owner enables it when instructed                                                   | No                                                                      |
| `ADMIN_EMAIL`          | Owner's chosen sign-in email                                                                                | Owner                                                                              | Personal account information                                            |
| `ADMIN_PASSWORD`       | Unique password of at least 14 characters and at most 72 UTF-8 bytes, saved in a password manager           | Owner                                                                              | **Secret — enter only in Railway; remove after successful admin login** |

Keep the Railway bucket credentials private and use service references where the Variables panel supports them. Never use the localhost/S3RVER development settings on Railway. Never enter production secrets into GitHub files, source code, screenshots or chat.

## 4. Deployment without terminal commands

The Docker image runs `scripts/deploy-start.mjs` automatically:

1. Checks required database, origin and storage settings.
2. Applies the included Prisma migrations using `prisma migrate deploy`.
3. If `INITIALIZE_CATALOGUE=true` and the product table is empty, imports the source workbook and ZIP, uploads/verifies all 220 image objects and verifies every PostgreSQL product against Excel.
4. If `INITIALIZE_ADMIN=true`, securely creates the selected admin with a bcrypt password hash. An existing admin is left unchanged, including its password.
5. Removes setup credentials/flags from the website child process and starts Next.js as a non-root user on Railway's port.

The owner only enters Variables and applies/deploys the changes through Railway's website. No shell is necessary for the normal setup. The `/api/health` check verifies database connectivity, with up to 300 seconds allowed for first startup. If the initial setup needs longer, inspect the actual logs before adjusting the timeout.

After we verify catalogue and admin login, remove `ADMIN_PASSWORD`, `INITIALIZE_ADMIN`, `INITIALIZE_CATALOGUE` and the temporary `ADMIN_EMAIL` setting through the Variables panel. Password removal does not delete the admin account. Subsequent deployments apply migrations without re-importing catalogue prices or replacing passwords. The importer now skips a non-empty product table, even if the initial setup flag was left enabled, to preserve live catalogue edits. Remove these temporary flags after initial verification.

## 5. Public deployment verification

The developer will request only the public website URL, then check:

- HTTP health response with `status: ok` from `/api/health`.
- Six categories and the real catalogue; filtering, code/name search and quantities.
- Exact CFA values and the 14 Price on Request products.
- All images, including TI-049 → TI-050.jpeg and TI-050 → TI-051.jpeg.
- Mobile layout and image loading at a phone viewport.

For the production test booking, the owner may sign in privately and confirm its reference in the dashboard, or explicitly authorise a separate temporary verification account. The owner will never send their password in chat. The test booking must be labelled SAMPLE ONLY — do not contact or fulfil. Verify its server-priced items and total/subtotal, then mark it cancelled after the check. Finish with another production health check and a physical-phone check by the owner.

The real Railway URL, storage bindings and admin sign-in have not yet been supplied. None of these public deployment checks may be described as completed until actually performed.

## Developer fallback

If a supported Railway account flow requires a one-off task, the prepared commands are `npm run db:migrate`, `npm run catalogue:import`, `npm run catalogue:verify` and `npm run admin:create`. They are for the developer/operator, not instructions for the owner to type. Source imports preserve product identities and use repeatable image object names. Do not restore the development database, which contains localhost image URLs and a marked sample booking.

The production Dockerfile uses ordinary Docker instructions supported by Railway. It contains no secret mounts or cloud-specific build certificate settings. Standard public certificate trust is installed in the image; no custom certificate, VPN, TLS bypass or checksum override is required. Package, artifact checksum, TLS and Debian signature verification remain enabled.

## Live customer-details update (13 October 2026)

The additive `20261013090000_customer_details` migration adds nullable city, country, specialty, other-specialty, WhatsApp country code and national-number columns. Existing records are not rewritten; all new submissions require the customer details in both browser and server validation. Full international WhatsApp numbers are saved in the existing `phone` field as well as the separate components. Earlier phone numbers are displayed exactly as originally stored.

Deployment captures existing booking and booking-item IDs before applying migrations and checks their continued presence afterwards. Startup stops if that check fails. A private deployment audit records the result. `/api/health` reports the deployed Git commit, schema readiness and the preservation result without exposing booking details or counts. The new migration only adds columns; there is no reset, row deletion or price transformation.

References display as `NM-<submission year>-<complete original booking ID>` in the confirmation and dashboard. This retains all original IDs and does not invent a sequential booking number.

For this update, push the tested commit normally to `main`; Railway's existing GitHub integration builds and runs the migration automatically. No new service, environment variable or manually entered database command is required. Check `/api/health` for the new release and both readiness/preservation flags, then verify the form and images at 375, 390 and 430 pixels. Sign in privately at `/admin` to review the labelled production test booking and mark it cancelled after verification. Do not share the sign-in password with the developer.

## First-party analytics update (13 October 2026)

The existing website and PostgreSQL services handle analytics; no new service or environment variable is needed. The additive `20261013153000_anonymous_analytics` migration creates three analytics tables without modifying existing bookings or catalogue rows. Normal deployment startup applies it and verifies existing booking/item IDs remain present.

After the tested update is pushed to `main`, Railway deploys automatically. Verify `/api/health` reports the new release, `analyticsReady: true` and `existingBookingsPreserved: true`. Verify first-party tracking cookies are issued only after the public tracking transaction succeeds, refreshes reuse the session, and anonymous access to `/admin/analytics` redirects to login. The owner can sign in privately and use **Visitor analytics** in the admin dashboard. No admin password should be shared.

Analytics begins with this deployment and cannot reconstruct earlier anonymous visits. The privacy page provides an opt-out; daily cleanup removes old anonymous visits after 90 days while retaining real pre-bookings. See [analytics definitions and privacy limits](ANALYTICS.md).

## Compact booking management update (14 October 2026)

The additive `20261014090000_booking_management` migration adds Quotation Sent, Invoice Sent, Paid and Collected statuses plus query indexes. It does not rewrite or delete any historical booking, item or product. Push the tested commit to `main`; the existing Railway integration applies the migration and checks preserved booking/item IDs automatically. No new service, variable or owner-entered database command is required.

Verify `/api/health` reports the new release, `bookingManagementReady: true` and `existingBookingsPreserved: true`. Anonymous access to `/admin`, `/admin/bookings/<id>` and `/admin/stock` must redirect to sign-in; all export variants must return 401 without an admin session. The owner then signs in privately to review the Active table and download reports. See [booking management instructions](BOOKING-MANAGEMENT.md).

## Optional email alerts update (14 October 2026)

Migration `20261014140000_booking_email_alerts` adds an empty, durable queue without changing historical bookings or products. Existing deployment startup applies it and verifies booking/item preservation. Health adds `emailAlertsReady: true`; this confirms the database architecture, not email-account activation or inbox delivery.

No additional Railway service is needed. Alerts remain off until `BOOKING_EMAIL_ENABLED=true`. The optional website-service variables are `RESEND_API_KEY` (private), `BOOKING_EMAIL_TO=admin`, and `BOOKING_EMAIL_FROM` (a plain sender email address). Use only server-side variable names. The owner chose their existing Admin email. The provider account must be connected and one real owner inbox alert checked before calling email notifications active. Public pre-bookings continue to save even while email sending is unavailable. See [guided setup and reliability limits](EMAIL-ALERTS.md).
