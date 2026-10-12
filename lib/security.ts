import { cookies, headers } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export async function requireAdmin() {
  const token = (await cookies()).get("ortho_session")?.value;
  if (!token) throw new Error("Unauthorized");
  const session = await db.session.findUnique({
    where: { tokenHash: hash(token) },
    include: { admin: true },
  });
  if (!session || session.expiresAt < new Date())
    throw new Error("Unauthorized");
  return session.admin;
}
export async function createSession(adminId: string) {
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  await db.session.create({
    data: { tokenHash: hash(token), adminId, expiresAt },
  });
  (await cookies()).set("ortho_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
  });
}
export async function checkOrigin() {
  const h = await headers();
  const expected = process.env.APP_URL;
  if (!expected || h.get("origin") !== new URL(expected).origin)
    throw new Error("Invalid request origin");
}
export async function rateLimit(key: string, limit: number) {
  const rows = await db.$queryRaw<
    { count: number }[]
  >`INSERT INTO "RateLimit" ("key", "count", "windowStart") VALUES (${key}, 1, NOW()) ON CONFLICT ("key") DO UPDATE SET "count" = CASE WHEN "RateLimit"."windowStart" < NOW() - INTERVAL '15 minutes' THEN 1 ELSE "RateLimit"."count" + 1 END, "windowStart" = CASE WHEN "RateLimit"."windowStart" < NOW() - INTERVAL '15 minutes' THEN NOW() ELSE "RateLimit"."windowStart" END RETURNING "count"`;
  if (rows[0].count > limit)
    throw new Error("Too many attempts. Please try again in 15 minutes.");
}
