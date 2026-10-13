import { analyticsBodySchema } from "../lib/analytics-validation";
import { describe, expect, it } from "vitest";
import {
  analyticsStageCounts,
  campaignTag,
  campaigns,
  deviceCategory,
  mediums,
  sources,
} from "../lib/analytics-policy";
const now = new Date("2026-10-13T12:00:00Z");
const stage = (
  visitorHash: string,
  flags: {
    product?: boolean;
    quantity?: boolean;
    form?: boolean;
    submitted?: boolean;
    inactive?: boolean;
  } = {},
) => ({
  visitorHash,
  productInteractionAt: flags.product ? now : null,
  quantityEnteredAt: flags.quantity ? now : null,
  formStartedAt: flags.form ? now : null,
  submittedAt: flags.submitted ? now : null,
  lastSeenAt: new Date(now.getTime() - (flags.inactive ? 31 : 1) * 60000),
});
describe("anonymous analytics definitions", () => {
  it("distinguishes sessions from approximate returning browser visitors", () => {
    const result = analyticsStageCounts(
      [stage("browser-a"), stage("browser-a"), stage("browser-b")],
      now,
    );
    expect(result.sessions).toBe(3);
    expect(result.uniqueVisitors).toBe(2);
    expect(result.conversionRate).toBe(0);
  });
  it("marks only expired meaningful activity as abandoned", () => {
    const result = analyticsStageCounts(
      [
        stage("idle", { inactive: true }),
        stage("active", { product: true }),
        stage("abandoned", { form: true, inactive: true }),
        stage("submitted", {
          product: true,
          quantity: true,
          form: true,
          submitted: true,
          inactive: true,
        }),
      ],
      now,
    );
    expect(result.abandoned).toBe(1);
    expect(result.startedNotSubmitted).toBe(2);
    expect(result.sessionsNotSubmitted).toBe(3);
    expect(result.conversionRate).toBe(25);
  });
  it("does not label a returning browser without submission if another visit submitted", () => {
    const result = analyticsStageCounts(
      [stage("a"), stage("a", { submitted: true }), stage("b")],
      now,
    );
    expect(result.visitorsNotSubmitted).toBe(1);
    expect(result.sessionsNotSubmitted).toBe(2);
  });
  it("requires preceding actions for later funnel stages and handles empty data", () => {
    expect(analyticsStageCounts([], now).funnel).toEqual([0, 0, 0, 0, 0]);
    expect(
      analyticsStageCounts(
        [
          stage("a", { form: true }),
          stage("b", { product: true, quantity: true }),
          stage("c", {
            product: true,
            quantity: true,
            form: true,
            submitted: true,
          }),
        ],
        now,
      ).funnel,
    ).toEqual([3, 2, 2, 1, 1]);
  });
  it("uses broad screen-width categories without fingerprinting", () => {
    expect(deviceCategory(375)).toBe("mobile");
    expect(deviceCategory(390)).toBe("mobile");
    expect(deviceCategory(430)).toBe("mobile");
    expect(deviceCategory(800)).toBe("tablet");
    expect(deviceCategory(1440)).toBe("desktop");
  });
});
describe("privacy-safe event and source allowlists", () => {
  const valid = {
    path: "/",
    country: "Senegal",
    device: "mobile",
    events: [{ type: "OPENED" }],
  };
  it("accepts public events without login but refuses profile fields, URLs and fake submissions", () => {
    expect(analyticsBodySchema.safeParse(valid).success).toBe(true);
    for (const data of [
      { ...valid, email: "person@example.invalid" },
      { ...valid, phone: "2025550100" },
      { ...valid, name: "Person" },
      { ...valid, path: "/admin" },
      { ...valid, events: [{ type: "SUBMITTED" }] },
      { ...valid, events: [{ type: "FORM_STARTED", value: "Personal data" }] },
    ])
      expect(analyticsBodySchema.safeParse(data).success).toBe(false);
  });
  it("keeps only known public campaign tags, dropping free text and contact details", () => {
    expect(campaignTag("WhatsApp", sources)).toBe("whatsapp");
    expect(campaignTag("paid_social", mediums)).toBe("paid-social");
    expect(campaignTag("ortho_congress_2026", campaigns)).toBe(
      "ortho-congress-2026",
    );
    for (const value of [
      "Doctor Smith",
      "person@example.com",
      "+221771234567",
      "someone-else",
      "utm_term=query",
      null,
    ])
      expect(campaignTag(value, campaigns)).toBeUndefined();
  });
});
