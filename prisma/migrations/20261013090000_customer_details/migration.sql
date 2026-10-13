-- Additive upgrade: legacy rows retain their IDs, phone numbers, prices and all other data.
-- NULL means the field was not collected for an earlier booking.
BEGIN;
ALTER TABLE "Booking"
  ADD COLUMN "phoneCountryCode" TEXT,
  ADD COLUMN "phoneNationalNumber" TEXT,
  ADD COLUMN "specialty" TEXT,
  ADD COLUMN "specialtyOther" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "country" TEXT;
COMMIT;
