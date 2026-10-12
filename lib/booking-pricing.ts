import { fromMinor, priceMinor } from "./validation";
export function bookingTotals(
  items: { unitPriceCfa: string | null; quantity: number }[],
) {
  const subtotal = items.reduce(
    (sum, i) =>
      sum +
      (i.unitPriceCfa === null
        ? 0n
        : priceMinor(i.unitPriceCfa) * BigInt(i.quantity)),
    0n,
  );
  if (subtotal > 99999999999999n)
    throw new Error(
      "Pre-booking exceeds the supported total. Contact our team.",
    );
  const pricedSubtotalCfa = fromMinor(subtotal);
  return {
    pricedSubtotalCfa,
    totalCfa: items.some((i) => i.unitPriceCfa === null)
      ? null
      : pricedSubtotalCfa,
  };
}
