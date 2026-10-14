-- Add an empty delivery queue. Existing bookings and prices are not rewritten.
CREATE TABLE "BookingEmail" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseUntil" TIMESTAMP(3),
  "firstAttemptAt" TIMESTAMP(3),
  "payload" JSONB,
  "providerId" TEXT,
  "lastError" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingEmail_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BookingEmail_status_check" CHECK ("status" IN ('PENDING','SENDING','SENT','FAILED')),
  CONSTRAINT "BookingEmail_attempts_check" CHECK ("attempts" >= 0)
);
CREATE UNIQUE INDEX "BookingEmail_bookingId_key" ON "BookingEmail"("bookingId");
CREATE INDEX "BookingEmail_status_availableAt_idx" ON "BookingEmail"("status", "availableAt");
ALTER TABLE "BookingEmail" ADD CONSTRAINT "BookingEmail_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
