import { headers } from "next/headers";
import { checkOrigin } from "@/lib/security";
import { readLimitedBody } from "@/lib/body";
import { analyticsBodySchema } from "@/lib/analytics-validation";
import { analyticsExcluded, recordAnalytics } from "@/lib/analytics-server";
export async function POST(req: Request) {
  try {
    await checkOrigin();
    const referer = (await headers()).get("referer");
    if (
      !referer ||
      new URL(referer).origin !== new URL(process.env.APP_URL!).origin ||
      new URL(referer).pathname !== "/"
    )
      return new Response(null, { status: 204 });
    if (await analyticsExcluded()) return new Response(null, { status: 204 });
    const data = analyticsBodySchema.parse(
      JSON.parse((await readLimitedBody(req, 6000)).toString("utf8")),
    );
    await recordAnalytics(data);
  } catch {
    /* Never expose data or interfere with the public catalogue. */
  }
  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
