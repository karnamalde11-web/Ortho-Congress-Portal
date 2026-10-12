"use client";
import { useState } from "react";
export default function ImportForm() {
  const [result, setResult] = useState("");
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setResult("");
    setReport(null);
    try {
      const r = await fetch("/api/admin/import", {
        method: "POST",
        body: new FormData(e.currentTarget),
      });
      const data = await r.json();
      setReport(data.report ?? null);
      if (!r.ok) throw new Error(data.error);
      setResult(data.message);
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card">
      <h2>Import catalogue and images</h2>
      <p className="my-2 text-sm">
        Excel uses one category per worksheet and the headers Code, Product
        Name, and Price CFA (or Prices CFA). Blank prices mean Price on Request.
        ZIP image filenames must match product code (for example ABC-123.jpg).
        Import Excel first. Maximum upload: 20 MB.
      </p>
      <form onSubmit={submit}>
        <label>
          Import type
          <select name="kind">
            <option value="excel">Excel catalogue (.xlsx)</option>
            <option value="images">Product images (.zip)</option>
          </select>
        </label>
        <label>
          File
          <input type="file" name="file" accept=".xlsx,.zip" required />
        </label>
        <button disabled={busy}>
          {busy ? "Importing…" : "Validate and import"}
        </button>
        <p role="status" className="mt-3">
          {result}
        </p>
        {report && (
          <details className="mt-4">
            <summary>Import validation report</summary>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs">
              {JSON.stringify(report, null, 2)}
            </pre>
          </details>
        )}
      </form>
    </section>
  );
}
