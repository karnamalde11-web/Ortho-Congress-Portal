import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Neu Micromed / Ajanta | Exhibition Pre-Booking",
  description:
    "Browse orthopaedic products and request an exhibition pre-booking. No online payment.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b bg-white p-5">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <a href="/" className="font-bold no-underline">
              NEU MICROMED <span className="text-teal-700">/ AJANTA</span>
            </a>
            <a href="/admin">Admin</a>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-6xl p-5 text-sm">
          Exhibition pre-booking only. No payment is collected. Availability and
          fulfilment will be confirmed by our team.{" "}
          <a href="/privacy">Privacy</a>
        </footer>
      </body>
    </html>
  );
}
