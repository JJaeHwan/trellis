import { PrismaClient } from "@prisma/client";

declare global {

  var __prisma__: PrismaClient | undefined;
}

export const db: PrismaClient =
  globalThis.__prisma__ ?? new PrismaClient({ log: ["warn", "error"] });

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma__ = db;
}
