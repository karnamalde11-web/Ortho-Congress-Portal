import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
const globalDb = globalThis as unknown as { prisma?: PrismaClient };
export const db =
  globalDb.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      application_name: "ortho-portal",
    }),
  });
// Next.js route bundles share one pool in production as well as development.
// Bound connection creation rather than opening a pool per route bundle.
globalDb.prisma = db;
