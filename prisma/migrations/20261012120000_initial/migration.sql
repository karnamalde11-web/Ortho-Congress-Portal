CREATE TYPE "BookingStatus" AS ENUM ('NEW', 'CONTACTED', 'CONFIRMED', 'CANCELLED');
CREATE TABLE "Product" (
 "id" TEXT NOT NULL, "sku" TEXT NOT NULL, "name" TEXT NOT NULL,
 "category" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '',
 "pricePaise" INTEGER NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true,
 "imageKey" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "Product_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "Product_price_nonnegative" CHECK ("pricePaise" >= 0)
);
CREATE TABLE "Booking" (
 "id" TEXT NOT NULL, "requestKey" TEXT NOT NULL, "doctorName" TEXT NOT NULL,
 "phone" TEXT NOT NULL, "email" TEXT, "hospital" TEXT NOT NULL,
 "notes" TEXT NOT NULL DEFAULT '', "consentAt" TIMESTAMP(3) NOT NULL,
 "totalPaise" INTEGER NOT NULL, "status" "BookingStatus" NOT NULL DEFAULT 'NEW',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "Booking_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "Booking_total_nonnegative" CHECK ("totalPaise" >= 0)
);
CREATE TABLE "BookingItem" (
 "id" TEXT NOT NULL, "bookingId" TEXT NOT NULL, "productId" TEXT NOT NULL,
 "sku" TEXT NOT NULL, "name" TEXT NOT NULL, "unitPricePaise" INTEGER NOT NULL,
 "quantity" INTEGER NOT NULL,
 CONSTRAINT "BookingItem_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "BookingItem_quantity_valid" CHECK ("quantity" BETWEEN 1 AND 100),
 CONSTRAINT "BookingItem_price_nonnegative" CHECK ("unitPricePaise" >= 0)
);
CREATE TABLE "Admin" ("id" TEXT NOT NULL, "email" TEXT NOT NULL, "passwordHash" TEXT NOT NULL, CONSTRAINT "Admin_pkey" PRIMARY KEY ("id"));
CREATE TABLE "Session" ("tokenHash" TEXT NOT NULL, "adminId" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Session_pkey" PRIMARY KEY ("tokenHash"));
CREATE TABLE "RateLimit" ("key" TEXT NOT NULL, "count" INTEGER NOT NULL, "windowStart" TIMESTAMP(3) NOT NULL, CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key"));
CREATE TABLE "AuditLog" ("id" TEXT NOT NULL, "adminId" TEXT NOT NULL, "action" TEXT NOT NULL, "detail" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
CREATE INDEX "Product_active_category_idx" ON "Product"("active", "category");
CREATE UNIQUE INDEX "Booking_requestKey_key" ON "Booking"("requestKey");
CREATE INDEX "Booking_createdAt_idx" ON "Booking"("createdAt");
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
ALTER TABLE "BookingItem" ADD CONSTRAINT "BookingItem_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingItem" ADD CONSTRAINT "BookingItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
