import { existsSync, readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

function databaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim() || process.env.MYSQL_URL?.trim();
  if (!url) throw new Error("Set DATABASE_URL (mysql://user:pass@host:3306/chesslab).");
  return url;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaReady?: Promise<void> };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: databaseUrl() } },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function ready(): Promise<PrismaClient> {
  globalForPrisma.prismaReady ??= migrateLegacy();
  await globalForPrisma.prismaReady;
  return prisma;
}

type DumpUser = { id: string; name?: string; profile?: unknown };

function dumpUsers(): DumpUser[] {
  for (const path of ["data/users-export.json", "data/users.json"]) {
    if (!existsSync(path)) continue;
    try {
      const raw = JSON.parse(readFileSync(path, "utf8")) as DumpUser[];
      if (Array.isArray(raw)) return raw;
    } catch {
      /* next file */
    }
  }
  return [];
}

async function migrateLegacy(): Promise<void> {
  const n = await prisma.profile.count().catch(() => -1);
  if (n > 0) {
    try {
      await prisma.$executeRawUnsafe("ALTER TABLE users DROP COLUMN profile");
    } catch {
      /* already gone */
    }
    return;
  }
  const { parseProfile } = await import("./profile");
  const { saveAccount } = await import("./persist");
  let rows: DumpUser[] = dumpUsers();
  try {
    const sql = await prisma.$queryRaw<DumpUser[]>`SELECT id, name, profile FROM users`;
    if (sql.length) rows = sql;
  } catch {
    /* column already dropped */
  }
  for (const row of rows) {
    const p = parseProfile(row.profile);
    if (!p.name && row.name) p.name = row.name;
    await saveAccount(row.id, p);
  }
  try {
    await prisma.$executeRawUnsafe("ALTER TABLE users DROP COLUMN profile");
  } catch {
    /* already gone */
  }
}
