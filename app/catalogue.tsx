"use client";
import { useState } from "react";
import { bookingTotals } from "@/lib/booking-pricing";
import { customerSchema, specialties, money } from "@/lib/validation";
type Confirmation = {
  reference: string;
  customerName: string;
  selectedProductCount: number;
  hasPriceOnRequest: boolean;
};
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
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [customer, setCustomer] = useState({
    doctorName: "",
    specialty: "",
    specialtyOther: "",
    hospital: "",
    city: "",
    country: "",
    phoneCountryCode: "+221",
    phoneNationalNumber: "",
    email: "",
    notes: "",
  });
  const customerValid = customerSchema.safeParse(customer).success;
  function changeCustomer(field: keyof typeof customer, value: string) {
    setCustomer((previous) => ({ ...previous, [field]: value }));
    setKey(null);
  }
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
    if (!customerValid || !selected.length) return;
    setBusy(true);
    setMessage("");
    const requestKey = key ?? crypto.randomUUID();
    setKey(requestKey);
    try {
      const r = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestKey,
          ...customer,
          items: selected.map((p) => ({
            productId: p.id,
            quantity: cart[p.id],
          })),
        }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      setConfirmation(result);
      setCart({});
      setKey(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Please try again");
    } finally {
      setBusy(false);
    }
  }
  if (confirmation)
    return (
      <section className="card mx-auto my-8 max-w-2xl" role="status">
        <h2>Pre-booking submitted successfully</h2>
        <dl className="my-6 space-y-3 break-words">
          <div>
            <dt className="font-bold">Booking reference number</dt>
            <dd>{confirmation.reference}</dd>
          </div>
          <div>
            <dt className="font-bold">Customer name</dt>
            <dd>{confirmation.customerName}</dd>
          </div>
          <div>
            <dt className="font-bold">Selected products</dt>
            <dd>{confirmation.selectedProductCount}</dd>
          </div>
          <div>
            <dt className="font-bold">Price on Request items</dt>
            <dd>
              {confirmation.hasPriceOnRequest
                ? "Yes — final prices will be confirmed by our team."
                : "No"}
            </dd>
          </div>
        </dl>
        <p>
          Our team will contact you regarding confirmation, availability and
          final invoicing.
        </p>
        <button className="mt-6" onClick={() => setConfirmation(null)}>
          Return to catalogue
        </button>
      </section>
    );
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
                Quantity to reserve
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
          <div className="my-4 rounded-lg bg-teal-50 p-3 text-sm">
            <strong>Congress Pricing:</strong> Prices shown are special prices
            applicable to orders placed for the Orthopaedic Congress. Orders
            placed after the congress may be subject to additional freight and
            delivery charges.
          </div>
          <p className="my-4 text-sm">
            Please complete all required fields to submit your pre-booking.
          </p>
          <form onSubmit={submit}>
            <label>
              Name *
              <input
                name="doctorName"
                required
                minLength={2}
                maxLength={120}
                autoComplete="name"
                value={customer.doctorName}
                onChange={(e) => changeCustomer("doctorName", e.target.value)}
              />
            </label>
            <label>
              Specialty *
              <select
                name="specialty"
                aria-label="Specialty *"
                required
                value={customer.specialty}
                onChange={(e) => changeCustomer("specialty", e.target.value)}
              >
                <option value="">Select your specialty</option>
                {specialties.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            {customer.specialty === "Other" && (
              <label>
                Your specialty *
                <input
                  name="specialtyOther"
                  required
                  maxLength={120}
                  value={customer.specialtyOther}
                  onChange={(e) =>
                    changeCustomer("specialtyOther", e.target.value)
                  }
                />
              </label>
            )}
            <label>
              Hospital / Clinic *
              <input
                name="hospital"
                required
                minLength={2}
                maxLength={200}
                autoComplete="organization"
                value={customer.hospital}
                onChange={(e) => changeCustomer("hospital", e.target.value)}
              />
            </label>
            <label>
              City *
              <input
                name="city"
                required
                maxLength={120}
                autoComplete="address-level2"
                value={customer.city}
                onChange={(e) => changeCustomer("city", e.target.value)}
              />
            </label>
            <label>
              Country *
              <input
                name="country"
                required
                minLength={2}
                maxLength={100}
                autoComplete="country-name"
                value={customer.country}
                onChange={(e) => changeCustomer("country", e.target.value)}
              />
            </label>
            <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3">
              <label>
                <span className="block min-h-15 text-sm leading-5">
                  WhatsApp country code *
                </span>
                <input
                  name="phoneCountryCode"
                  required
                  type="tel"
                  autoComplete="tel-country-code"
                  placeholder="+221"
                  maxLength={4}
                  value={customer.phoneCountryCode}
                  onChange={(e) =>
                    changeCustomer("phoneCountryCode", e.target.value)
                  }
                />
              </label>
              <label>
                <span className="block min-h-15 text-sm leading-5">
                  WhatsApp phone number *
                </span>
                <input
                  name="phoneNationalNumber"
                  required
                  type="tel"
                  autoComplete="tel-national"
                  maxLength={30}
                  value={customer.phoneNationalNumber}
                  onChange={(e) =>
                    changeCustomer("phoneNationalNumber", e.target.value)
                  }
                />
              </label>
            </div>
            <p className="text-xs">
              Enter the local phone number without the country code. You can
              change +221 for another country.
            </p>
            <label>
              Email (optional)
              <input
                name="email"
                type="email"
                maxLength={254}
                autoComplete="email"
                value={customer.email}
                onChange={(e) => changeCustomer("email", e.target.value)}
              />
            </label>
            <label>
              Remarks (optional)
              <textarea
                name="notes"
                maxLength={2000}
                value={customer.notes}
                onChange={(e) => changeCustomer("notes", e.target.value)}
              />
            </label>
            <p className="my-4 text-sm">
              By submitting this pre-booking, you agree that our team may
              contact you regarding your selected products.
            </p>
            <button
              className="w-full"
              disabled={busy || !selected.length || !customerValid}
            >
              {busy ? "Submitting…" : "Submit pre-booking"}
            </button>
            <p className="mt-4 break-words" role="alert">
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
          Review Pre-Booking · {selected.length} products · {money(total)}
        </a>
      )}
    </>
  );
}
