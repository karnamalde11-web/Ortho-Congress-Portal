import { db } from "@/lib/db";
import { signedImageUrl } from "@/lib/storage";
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return new Response(null, { status: 404 });
  const p = await db.product.findFirst({
    where: { id, active: true },
    select: { imageUrl: true },
  });
  if (!p?.imageUrl) return new Response(null, { status: 404 });
  try {
    return Response.redirect(await signedImageUrl(p.imageUrl), 302);
  } catch {
    return new Response(null, { status: 503 });
  }
}
