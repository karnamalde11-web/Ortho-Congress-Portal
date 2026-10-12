import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import { z } from "zod";

function run(args) {
  const result = spawnSync("npm", ["run", ...args], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`Deployment setup step failed: ${args[0]}`);
}
export async function productionSetup() {
  for (const name of [
    "DATABASE_URL",
    "APP_URL",
    "S3_ENDPOINT",
    "S3_BUCKET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
  ]) {
    if (!process.env[name])
      throw new Error(`${name} is required for deployment.`);
  }
  for (const name of ["APP_URL", "S3_ENDPOINT"]) {
    const url = new URL(process.env[name]);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      (url.protocol !== "https:" &&
        !["localhost", "127.0.0.1"].includes(url.hostname))
    )
      throw new Error(
        `${name} must be an HTTPS address (except for localhost development).`,
      );
  }
  for (const flag of ["INITIALIZE_CATALOGUE", "INITIALIZE_ADMIN"]) {
    if (process.env[flag] && !["true", "false"].includes(process.env[flag]))
      throw new Error(`${flag} must be true or false.`);
  }
  run(["db:migrate"]);
  if (process.env.INITIALIZE_CATALOGUE === "true") {
    console.log(
      "Preparing the real exhibition catalogue in the configured database and storage.",
    );
    run(["catalogue:import"]);
    run(["catalogue:verify"]);
  }
  if (process.env.INITIALIZE_ADMIN === "true") {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (!z.string().email().max(254).safeParse(email).success)
      throw new Error("Enter a valid ADMIN_EMAIL in Railway Variables.");
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    try {
      const existing = await db.admin.findUnique({ where: { email } });
      if (existing)
        console.log(
          "The requested admin already exists; its password was not changed.",
        );
      else {
        const password = process.env.ADMIN_PASSWORD;
        if (
          !password ||
          password.length < 14 ||
          Buffer.byteLength(password, "utf8") > 72
        )
          throw new Error(
            "ADMIN_PASSWORD requires at least 14 characters and at most 72 UTF-8 bytes.",
          );
        await db.admin.create({
          data: { email, passwordHash: await hash(password, 12) },
        });
        console.log(
          "First admin created. Remove ADMIN_PASSWORD and the setup flags from Railway Variables after verification.",
        );
      }
    } finally {
      await db.$disconnect();
    }
  }
}
