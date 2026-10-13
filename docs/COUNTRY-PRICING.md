# Country-based customer pricing

Country is selected above the public catalogue. It also suggests the WhatsApp calling code, which can be overridden independently. Only Country determines the selling currency; there is no currency selector.

The CFA zone is the owner's explicit 14-country list, represented by ISO country identifiers. All other countries use USD. Product `priceCfa` remains the unchanged source of truth. USD unit prices use the fixed divisor 625 with nonnegative half-up whole-dollar rounding. Quantities multiply the rounded unit price; the subtotal sums these line amounts. All financial arithmetic uses integer minor units. Price on Request remains NULL, with a separate priced subtotal and unknown full total.

The shared price calculation is used by the catalogue and the server. No rate, formula or conversion explanation is rendered on the public site. Incoming prices, totals and currency fields are rejected; the server derives prices and currency from PostgreSQL products and the validated Country.

## New booking snapshots

The existing `currency` field records what the customer saw. New nullable columns are:

- Booking: `pricedSubtotalDisplay` and `totalDisplay`.
- BookingItem: `unitPriceDisplay` and `lineSubtotalDisplay`.

Existing CFA unit prices, CFA totals, quantities and selected country remain stored alongside these snapshots. All new bookings save display snapshots atomically with their items. Blank prices remain NULL; a genuinely zero or rounded-zero price remains numeric zero.

The additive `20261013140000_display_price_snapshots` migration adds columns and nonnegative constraints only. It does not update products, existing bookings, their currencies, their prices or their references. NULL display subtotals identify earlier bookings; the admin reads their original CFA snapshots without recalculating from today's country policy. For new USD bookings the dashboard shows the stored dollar unit prices and line/subtotals; CFA source prices are available in a separate internal detail section.

The catalogue supplies each product's update timestamp. The booking API requires the current country-pricing policy and matching product timestamps. Older open pages or changed product details are rejected with a request to refresh and review, preventing silent repricing. Idempotent retries return the original saved booking and its stored prices.

## Railway rollout

No new service, secret or environment variable is needed. Railway applies the migration through the existing startup script before serving the new release. Its existing booking/item preservation check must pass. `/api/health` reports `currencySnapshotsReady: true` only after all four snapshot columns exist. Verify the exact deployed commit and the preservation result, then test CFA and USD countries, mobile layouts, current-source prices and a labelled sample reservation.

Do not run a database reset or backfill older bookings using new USD rules. Historical records must retain the prices originally shown.
