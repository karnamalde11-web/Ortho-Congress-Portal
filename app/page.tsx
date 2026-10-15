import { db } from "@/lib/db";
import Catalogue from "./catalogue";
import Image from "next/image";
export const dynamic = "force-dynamic";
export default async function Home() {
  const products = await db.product.findMany({
    where: { active: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      category: true,
      description: true,
      priceCfa: true,
      imageUrl: true,
      updatedAt: true,
    },
  });
  return (
    <>
      <section
        className="mb-6 grid items-center gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10"
        aria-label="Portal introduction"
      >
        <div>
          <p className="mb-2 text-sm font-bold tracking-widest text-teal-700">
            ORTHOPAEDIC CONGRESS
          </p>
          <h1>NM Ortho Pricing &amp; Pre-Booking Portal</h1>
          <p className="my-3 max-w-2xl">
            Select the products and quantities you would like to reserve for the
            congress. No payment is required at this stage.
          </p>
        </div>
        <aside
          aria-label="Product brands"
          className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 lg:gap-5 lg:p-6"
        >
          <Image
            src="/brands/actinac.png"
            alt="Actinac"
            width={1033}
            height={158}
            unoptimized
            className="h-auto w-40 max-w-full lg:w-48"
          />
          <Image
            src="/brands/actinac-plus.png"
            alt="Actinac Plus"
            width={2631}
            height={371}
            unoptimized
            className="h-auto w-48 max-w-full lg:w-56"
          />
          <Image
            src="/brands/actinac-plus-sp.png"
            alt="Actinac Plus SP"
            width={2103}
            height={229}
            unoptimized
            className="h-auto w-60 max-w-full lg:w-full"
          />
        </aside>
      </section>
      <Catalogue
        products={products.map(({ imageUrl, updatedAt, ...p }) => ({
          ...p,
          priceCfa: p.priceCfa?.toFixed(2) ?? null,
          hasImage: !!imageUrl,
          pricingVersion: updatedAt.toISOString(),
        }))}
      />
    </>
  );
}
