import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { DEMO_AUTH_USERS } from "./demo-auth-data.mjs";

function required(name) {
  const value =
    process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `${name} nincs beállítva.`,
    );
  }

  return value;
}

const databaseUrl =
  required("DATABASE_URL");
const supabaseUrl =
  required("SUPABASE_URL");
const secretKey =
  required("SUPABASE_SECRET_KEY");

if (
  process.env.NODE_ENV ===
  "production"
) {
  throw new Error(
    "Demo auth cleanup production NODE_ENV mellett nem futtatható.",
  );
}

const prisma =
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString:
        databaseUrl,
    }),
  });

const supabase =
  createClient(
    supabaseUrl,
    secretKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );

async function findAuthUser(
  email,
) {
  const normalized =
    email.toLowerCase();

  const perPage = 1000;

  for (
    let page = 1;
    page <= 100;
    page += 1
  ) {
    const { data, error } =
      await supabase.auth.admin.listUsers({
        page,
        perPage,
      });

    if (error) {
      throw new Error(
        error.message,
      );
    }

    const match =
      data.users.find(
        (user) =>
          user.email?.toLowerCase() ===
          normalized,
      );

    if (match) {
      return match;
    }

    if (
      data.users.length <
      perPage
    ) {
      return null;
    }
  }

  return null;
}

async function cleanupUser(
  demoUser,
) {
  const businessUser =
    await prisma.user.findUnique({
      where: {
        id: demoUser.id,
      },
      select: {
        id: true,
        email: true,
        authUserId: true,
      },
    });

  if (
    businessUser &&
    businessUser.email.toLowerCase() !==
      demoUser.email.toLowerCase()
  ) {
    throw new Error(
      `Biztonsági leállítás: ${demoUser.id} nem a várt demo e-mailhez tartozik.`,
    );
  }

  const authUser =
    await findAuthUser(
      demoUser.email,
    );

  if (authUser) {
    const metadata =
      authUser.user_metadata ??
      {};

    if (
      metadata.projectflow_demo !==
      true
    ) {
      throw new Error(
        `Biztonsági leállítás: ${demoUser.email} auth fiókja nincs projectflow_demo jelöléssel ellátva.`,
      );
    }

    const { error } =
      await supabase.auth.admin.deleteUser(
        authUser.id,
      );

    if (error) {
      throw new Error(
        error.message,
      );
    }
  }

  if (businessUser) {
    await prisma.user.update({
      where: {
        id:
          businessUser.id,
      },
      data: {
        authUserId: null,
      },
    });
  }

  console.log(
    `✓ cleanup ${demoUser.email}`,
  );
}

async function main() {
  for (
    const demoUser of
    DEMO_AUTH_USERS
  ) {
    await cleanupUser(
      demoUser,
    );
  }

  console.log(
    "Demo auth cleanup kész.",
  );
}

main()
  .catch((error) => {
    console.error(
      "Demo auth cleanup hiba:",
      error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
