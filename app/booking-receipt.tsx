"use client";
import type { BookingReceiptData } from "@/lib/booking-receipt";
import { displayMoney } from "@/lib/currency";

export default function BookingReceipt({
  receipt,
  onReturn,
  backHref,
}: {
  receipt: BookingReceiptData;
  onReturn?: () => void;
  backHref?: string;
}) {
  const priced = receipt.pricedProductCount > 0;
  const requested = receipt.priceOnRequestCount > 0;
  const mixed = priced && requested;
  const confirmedAmount = displayMoney(
    receipt.pricedSubtotalDisplay,
    receipt.currency,
  );
  const requestedItems = `${receipt.priceOnRequestCount} ${receipt.priceOnRequestCount === 1 ? "item" : "items"}`;
  const details = [
    ["Pre-Booking Reference", receipt.reference],
    [
      "Submission Date (IST)",
      new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata",
      }).format(new Date(receipt.submittedAt)),
    ],
    ["Customer Name", receipt.customerName],
    ["Specialty", receipt.specialty],
    ["Hospital / Clinic", receipt.hospital],
    ["City", receipt.city],
    ["Country", receipt.country],
    ["WhatsApp", receipt.phone],
    ...(receipt.email ? [["Email", receipt.email]] : []),
    ["Selected products", String(receipt.selectedProductCount)],
  ];
  return (
    <section
      id="booking-receipt"
      className="card mx-auto my-8 max-w-4xl"
      role={onReturn ? "status" : undefined}
      aria-label="Pre-booking receipt"
    >
      <h2 className="receipt-print-title">
        NM Ortho Pricing &amp; Pre-Booking Portal
      </h2>
      <h2 className="no-print">
        {onReturn
          ? "Pre-booking submitted successfully"
          : "Pre-booking receipt"}
      </h2>
      <p className="mt-3 font-bold">
        Congress Pre-Booking — Collection during the Congress
      </p>
      <dl className="receipt-details my-6 grid gap-3 break-words sm:grid-cols-2">
        {details.map(([label, value]) => (
          <div key={label}>
            <dt className="font-bold">{label}</dt>
            <dd className="whitespace-pre-wrap">{value}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mb-3 font-bold">Selected products</h3>
      <table
        className="receipt-products w-full text-left text-sm"
        role="table"
        aria-label="Pre-booked products"
      >
        <colgroup>
          <col className="receipt-code-col" />
          <col className="receipt-name-col" />
          <col className="receipt-quantity-col" />
          <col className="receipt-unit-col" />
          <col className="receipt-line-col" />
        </colgroup>
        <thead role="rowgroup">
          <tr role="row">
            {[
              "Product Code",
              "Product Name",
              "Quantity",
              "Unit Price",
              "Line Total",
            ].map((label) => (
              <th key={label} scope="col" role="columnheader">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup">
          {receipt.items.map((item, index) => (
            <tr key={`${item.code}-${index}`} role="row">
              <td
                role="cell"
                data-label="Product Code"
                className="receipt-code"
              >
                {item.code}
              </td>
              <td
                role="cell"
                data-label="Product Name"
                className="receipt-name"
              >
                {item.name}
              </td>
              <td
                role="cell"
                data-label="Quantity"
                className="receipt-quantity"
              >
                {item.quantity}
              </td>
              <td role="cell" data-label="Unit Price" className="receipt-unit">
                {displayMoney(item.unitPrice, receipt.currency)}
              </td>
              <td role="cell" data-label="Line Total" className="receipt-line">
                {displayMoney(item.lineTotal, receipt.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <section
        className="receipt-summary my-6 rounded-lg border border-slate-300 bg-slate-50 p-4"
        aria-label="Receipt pricing summary"
      >
        <dl className="space-y-3">
          {mixed ? (
            <>
              <div>
                <dt className="font-bold">Confirmed priced items:</dt>
                <dd>{confirmedAmount}</dd>
              </div>
              <div>
                <dt className="font-bold">Price on Request items:</dt>
                <dd>{requestedItems}</dd>
              </div>
              <div>
                <dt className="font-bold">Final total:</dt>
                <dd className="font-bold">
                  {confirmedAmount} + price of the Price on Request item(s)
                </dd>
              </div>
            </>
          ) : requested ? (
            <div>
              <dt className="font-bold">Final total:</dt>
              <dd className="font-bold">On Request</dd>
            </div>
          ) : (
            <div>
              <dt className="font-bold">Total:</dt>
              <dd className="font-bold">
                {displayMoney(receipt.totalDisplay, receipt.currency)}
              </dd>
            </div>
          )}
        </dl>
        {mixed && (
          <p className="mt-4">
            The final amount will be confirmed by our team after pricing the
            items marked “Price on Request”.
          </p>
        )}
        {!priced && requested && (
          <p className="mt-4">
            Our team will confirm the prices of the selected products with you.
          </p>
        )}
      </section>
      <p className="receipt-follow-up">
        Our team will contact you regarding confirmation, availability and final
        invoicing.
      </p>
      <p className="mt-2 text-sm">
        This is a pre-booking receipt. No payment has been collected.
      </p>
      <div className="receipt-actions mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={() => window.print()}>
          Print / Save Receipt
        </button>
        {onReturn ? (
          <button type="button" onClick={onReturn}>
            Return to catalogue
          </button>
        ) : (
          <a className="button no-underline" href={backHref || "/admin"}>
            Back to booking
          </a>
        )}
      </div>
    </section>
  );
}
