-- New anonymous analytics tables only. No existing booking/product rows or
-- columns are changed. Removing analytics retains every actual pre-booking.
BEGIN;
CREATE TABLE "AnalyticsVisit" (
 "id" UUID NOT NULL, "visitorHash" CHAR(64) NOT NULL,
 "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "productInteractionAt" TIMESTAMP(3), "quantityEnteredAt" TIMESTAMP(3),
 "formStartedAt" TIMESTAMP(3), "submittedAt" TIMESTAMP(3),
 "selectedCountry" TEXT NOT NULL DEFAULT 'Senegal', "device" TEXT NOT NULL,
 "referrerDomain" TEXT, "utmSource" TEXT, "utmMedium" TEXT, "utmCampaign" TEXT,
 CONSTRAINT "AnalyticsVisit_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "AnalyticsVisit_device" CHECK ("device" IN ('mobile','tablet','desktop'))
);
CREATE TABLE "AnalyticsEvent" (
 "id" TEXT NOT NULL, "visitId" UUID NOT NULL, "type" TEXT NOT NULL,
 "key" TEXT NOT NULL, "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "productCode" TEXT, "category" TEXT, "country" TEXT,
 CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "AnalyticsEvent_type" CHECK ("type" IN ('OPENED','PRODUCT_INTERACTION','QUANTITY_ENTERED','FORM_STARTED','COUNTRY_SELECTED','CATEGORY_VIEWED','SUBMITTED')),
 CONSTRAINT "AnalyticsEvent_visit_fkey" FOREIGN KEY ("visitId") REFERENCES "AnalyticsVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "AnalyticsConversion" (
 "bookingId" TEXT NOT NULL, "visitId" UUID, "submittedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "AnalyticsConversion_pkey" PRIMARY KEY ("bookingId"),
 CONSTRAINT "AnalyticsConversion_booking_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "AnalyticsConversion_visit_fkey" FOREIGN KEY ("visitId") REFERENCES "AnalyticsVisit"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "AnalyticsVisit_openedAt_idx" ON "AnalyticsVisit"("openedAt");
CREATE INDEX "AnalyticsVisit_visitorHash_openedAt_idx" ON "AnalyticsVisit"("visitorHash","openedAt");
CREATE INDEX "AnalyticsVisit_lastSeenAt_idx" ON "AnalyticsVisit"("lastSeenAt");
CREATE UNIQUE INDEX "AnalyticsEvent_visitId_type_key_key" ON "AnalyticsEvent"("visitId","type","key");
CREATE INDEX "AnalyticsEvent_occurredAt_type_idx" ON "AnalyticsEvent"("occurredAt","type");
CREATE INDEX "AnalyticsConversion_visitId_idx" ON "AnalyticsConversion"("visitId");
CREATE INDEX "AnalyticsConversion_submittedAt_idx" ON "AnalyticsConversion"("submittedAt");
COMMIT;
