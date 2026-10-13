export const MAX_RESERVATION_QUANTITY = 100;
export function parseQuantityInput(raw: string) {
  if (raw === "") return { display: "", quantity: 0 };
  if (!/^\d+$/.test(raw)) return null;
  const quantity = Number(raw);
  if (!Number.isSafeInteger(quantity) || quantity > MAX_RESERVATION_QUANTITY)
    return null;
  return { display: String(quantity), quantity };
}
