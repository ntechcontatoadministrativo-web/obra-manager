import { PrismaClient } from "@prisma/client";

// Reaproveita a instância em dev (hot reload) para não esgotar conexões.
const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = prisma;
