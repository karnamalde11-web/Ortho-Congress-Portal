# Booking management

Open `/admin` and sign in privately. The default **All Active** table excludes Cancelled bookings. Each page shows 25 bookings; filters and pagination run against PostgreSQL. Clicking a row, reference, customer name or View opens only that booking. **Back to Bookings** restores the list filters and page.

## Find and manage bookings

Use quick tabs or the Status dropdown: All Active, New, Contacted, Quotation Sent, Invoice Sent, Confirmed, Paid, Collected, Cancelled and All. All includes historical cancelled bookings. Cancellation hides a record from normal operations; it does not delete the booking or products.

Search accepts a full reference, customer name, hospital/clinic, WhatsApp number or email. Partial searches are case-insensitive, with literal `%` and `_` characters. Filters also include country and an inclusive date range in IST. Earlier records with no country have a separate “Not recorded” choice. Sort by newest, oldest, customer name or highest value. Value sorting uses original CFA priced subtotals as a common basis; the table and exports still show the original customer-facing currency and stored prices. Price on Request items have no assumed value.

Summary cards cover all bookings, independently of the selected list filters. Active, New, Confirmed, Paid and total active product units exclude Cancelled. The Cancelled card is separate. “Products” in a booking row/export means selected product lines; the active product-units card sums their quantities.

The detail view preserves contact details, specialty, remarks, price snapshots, full WhatsApp number, reference and submission date. Changes recorded in the existing audit log appear in Status history, including earlier entries where available. No history is invented. New changes record old and new statuses. Concurrent stale status updates are rejected; refresh to review the newer status. Paid is an administrative tracking label, not a public payment facility.

## Exports and stock planning

In **Export reports**, Summary and Booking items are available as CSV or XLSX. The export uses all matching bookings across every page, not just the 25 visible rows. **Export All Active Bookings** clears search, country and date filters and exports every non-cancelled booking. To export cancelled history, explicitly select Cancelled or All before using a filtered summary/items export.

Use **Stock requirements** or **View product-wise stock requirements** for product code, name, category, distinct booking count and summed quantity. It defaults to active bookings and supports status, country, date and customer-search filters. Stock reports exclude Cancelled even when All is selected; Cancelled must be chosen explicitly to report historical cancelled demand. Stock reports are also available as CSV/XLSX. Aggregation runs inside PostgreSQL and does not load every booking item into the page.

Prices in summary/item exports use stored customer price/currency snapshots, with the original CFA fallback for earlier bookings. Source catalogue prices and historical snapshots are not recalculated. Price on Request cells are blank with an explicit Yes flag. Excel exports use numeric price/quantity cells, text phone fields, a frozen header and filterable columns. CSV exports escape quotes/newlines and neutralize spreadsheet formulas in text; a protective apostrophe may appear before a WhatsApp number or formula-like remark in raw CSV readers. XLSX preserves text values as text.

Downloads are private, authenticated and marked no-store. Export generation streams bounded batches, with no silent row cap. They are live reports: a status change occurring during a long-running export can affect membership. Refresh/re-export after completing status updates for the final congress stock plan. CSV/XLSX downloads contain customer contact details; keep them within the authorised team.

## Safe deployment

`20261014090000_booking_management` adds four enum statuses and indexes for status/date, country/date and status-history queries. Existing booking/product rows, IDs, prices and status values are unchanged. There is no reset, deletion, re-import or new Railway service/environment variable. Normal Railway startup applies the migration and verifies existing booking/item IDs remain present. Health reports `bookingManagementReady` only when the new statuses and booking indexes exist.

Local tests exercise filters, exports, stock totals, history, privacy guards and preservation using development-only fixtures. The developer can verify the live public site and unauthenticated private-route protections; reviewing real production bookings/downloads requires the owner's private admin sign-in. No password should be pasted into chat.
