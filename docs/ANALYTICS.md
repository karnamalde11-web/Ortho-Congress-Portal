# First-party visitor analytics

The private dashboard is `/admin/analytics`, linked from the existing authenticated admin dashboard. No new Railway service, analytics provider account, secret or environment variable is required. Tracking starts after this deployment; earlier anonymous visits cannot be reconstructed.

## Definitions

- **Session / visit:** public catalogue activity under one random session ID. Refreshes and concurrent tabs share an active visit. A new visit starts after 30 minutes without recorded activity. Active user interactions refresh activity timestamps at most once per minute when their events are already deduplicated.
- **Unique visitor:** an approximate browser/device identified by a random first-party cookie lasting 90 days. There is no login, IP matching or fingerprinting. Returning visits with that cookie share a visitor hash. Different browsers/devices or cleared cookies can count separately.
- **Submitted pre-booking:** a successfully committed PostgreSQL booking. Conversion is recorded by the server, not by trusting a browser event. One visit can submit multiple bookings; the funnel counts that converted visit once. Cancelled bookings still count as having been submitted.
- **Started but not submitted:** sessions with product interaction, a positive quantity or customer form entry, and no successful submission, including sessions still active.
- **Abandoned:** started sessions without submission after at least 30 minutes inactive. Opening the website without meaningful interaction does not count as abandonment. This is a session status, not a claim about a person's identity or profession.

Conversion rate is converted public sessions divided by public sessions, not booking count divided by visitor count. The funnel requires each earlier action to have occurred before counting the later stage, but does not require actions to occur in chronological order. Independent approximate visitor counts for product, quantity and form activity are also shown.

The Pre-Bookings card includes records created during the selected period, including older/untracked or privacy-disabled submissions; these are separately labelled. They are excluded from the tracked-session conversion denominator. Session breakdowns use visit-open dates. Dates, daily grouping and recent visit times use IST (Asia/Kolkata). Country means the latest catalogue choice, defaulting to Senegal, and is not geolocation. Device is a broad initial screen-width category.

## Data and safeguards

The additive `20261013153000_anonymous_analytics` migration creates AnalyticsVisit, AnalyticsEvent and AnalyticsConversion. It does not alter existing booking/product rows or columns. A conversion points to the real booking and optionally its anonymous visit. Deleting expired visits cascades only their events and clears the conversion's visit pointer; real bookings remain intact.

Tracking lives only in the public catalogue component. Admin/login/analytics pages do not emit events. The tracking API requires the correct request origin and a public-root referrer; authenticated staff are also excluded when viewing the catalogue. No public endpoint exposes analytics counts. Server-side admin authentication guards the reporting page before querying statistics.

Events are batched, deduplicated in the browser, and uniquely constrained by session/type/key in PostgreSQL. Session creation is serialized for a visitor hash to avoid concurrent-tab duplication. Requests and event counts are bounded. Bookings commit independently; analytics failures never roll back them, and the booking response waits at most 150 milliseconds for best-effort attribution. Privacy-disabled or unavailable tracking can therefore leave bookings unattributed.

Anonymous analytics does not store names, phone numbers, email addresses, typed form values, IP addresses, raw browser user-agent strings, complete URLs or referral paths/query strings. Visitor cookie IDs are randomly generated, with only their hash stored in the visit table. The server resolves product/category metadata from the catalogue. Referrers retain only registrable domains, excluding IPs and this portal's own domain.

UTM source/medium/campaign values are retained only if present in explicit approved public-tag allowlists. Free text, unknown tags and `utm_term`/`utm_content` are discarded to avoid contact-detail leakage. Example supported link parameters are `utm_source=whatsapp&utm_medium=qr&utm_campaign=ortho-congress-2026`. New public campaign tags should be reviewed and added to the allowlist before distribution.

Do Not Track, Global Privacy Control and the opt-out setting on `/privacy` suppress tracking. Cookies are first-party, HTTP-only and Secure in production. Clearing cookies, blocking JavaScript/cookies, privacy controls, shared devices and automated traffic limit accuracy. Once a booking is submitted, authorised admins can associate its provided booking details with that session internally; the resulting linkage is pseudonymous, not permanently unidentifiable.

Daily cleanup in the existing Railway start process removes inactive anonymous visits older than 90 days and their anonymous rate-limit entries. Request-time cleanup is a fallback. Actual bookings are retained. Startup reapplies normal migrations and runs the existing booking/item preservation check; `/api/health` reports `analyticsReady` only when the analytics tables exist.
