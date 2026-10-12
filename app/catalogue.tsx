"use client";
import { useState } from "react";
import { bookingTotals } from "@/lib/booking-pricing";
import { money } from "@/lib/validation";
type Product = {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string;
  priceCfa: string | null;
  hasImage: boolean;
};
export default function Catalogue({ products }: { products: Product[] }) {
  const [limit, setLimit] = useState(24);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [key, setKey] = useState<string | null>(null);
  const filtered = products.filter(
    (p) =>
      (!category || p.category === category) &&
      `${p.name} ${p.code}`.toLowerCase().includes(search.toLowerCase()),
  );
  const selected = products.filter((p) => cart[p.id] > 0);
  const totals = bookingTotals(
    selected.map((p) => ({ unitPriceCfa: p.priceCfa, quantity: cart[p.id] })),
  );
  const total = totals.totalCfa;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const data = new FormData(e.currentTarget);
    const requestKey = key ?? crypto.randomUUID();
    setKey(requestKey);
    try {
      const r = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestKey,
          doctorName: data.get("doctorName"),
          phone: data.get("phone"),
          email: data.get("email"),
          hospital: data.get("hospital"),
          notes: data.get("notes"),
          consent: data.get("consent") === "on",
          items: selected.map((p) => ({
            productId: p.id,
            quantity: cart[p.id],
          })),
        }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      setMessage(
        `Pre-booking received. Reference: ${result.id}. Our team will contact you.`,
      );
      setCart({});
      setKey(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Please try again");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="my-6 grid gap-3 sm:grid-cols-2">
        <input
          aria-label="Search products"
          placeholder="Search name or product code"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setLimit(24);
          }}
        />
        <select
          aria-label="Category"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setLimit(24);
          }}
        >
          <option value="">All categories</option>
          {[...new Set(products.map((p) => p.category))].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="grid content-start gap-4 sm:grid-cols-2">
          {products.length === 0 && (
            <div className="card sm:col-span-2">
              <h2>Catalogue coming soon</h2>
              <p>
                The exhibition catalogue is being prepared. Please check back
                shortly.
              </p>
            </div>
          )}
          {filtered.slice(0, limit).map((p) => (
            <article className="card" key={p.id}>
              {p.hasImage ? (
                <img
                  loading="lazy"
                  className="mb-4 h-44 w-full object-contain"
                  src={`/api/images?id=${p.id}`}
                  alt={p.name}
                />
              ) : (
                <div className="mb-4 flex h-32 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                  Image unavailable
                </div>
              )}
              <p className="text-xs uppercase text-teal-700">
                {p.category} · {p.code}
              </p>
              <h2>{p.name}</h2>
              <p className="my-2 text-sm">{p.description}</p>
              <p className="font-bold">{money(p.priceCfa)}</p>
              <label>
                Quantity
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={cart[p.id] ?? 0}
                  onChange={(e) => {
                    setKey(null);
                    setCart({
                      ...cart,
                      [p.id]: Math.max(
                        0,
                        Math.min(100, Math.floor(Number(e.target.value))),
                      ),
                    });
                  }}
                />
              </label>
            </article>
          ))}
          {products.length > 0 && filtered.length === 0 && (
            <p>No products match your search.</p>
          )}
          {filtered.length > limit && (
            <button
              className="sm:col-span-2"
              onClick={() => setLimit(limit + 24)}
            >
              Show more products
            </button>
          )}
        </section>
        <aside id="pre-booking" className="card h-fit scroll-mt-6">
          <h2>Your pre-booking</h2>
          {selected.map((p) => (
            <p className="my-2" key={p.id}>
              {p.name} × {cart[p.id]}
            </p>
          ))}
          <p className="my-4 font-bold">
            {total === null ? (
              <>
                Priced subtotal: {money(totals.pricedSubtotalCfa)} · Full total
                on request
              </>
            ) : (
              <>Estimated total: {money(total)}</>
            )}
          </p>
          <p className="text-sm">
            Final availability and commercial terms will be confirmed by our
            team.
          </p>
          <form onSubmit={submit}>
            <label>
              Doctor’s name
              <input
                name="doctorName"
                required
                minLength={2}
                maxLength={120}
                autoComplete="name"
              />
            </label>
            <label>
              Phone
              <input
                name="phone"
                required
                type="tel"
                maxLength={20}
                autoComplete="tel"
              />
            </label>
            <label>
              Email (optional)
              <input
                name="email"
                type="email"
                maxLength={254}
                autoComplete="email"
              />
            </label>
            <label>
              Hospital / clinic
              <input name="hospital" required minLength={2} maxLength={200} />
            </label>
            <label>
              Notes (optional)
              <textarea name="notes" maxLength={2000} />
            </label>
            <label className="flex gap-2 text-sm">
              <input
                className="w-auto"
                name="consent"
                type="checkbox"
                required
              />
              I agree to be contacted about this pre-booking and have read the
              privacy notice.
            </label>
            <button className="w-full" disabled={busy || !selected.length}>
              {busy ? "Submitting…" : "Submit pre-booking"}
            </button>
            <p className="mt-4 break-words" role="status">
              {message}
            </p>
          </form>
        </aside>
      </div>
      {selected.length > 0 && (
        <a
          href="#pre-booking"
          className="fixed inset-x-4 bottom-4 z-10 rounded-xl bg-teal-800 p-4 text-center font-bold text-white shadow-lg lg:hidden"
        >
          View pre-booking · {selected.length} products · {money(total)}
        </a>
      )}
    </>
  );
}
