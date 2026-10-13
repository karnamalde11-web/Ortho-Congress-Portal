import { z } from "zod";
import { normalizeWhatsApp } from "./phone";
export const specialties = [
  "Orthopaedic Surgeon",
  "Trauma Surgeon",
  "General Practitioner",
  "Hospital / Clinic",
  "Distributor",
  "Other",
] as const;
export const customerSchema = z
  .object({
    doctorName: z.string().trim().min(2, "Name is required").max(120),
    specialty: z.enum(specialties),
    specialtyOther: z.string().trim().max(120).default(""),
    hospital: z
      .string()
      .trim()
      .min(2, "Hospital / Clinic is required")
      .max(200),
    city: z.string().trim().min(1, "City is required").max(120),
    country: z.string().trim().min(2, "Country is required").max(100),
    phoneCountryCode: z
      .string()
      .trim()
      .regex(/^\+[1-9]\d{0,2}$/),
    phoneNationalNumber: z
      .string()
      .trim()
      .min(4)
      .max(30)
      .regex(/^[0-9 ()-]+$/),
    email: z
      .union([z.string().trim().email().max(254), z.literal("")])
      .optional(),
    notes: z.string().trim().max(2000).default(""),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.specialty === "Other" && !v.specialtyOther)
      ctx.addIssue({
        code: "custom",
        path: ["specialtyOther"],
        message: "Please enter your specialty",
      });
    if (!normalizeWhatsApp(v.phoneCountryCode, v.phoneNationalNumber))
      ctx.addIssue({
        code: "custom",
        path: ["phoneNationalNumber"],
        message: "Enter a valid phone number for the selected country code",
      });
  });
export const bookingSchema = customerSchema
  .safeExtend({
    requestKey: z.string().uuid(),
    items: z
      .array(
        z
          .object({
            productId: z.string().min(1).max(40),
            quantity: z.number().int().min(1).max(100),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .refine(
    (v) => new Set(v.items.map((i) => i.productId)).size === v.items.length,
    "Duplicate products",
  );
// Validate without trimming or rewriting source codes, names or categories.
export const productSchema = z.object({
  code: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  name: z
    .string()
    .min(1)
    .max(200)
    .refine((s) => s.trim().length > 0),
  category: z
    .string()
    .min(1)
    .max(100)
    .refine((s) => s.trim().length > 0),
  description: z.string().max(4000),
  priceCfa: z
    .string()
    .regex(/^\d{1,10}\.\d{2}$/)
    .nullable(),
});
export function parseCfaPrice(value: unknown): string | null {
  if (value === null || value === undefined || String(value).trim() === "")
    return null;
  const s = String(value).trim();
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(s))
    throw new Error(
      "Price must be a non-negative CFA amount with at most two decimal places",
    );
  const [whole, fraction = ""] = s.split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}
export function money(amount: string | number | null) {
  if (amount === null) return "Price on Request";
  return `${new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(Number(amount))} CFA`;
}
export function priceMinor(amount: string): bigint {
  const [whole, fraction = ""] = amount.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}
export function fromMinor(minor: bigint): string {
  return `${minor / 100n}.${String(minor % 100n).padStart(2, "0")}`;
}
