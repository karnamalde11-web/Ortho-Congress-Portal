// Select only IDs so this also works before the additive migration exists.
export async function captureBookings(db) {
  const [table] =
    await db.$queryRaw`SELECT to_regclass('public."Booking"')::text AS name`;
  if (!table?.name) return { bookings: [], items: [] };
  const [bookings, items] = await Promise.all([
    db.booking.findMany({ select: { id: true } }),
    db.bookingItem.findMany({ select: { id: true } }),
  ]);
  return { bookings: bookings.map((b) => b.id), items: items.map((i) => i.id) };
}
export async function verifyBookings(db, snapshot) {
  for (const [model, ids] of [
    [db.booking, snapshot.bookings],
    [db.bookingItem, snapshot.items],
  ]) {
    for (let offset = 0; offset < ids.length; offset += 1000) {
      const batch = ids.slice(offset, offset + 1000);
      if (
        (await model.count({ where: { id: { in: batch } } })) !== batch.length
      )
        throw new Error(
          "Existing booking preservation check failed; refusing to start.",
        );
    }
  }
  await db.auditLog.create({
    data: {
      adminId: "deployment",
      action: "CUSTOMER_DETAILS_MIGRATION",
      detail: JSON.stringify({
        release: process.env.RAILWAY_GIT_COMMIT_SHA || "local",
        preserved: true,
        bookingsChecked: snapshot.bookings.length,
        itemsChecked: snapshot.items.length,
      }),
    },
  });
  console.log(
    "Database migration completed; existing booking and item IDs were preserved.",
  );
}
