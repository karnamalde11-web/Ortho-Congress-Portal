"use client";
import { useRef, useState } from "react";
import { countries, countryFromName } from "@/lib/countries";
import { parseQuantityInput, MAX_RESERVATION_QUANTITY } from "@/lib/quantity";
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
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [quantityErrors, setQuantityErrors] = useState<Record<string, string>>(
    {},
  );
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [customer, setCustomer] = useState({
    doctorName: "",
    specialty: "",
    specialtyOther: "",
    hospital: "",
    city: "",
    country: "Senegal",
    phoneCountryCode: "+221",
    phoneNationalNumber: "",
    email: "",
    notes: "",
  });
  type CustomerField = keyof typeof customer;
  const [touched, setTouched] = useState<
    Partial<Record<CustomerField, boolean>>
  >({});
  const [serverFieldErrors, setServerFieldErrors] = useState<
    Record<string, string[]>
  >({});
  const validation = customerSchema.safeParse(customer);
  const customerValid = validation.success;
  const errors = validation.success
    ? {}
    : validation.error.flatten().fieldErrors;
  function fieldError(field: CustomerField) {
    return (
      serverFieldErrors[field]?.[0] ||
      (touched[field] || customer[field].trim()
        ? errors[field]?.[0]
        : undefined)
    );
  }
  function feedback(field: CustomerField) {
    const error = fieldError(field);
    return error ? (
      <p
        id={`${field}-error`}
        className="mt-1 text-sm font-normal text-red-700"
      >
        {error}
      </p>
    ) : null;
  }
  function changeCustomer(field: CustomerField, value: string) {
    if (submitting.current) return;
    setCustomer((previous) =>
      field === "country"
        ? {
            ...previous,
            country: value,
            phoneCountryCode: countryFromName(value)?.callingCode ?? "+",
          }
        : { ...previous, [field]: value },
    );
    setServerFieldErrors({});
    setKey(null);
  }
  function changeQuantity(id: string, raw: string) {
    if (submitting.current) return;
    const parsed = parseQuantityInput(raw);
    if (!parsed) {
      rejectQuantity(id);
      return;
    }
    setQuantities((previous) => ({ ...previous, [id]: parsed.display }));
    setQuantityErrors((previous) => ({ ...previous, [id]: "" }));
    setKey(null);
  }
  function rejectQuantity(id: string) {
    setQuantityErrors((previous) => ({
      ...previous,
      [id]: `Please enter a whole number from 0 to ${MAX_RESERVATION_QUANTITY}.`,
    }));
  }
  const [key, setKey] = useState<string | null>(null);
  const filtered = products.filter(
    (p) =>
      (!category || p.category === category) &&
      `${p.name} ${p.code}`.toLowerCase().includes(search.toLowerCase()),
  );
  const selected = products.filter((p) => Number(quantities[p.id] || 0) > 0);
  const totals = bookingTotals(
    selected.map((p) => ({
      unitPriceCfa: p.priceCfa,
      quantity: Number(quantities[p.id] || 0),
    })),
  );
  const total = totals.totalCfa;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current || !customerValid || !selected.length) return;
    submitting.current = true;
    setBusy(true);
    setMessage("");
    setServerFieldErrors({});
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
            quantity: Number(quantities[p.id] || 0),
          })),
        }),
      });
      const result = await r.json().catch(() => {
        throw new Error(
          "We couldn’t submit your pre-booking. Please try again.",
        );
      });
      if (!r.ok) {
        setServerFieldErrors(result.fieldErrors ?? {});
        throw new Error(
          result.error ||
            "We couldn’t submit your pre-booking. Please try again.",
        );
      }
      setConfirmation(result);
      setQuantities({});
      setKey(null);
    } catch (e) {
      setMessage(
        e instanceof Error && !(e instanceof TypeError)
          ? e.message
          : "We couldn’t connect. Please check your connection and try again.",
      );
    } finally {
      submitting.current = false;
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
                  aria-label="Quantity to reserve"
                  inputMode="numeric"
                  min="0"
                  max={MAX_RESERVATION_QUANTITY}
                  step="1"
                  disabled={busy}
                  value={quantities[p.id] ?? ""}
                  aria-invalid={!!quantityErrors[p.id]}
                  aria-describedby={
                    quantityErrors[p.id] ? `quantity-${p.id}-error` : undefined
                  }
                  onKeyDown={(e) => {
                    if (
                      !e.ctrlKey &&
                      !e.metaKey &&
                      ["-", "+", ".", ",", "e", "E"].includes(e.key)
                    ) {
                      e.preventDefault();
                      rejectQuantity(p.id);
                    }
                  }}
                  onPaste={(e) => {
                    if (!parseQuantityInput(e.clipboardData.getData("text"))) {
                      e.preventDefault();
                      rejectQuantity(p.id);
                    }
                  }}
                  onChange={(e) => changeQuantity(p.id, e.target.value)}
                />
                {quantityErrors[p.id] && (
                  <p
                    id={`quantity-${p.id}-error`}
                    className="mt-1 text-sm font-normal text-red-700"
                  >
                    {quantityErrors[p.id]}
                  </p>
                )}
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
        <aside id="pre-booking" className="card min-w-0 h-fit scroll-mt-6">
          <h2>Your pre-booking</h2>
          {selected.map((p) => (
            <p className="my-2" key={p.id}>
              {p.name} × {quantities[p.id]}
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
          <form
            onSubmit={submit}
            noValidate
            aria-busy={busy}
            onBlur={(e) => {
              const field = e.target.getAttribute("name");
              if (field && field in customer)
                setTouched((previous) => ({ ...previous, [field]: true }));
            }}
          >
            <fieldset disabled={busy}>
              <label>
                Name *
                <input
                  name="doctorName"
                  aria-label="Name *"
                  aria-invalid={!!fieldError("doctorName")}
                  aria-describedby={
                    fieldError("doctorName") ? "doctorName-error" : undefined
                  }
                  required
                  minLength={2}
                  maxLength={120}
                  autoComplete="name"
                  value={customer.doctorName}
                  onChange={(e) => changeCustomer("doctorName", e.target.value)}
                />
                {feedback("doctorName")}
              </label>
              <label>
                Specialty *
                <select
                  name="specialty"
                  aria-invalid={!!fieldError("specialty")}
                  aria-describedby={
                    fieldError("specialty") ? "specialty-error" : undefined
                  }
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
                {feedback("specialty")}
              </label>
              {customer.specialty === "Other" && (
                <label>
                  Your specialty *
                  <input
                    name="specialtyOther"
                    aria-label="Your specialty *"
                    aria-invalid={!!fieldError("specialtyOther")}
                    aria-describedby={
                      fieldError("specialtyOther")
                        ? "specialtyOther-error"
                        : undefined
                    }
                    required
                    maxLength={120}
                    value={customer.specialtyOther}
                    onChange={(e) =>
                      changeCustomer("specialtyOther", e.target.value)
                    }
                  />
                  {feedback("specialtyOther")}
                </label>
              )}
              <label>
                Hospital / Clinic *
                <input
                  name="hospital"
                  aria-label="Hospital / Clinic *"
                  aria-invalid={!!fieldError("hospital")}
                  aria-describedby={
                    fieldError("hospital") ? "hospital-error" : undefined
                  }
                  required
                  minLength={2}
                  maxLength={200}
                  autoComplete="organization"
                  value={customer.hospital}
                  onChange={(e) => changeCustomer("hospital", e.target.value)}
                />
                {feedback("hospital")}
              </label>
              <label>
                City *
                <input
                  name="city"
                  aria-label="City *"
                  aria-invalid={!!fieldError("city")}
                  aria-describedby={
                    fieldError("city") ? "city-error" : undefined
                  }
                  required
                  maxLength={120}
                  autoComplete="address-level2"
                  value={customer.city}
                  onChange={(e) => changeCustomer("city", e.target.value)}
                />
                {feedback("city")}
              </label>
              <label>
                Country *
                <select
                  name="country"
                  aria-label="Country *"
                  required
                  autoComplete="country-name"
                  value={customer.country}
                  aria-invalid={!!fieldError("country")}
                  aria-describedby={
                    fieldError("country") ? "country-error" : undefined
                  }
                  onChange={(e) => changeCustomer("country", e.target.value)}
                >
                  <option value="" disabled>
                    Select your country
                  </option>
                  {countries.map((country) => (
                    <option key={country.code} value={country.name}>
                      {country.name}
                    </option>
                  ))}
                </select>
                {feedback("country")}
              </label>
              <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3">
                <label>
                  <span className="block min-h-15 text-sm leading-5">
                    WhatsApp country code *
                  </span>
                  <div className="relative">
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-3 font-normal"
                    >
                      +
                    </span>
                    <input
                      name="phoneCountryCode"
                      aria-label="WhatsApp country code *"
                      type="tel"
                      inputMode="numeric"
                      required
                      autoComplete="tel-country-code"
                      maxLength={4}
                      className="country-code-input"
                      value={customer.phoneCountryCode.replace(/^\+/, "")}
                      aria-invalid={!!fieldError("phoneCountryCode")}
                      aria-describedby={
                        fieldError("phoneCountryCode")
                          ? "phoneCountryCode-error"
                          : undefined
                      }
                      onChange={(e) =>
                        changeCustomer(
                          "phoneCountryCode",
                          `+${e.target.value.replace(/\D/g, "").slice(0, 3)}`,
                        )
                      }
                    />
                  </div>
                  {feedback("phoneCountryCode")}
                </label>
                <label>
                  <span className="block min-h-15 text-sm leading-5">
                    WhatsApp phone number *
                  </span>
                  <input
                    name="phoneNationalNumber"
                    aria-label="WhatsApp phone number *"
                    aria-invalid={!!fieldError("phoneNationalNumber")}
                    aria-describedby={
                      fieldError("phoneNationalNumber")
                        ? "phoneNationalNumber-error"
                        : undefined
                    }
                    required
                    type="tel"
                    autoComplete="tel-national"
                    maxLength={30}
                    value={customer.phoneNationalNumber}
                    onChange={(e) =>
                      changeCustomer("phoneNationalNumber", e.target.value)
                    }
                  />
                  {feedback("phoneNationalNumber")}
                </label>
              </div>
              <p className="text-xs">
                Enter the local phone number without the country code. You can
                override the suggested code if your WhatsApp number belongs to
                another country.
                {!countryFromName(customer.country)?.callingCode &&
                  " This location has no single phone code. Enter the code used by your WhatsApp number."}
              </p>
              <label>
                Email (optional)
                <input
                  name="email"
                  aria-label="Email (optional)"
                  aria-invalid={!!fieldError("email")}
                  aria-describedby={
                    fieldError("email") ? "email-error" : undefined
                  }
                  type="email"
                  maxLength={254}
                  autoComplete="email"
                  value={customer.email}
                  onChange={(e) => changeCustomer("email", e.target.value)}
                />
                {feedback("email")}
              </label>
              <label>
                Remarks (optional)
                <textarea
                  name="notes"
                  aria-label="Remarks (optional)"
                  aria-invalid={!!fieldError("notes")}
                  aria-describedby={
                    fieldError("notes") ? "notes-error" : undefined
                  }
                  maxLength={2000}
                  value={customer.notes}
                  onChange={(e) => changeCustomer("notes", e.target.value)}
                />
                {feedback("notes")}
              </label>
              <p className="my-4 text-sm">
                By submitting this pre-booking, you agree that our team may
                contact you regarding your selected products.
              </p>
              {!selected.length && (
                <p className="my-3 text-sm text-red-700">
                  Please select at least one product.
                </p>
              )}
              {!customerValid && (
                <p className="my-3 text-sm">
                  Please complete all required fields and correct any
                  highlighted details.
                </p>
              )}
              <button
                className="submission-button w-full"
                aria-busy={busy}
                disabled={busy || !selected.length || !customerValid}
              >
                {busy && (
                  <span
                    role="img"
                    aria-label="Submitting pre-booking"
                    className="inline-block h-4 w-4 rounded-full border-2 border-white border-t-transparent motion-safe:animate-spin"
                  />
                )}
                {busy ? "Submitting…" : "Submit pre-booking"}
              </button>
              <p className="mt-4 break-words" role="alert">
                {message}
              </p>
            </fieldset>
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
