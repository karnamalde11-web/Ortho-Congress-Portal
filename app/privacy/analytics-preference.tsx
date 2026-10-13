"use client";
import { useState } from "react";
export default function AnalyticsPreference({
  initialEnabled,
}: {
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function change() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/analytics/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      });
      if (!response.ok) throw new Error();
      const result = await response.json();
      setEnabled(result.enabled);
      setMessage(
        result.enabled
          ? "Anonymous visit analytics enabled."
          : "Anonymous visit analytics disabled for this browser. Browser privacy signals also take precedence.",
      );
    } catch {
      setMessage("Unable to save. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="my-4">
      <p>
        Anonymous visit analytics: {enabled ? "enabled" : "disabled"} for this
        browser.
      </p>
      <button className="mt-3" onClick={change} disabled={busy}>
        {busy
          ? "Saving…"
          : enabled
            ? "Turn off anonymous analytics"
            : "Enable anonymous analytics"}
      </button>
      <p className="mt-3" role="status">
        {message}
      </p>
    </div>
  );
}
