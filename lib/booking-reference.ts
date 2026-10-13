// The full existing ID is retained: no renumbering, sequence migration or truncated collisions.
export function bookingReference(id: string, createdAt: Date | string) {
  return `NM-${new Date(createdAt).getUTCFullYear()}-${id}`;
}
