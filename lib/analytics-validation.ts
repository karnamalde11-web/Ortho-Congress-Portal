import { z } from "zod";
import { countryFromName } from "./countries";
export const analyticsEventSchema = z
  .object({
    type: z.enum([
      "ACTIVITY",
      "OPENED",
      "PRODUCT_INTERACTION",
      "QUANTITY_ENTERED",
      "FORM_STARTED",
      "COUNTRY_SELECTED",
      "CATEGORY_VIEWED",
    ]),
    productId: z.string().min(1).max(40).optional(),
    category: z.string().min(1).max(100).optional(),
    country: z
      .string()
      .refine((value) => !!countryFromName(value))
      .optional(),
  })
  .strict();
export const analyticsBodySchema = z
  .object({
    path: z.literal("/"),
    country: z.string().refine((value) => !!countryFromName(value)),
    device: z.enum(["mobile", "tablet", "desktop"]),
    referrerHost: z.string().max(253).optional(),
    utmSource: z.string().max(80).optional(),
    utmMedium: z.string().max(80).optional(),
    utmCampaign: z.string().max(80).optional(),
    events: z.array(analyticsEventSchema).min(1).max(10),
  })
  .strict();
