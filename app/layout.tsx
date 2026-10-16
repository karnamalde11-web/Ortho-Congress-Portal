import "./globals.css";
import Image from "next/image";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "NM Ortho Pricing & Pre-Booking Portal",
  description:
    "Browse orthopaedic products and request an exhibition pre-booking. No online payment.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="pb-24 lg:pb-0">
        <header className="border-b bg-white p-5">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-12 gap-y-4">
            <a href="/" className="font-bold no-underline">
              NM Ortho
            </a>
            <div
              aria-label="Product brands"
              className="grid w-full min-w-0 grid-cols-2 items-center justify-items-center gap-x-5 gap-y-4 sm:grid-cols-[1fr_1.2fr_1.55fr_1.35fr] lg:w-auto lg:grid-cols-[8.5rem_10.25rem_13rem_11.5rem] lg:gap-x-6"
            >
              <Image
                src="/brands/actinac.png"
                alt="Actinac"
                width={1033}
                height={158}
                unoptimized
                className="h-auto w-full"
              />
              <Image
                src="/brands/actinac-plus.png"
                alt="Actinac Plus"
                width={2631}
                height={371}
                unoptimized
                className="h-auto w-full"
              />
              <Image
                src="/brands/actinac-plus-sp.png"
                alt="Actinac Plus SP"
                width={2103}
                height={229}
                unoptimized
                className="h-auto w-full"
              />
              <Image
                src="/brands/actinac-lp.png"
                alt="Actinac LP-200"
                width={1046}
                height={266}
                unoptimized
                className="h-auto w-full"
              />
            </div>
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
