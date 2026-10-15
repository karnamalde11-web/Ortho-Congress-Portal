# Customer confirmation and printed receipts

The successful confirmation and the print receipt use the booking and booking-item records returned after the database transaction commits. They do not read current catalogue prices or re-run country currency conversion. Retrying the original successful request returns the saved booking snapshot; it does not reprice or create a new booking.

## Pricing messages

- All products priced: **Total: [saved amount]**. No Price on Request warning appears.
- Mixed: **Confirmed priced items: [saved priced subtotal]**, **Price on Request items: [number of distinct request-priced products]**, and **Final total: [saved amount] + price of the Price on Request item(s)**. The explanatory message says the team will confirm the final amount after pricing those items. Quantities appear in the item list; request-priced product counts are not confused with unit counts.
- Request-priced products only: **Final total: On Request**, followed by the team's pricing-confirmation message. No zero subtotal is presented as a total.
- The same rules apply to saved CFA and USD prices, without exposing conversion rates or formulas.

The confirmation lists each saved code, name, quantity, unit price and line total. Unknown prices display Price on Request. At narrow screen widths the product table becomes labelled rows; its data and accessibility roles remain available.

## Print / Save Receipt

After successful submission, choose **Print / Save Receipt** next to **Return to catalogue**. The browser's normal print dialog supports printing or saving as PDF according to the device/browser. No PDF service or new dependency is needed. Print before leaving the confirmation: it remains in page memory, not browser storage, and a page refresh returns to the catalogue without resubmitting.

Print CSS hides the surrounding website header, footer, introduction, navigation and action buttons. The receipt contains the portal title, original reference, submission time in IST, saved customer details, optional email, saved products/prices, pricing summary, congress-collection statement and follow-up text. Product rows avoid splitting across pages and table headers repeat on multi-page receipts. Browser/device print controls and optional browser-generated headers/footers remain controlled by the browser.

Admins can reopen any saved booking and select **Print / Save Receipt**. `/admin/bookings/[id]/receipt` requires the existing secure admin session and uses the same snapshot presenter. Older bookings without display-price columns use their original saved CFA booking/item prices; current country pricing never overwrites that history. Earlier missing customer details are labelled as not recorded.

There is no public receipt lookup endpoint or share link. The POST success response is `Cache-Control: no-store`, explicitly selects receipt fields and does not expose notes, email-provider data, request keys or admin credentials. Contact details shown belong only to that saved booking.

## Deployment and verification

No schema migration, data reset, billing change or new environment variable is needed. Push the tested release to the existing Railway-connected `main` branch and verify the deployed health release and existing-booking preservation flag.

Tests cover six CFA/USD pricing combinations, distinct request-product counts, quantities, optional/legacy details, browser print invocation, print CSS, generated PDFs, 375/390/430px and desktop widths. The historical integration check changes only a disposable local catalogue product and verifies both an idempotent response and authenticated saved receipt retain the original name, unit price and total, then restores the local product. Live smoke bookings must be explicitly labelled as tests and cancelled privately in Admin after review, without deleting history.
