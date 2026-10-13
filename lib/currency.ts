import { countryFromName } from "./countries";
import { fromMinor, money, priceMinor } from "./validation";
export type DisplayCurrency = "CFA" | "USD";
const cfaCountries = new Set([
  "SN",
  "CI",
  "ML",
  "BJ",
  "TG",
  "NE",
  "BF",
  "GW",
  "CM",
  "GA",
  "TD",
  "CG",
  "CF",
  "GQ",
]);
export function currencyForCountry(country: string): DisplayCurrency {
  return cfaCountries.has(countryFromName(country)?.code ?? "") ? "CFA" : "USD";
}
export function sellingPrice(
  priceCfa: string | null,
  currency: DisplayCurrency,
) {
  if (priceCfa === null || currency === "CFA") return priceCfa;
  // Exact, nonnegative half-up rounding of the USD unit price, in whole dollars.
  const dollars = (priceMinor(priceCfa) + 31250n) / 62500n;
  return fromMinor(dollars * 100n);
}
export function displayMoney(
  amount: string | number | null,
  currency: DisplayCurrency,
) {
  if (amount === null) return "Price on Request";
  if (currency === "CFA") return money(amount);
  return `$${new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(Number(amount))}`;
}
// Historical display must use stored snapshots, never today's country policy.
export function recordedPricing(booking: {
  currency: string;
  pricedSubtotalDisplay: { toFixed: (digits: number) => string } | null;
  totalDisplay: { toFixed: (digits: number) => string } | null;
  pricedSubtotalCfa: { toFixed: (digits: number) => string };
  totalCfa: { toFixed: (digits: number) => string } | null;
}) {
  const hasSnapshot = booking.pricedSubtotalDisplay !== null;
  return {
    currency: (hasSnapshot && booking.currency === "USD"
      ? "USD"
      : "CFA") as DisplayCurrency,
    pricedSubtotalDisplay: (
      booking.pricedSubtotalDisplay ?? booking.pricedSubtotalCfa
    ).toFixed(2),
    totalDisplay: hasSnapshot
      ? (booking.totalDisplay?.toFixed(2) ?? null)
      : (booking.totalCfa?.toFixed(2) ?? null),
  };
}
