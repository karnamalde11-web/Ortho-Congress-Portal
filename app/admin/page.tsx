import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/security";
import { db } from "@/lib/db";
import { money } from "@/lib/validation";
import { logout, updateStatus } from "./actions";
import ImportForm from "./import-form";
export const dynamic = "force-dynamic";
export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  try {
    await requireAdmin();
  } catch {
    redirect("/admin/login");
  }
  const params = await searchParams;
  const page = Math.max(1, Math.min(100000, Number(params.page) || 1));
  const [bookings, count, products] = await Promise.all([
    db.booking.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      skip: (page - 1) * 25,
      include: { items: true },
    }),
    db.booking.count(),
    db.product.count(),
  ]);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1>Exhibition dashboard</h1>
        <form action={logout}>
          <button>Sign out</button>
        </form>
      </div>
      <p className="my-4">
        {count} pre-bookings · {products} products
      </p>
      <ImportForm />
      <h2 className="my-6">Central pre-bookings</h2>
      <div className="grid gap-4">
        {bookings.map((b) => (
          <article className="card" key={b.id}>
            <div className="flex flex-wrap justify-between gap-3">
              <h2>{b.doctorName}</h2>
              <p>
                {money(b.totalCfa?.toFixed(2) ?? null)}
                {b.totalCfa === null && (
                  <>
                    {" "}
                    · Priced subtotal: {money(b.pricedSubtotalCfa.toFixed(2))}
                  </>
                )}
              </p>
            </div>
            <p className="break-words text-sm">
              Reference: {b.id} · {b.createdAt.toISOString()}
            </p>
            <p>
              {b.hospital} · {b.phone} · {b.email}
            </p>
            <p className="my-2 whitespace-pre-wrap">{b.notes}</p>
            <ul>
              {b.items.map((i) => (
                <li key={i.id}>
                  {i.code} — {i.name} ({i.category}) × {i.quantity} @{" "}
                  {money(i.unitPriceCfa?.toFixed(2) ?? null)}
                </li>
              ))}
            </ul>
            <form action={updateStatus} className="mt-4 flex gap-3">
              <input type="hidden" name="id" value={b.id} />
              <select
                name="status"
                defaultValue={b.status}
                aria-label="Booking status"
              >
                {["NEW", "CONTACTED", "CONFIRMED", "CANCELLED"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <button>Update</button>
            </form>
          </article>
        ))}
      </div>
      <nav className="my-6 flex gap-6">
        {page > 1 && <a href={`/admin?page=${page - 1}`}>Previous</a>}
        {page * 25 < count && <a href={`/admin?page=${page + 1}`}>Next</a>}
      </nav>
    </>
  );
}
