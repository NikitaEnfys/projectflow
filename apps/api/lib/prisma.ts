import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

function getConnectionString() {
  if (process.env.NODE_ENV === "test" && process.env.TEST_DATABASE_URL) {
    return process.env.TEST_DATABASE_URL;
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL nincs beállítva.");
  }

  return databaseUrl;
}

const adapter = new PrismaPg({
  connectionString: getConnectionString(),
});

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
