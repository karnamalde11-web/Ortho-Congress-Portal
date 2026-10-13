import { readLimitedBody } from "@/lib/body";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { checkOrigin } from "@/lib/security";
import {
  OPT_OUT_COOKIE,
  VISITOR_COOKIE,
  VISIT_COOKIE,
} from "@/lib/analytics-policy";
export async function POST(req: Request) {
  try {
    await checkOrigin();
    const preference = z
      .object({ enabled: z.boolean() })
      .strict()
      .parse(JSON.parse((await readLimitedBody(req, 200)).toString("utf8")));
    const jar = await cookies();
    jar.set(OPT_OUT_COOKIE, preference.enabled ? "0" : "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 365 * 86400,
    });
    if (!preference.enabled) {
      jar.delete(VISITOR_COOKIE);
      jar.delete(VISIT_COOKIE);
    }
    const h = await headers();
    return Response.json({
      enabled:
        preference.enabled && h.get("dnt") !== "1" && h.get("sec-gpc") !== "1",
    });
  } catch {
    return Response.json(
      { error: "Unable to update the preference." },
      { status: 400 },
    );
  }
}
