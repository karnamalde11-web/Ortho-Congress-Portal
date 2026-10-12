import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
try {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (
    !email ||
    !password ||
    password.length < 14 ||
    Buffer.byteLength(password, "utf8") > 72
  )
    throw new Error(
      "Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 14 characters and no more than 72 UTF-8 bytes) securely in the environment.",
    );
  await db.admin.create({
    data: { email, passwordHash: await hash(password, 12) },
  });
  console.log(
    "Admin created. Remove ADMIN_PASSWORD from the environment after setup.",
  );
} finally {
  await db.$disconnect();
}
