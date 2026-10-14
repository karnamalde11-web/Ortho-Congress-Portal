-- Add workflow states without replacing the enum or rewriting existing bookings.
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'QUOTATION_SENT';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'INVOICE_SENT';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'PAID';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'COLLECTED';
CREATE INDEX "Booking_status_createdAt_idx" ON "Booking"("status", "createdAt");
CREATE INDEX "Booking_country_createdAt_idx" ON "Booking"("country", "createdAt");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
