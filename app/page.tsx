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
    },
  });
  return (
    <>
      <p className="mb-2 text-sm font-bold tracking-widest text-teal-700">
        ORTHOPAEDIC EXHIBITION
      </p>
      <h1>Plan your exhibition order</h1>
      <p className="my-3 max-w-2xl">
        Explore our catalogue and reserve your requirements. Our team will
        contact you to confirm your pre-booking. No payment required.
      </p>
      <Catalogue
        products={products.map(({ imageUrl, ...p }) => ({
          ...p,
          priceCfa: p.priceCfa?.toFixed(2) ?? null,
          hasImage: !!imageUrl,
        }))}
      />
    </>
  );
}
