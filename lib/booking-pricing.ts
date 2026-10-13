import { sellingPrice, type DisplayCurrency } from "./currency";
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

export function displayPricing(
  items: { unitPriceCfa: string | null; quantity: number }[],
  currency: DisplayCurrency,
) {
  const pricedItems = items.map((item) => {
    const unitPriceDisplay = sellingPrice(item.unitPriceCfa, currency);
    return {
      unitPriceDisplay,
      lineSubtotalDisplay:
        unitPriceDisplay === null
          ? null
          : fromMinor(priceMinor(unitPriceDisplay) * BigInt(item.quantity)),
    };
  });
  const subtotal = pricedItems.reduce(
    (sum, item) =>
      sum +
      (item.lineSubtotalDisplay === null
        ? 0n
        : priceMinor(item.lineSubtotalDisplay)),
    0n,
  );
  if (subtotal > 99999999999999n)
    throw new Error(
      "Pre-booking exceeds the supported total. Contact our team.",
    );
  const pricedSubtotalDisplay = fromMinor(subtotal);
  return {
    items: pricedItems,
    pricedSubtotalDisplay,
    totalDisplay: pricedItems.some((item) => item.unitPriceDisplay === null)
      ? null
      : pricedSubtotalDisplay,
  };
}
