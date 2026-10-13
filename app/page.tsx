import { db } from "@/lib/db";
import Catalogue from "./catalogue";
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
      <p className="mb-2 text-sm font-bold tracking-widest text-teal-700">
        ORTHOPAEDIC CONGRESS
      </p>
      <h1>NM Ortho Pricing &amp; Pre-Booking Portal</h1>
      <p className="my-3 max-w-2xl">
        Select the products and quantities you would like to reserve for the
        congress. No payment is required at this stage.
      </p>
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
