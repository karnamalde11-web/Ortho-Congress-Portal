"use client";
import { useActionState } from "react";
import { updateStatus } from "./actions";
import { bookingStatuses, statusLabels } from "@/lib/booking-filters";
export default function StatusForm({
  id,
  status,
}: {
  id: string;
  status: (typeof bookingStatuses)[number];
}) {
  const [state, action, pending] = useActionState(updateStatus, {});
  return (
    <form action={action} className="mt-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="expectedStatus" value={status} />
      <div className="flex flex-wrap items-end gap-3">
        <label>
          Booking status
          <select
            aria-label="Booking status"
            name="status"
            defaultValue={status}
            disabled={pending}
          >
            {bookingStatuses.map((value) => (
              <option key={value} value={value}>
                {statusLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <button disabled={pending} aria-busy={pending} className="my-3">
          {pending ? "Updating…" : "Update"}
        </button>
      </div>
      <p className="text-sm">
        Cancelled bookings stay saved in history and are hidden from Active
        bookings.
      </p>
      {state.error && (
        <p role="alert" className="mt-3 text-red-700">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="mt-3 text-teal-700">
          {state.success}
        </p>
      )}
    </form>
  );
}
