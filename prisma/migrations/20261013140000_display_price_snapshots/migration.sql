-- Add display-price snapshots only. Existing prices, currencies, products,
-- bookings and items remain unchanged; NULL denotes an earlier booking.
BEGIN;
ALTER TABLE "Booking"
  ADD COLUMN "pricedSubtotalDisplay" DECIMAL(14,2),
  ADD COLUMN "totalDisplay" DECIMAL(14,2),
  ADD CONSTRAINT "Booking_display_nonnegative" CHECK (
    ("pricedSubtotalDisplay" IS NULL OR "pricedSubtotalDisplay" >= 0) AND
    ("totalDisplay" IS NULL OR "totalDisplay" >= 0)
  );
ALTER TABLE "BookingItem"
  ADD COLUMN "unitPriceDisplay" DECIMAL(14,2),
  ADD COLUMN "lineSubtotalDisplay" DECIMAL(14,2),
  ADD CONSTRAINT "BookingItem_display_nonnegative" CHECK (
    ("unitPriceDisplay" IS NULL OR "unitPriceDisplay" >= 0) AND
    ("lineSubtotalDisplay" IS NULL OR "lineSubtotalDisplay" >= 0)
  );
COMMIT;
