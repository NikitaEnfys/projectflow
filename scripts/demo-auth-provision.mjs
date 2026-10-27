import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { DEMO_AUTH_USERS } from "./demo-auth-data.mjs";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} nincs beállítva.`);
  }
  return value;
}

const databaseUrl = required("DATABASE_URL");
const supabaseUrl = required("SUPABASE_URL");
const secretKey = required("SUPABASE_SECRET_KEY");
const password = required("DEMO_AUTH_PASSWORD");

if (password.length < 10) {
  throw new Error(
    "A DEMO_AUTH_PASSWORD legyen legalább 10 karakter.",
  );
}

if (process.env.NODE_ENV === "production") {
  throw new Error(
    "Demo auth provisioning production NODE_ENV mellett nem futtatható.",
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: databaseUrl,
  }),
});

const supabase = createClient(
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

async function findAuthUser(email) {
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
      throw new Error(error.message);
    }

    const match = data.users.find(
      (user) =>
        user.email?.toLowerCase() ===
        normalized,
    );

    if (match) {
      return match;
    }

    if (
      data.users.length < perPage
    ) {
      return null;
    }
  }

  throw new Error(
    "A Supabase auth user lista túl nagy; a keresés nem fejeződött be.",
  );
}

async function ensureDemoBusinessUser(
  demoUser,
) {
  const user =
    await prisma.user.findUnique({
      where: {
        id: demoUser.id,
      },
      select: {
        id: true,
        email: true,
        name: true,
        authUserId: true,
      },
    });

  if (!user) {
    throw new Error(
      `${demoUser.name} üzleti User rekordja hiányzik. Előbb futtasd: npm run demo:seed`,
    );
  }

  if (
    user.email.toLowerCase() !==
    demoUser.email.toLowerCase()
  ) {
    throw new Error(
      `Biztonsági leállítás: a fix demo User ID más e-mailhez tartozik (${user.email}).`,
    );
  }

  return user;
}

async function provision(demoUser) {
  const businessUser =
    await ensureDemoBusinessUser(
      demoUser,
    );

  let authUser =
    await findAuthUser(
      demoUser.email,
    );

  if (authUser) {
    const { data, error } =
      await supabase.auth.admin.updateUserById(
        authUser.id,
        {
          password,
          email_confirm: true,
          user_metadata: {
            ...(authUser.user_metadata ??
              {}),
            full_name:
              demoUser.name,
            projectflow_demo: true,
            projectflow_demo_role:
              demoUser.role,
          },
        },
      );

    if (
      error ||
      !data.user
    ) {
      throw new Error(
        error?.message ??
          `Nem sikerült frissíteni: ${demoUser.email}`,
      );
    }

    authUser = data.user;
  } else {
    const { data, error } =
      await supabase.auth.admin.createUser({
        email:
          demoUser.email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name:
            demoUser.name,
          projectflow_demo: true,
          projectflow_demo_role:
            demoUser.role,
        },
      });

    if (
      error ||
      !data.user
    ) {
      throw new Error(
        error?.message ??
          `Nem sikerült létrehozni: ${demoUser.email}`,
      );
    }

    authUser = data.user;
  }

  if (
    businessUser.authUserId &&
    businessUser.authUserId !==
      authUser.id
  ) {
    throw new Error(
      `Biztonsági leállítás: ${demoUser.email} üzleti User rekordja már más authUserId-hoz kapcsolódik.`,
    );
  }

  await prisma.user.update({
    where: {
      id: demoUser.id,
    },
    data: {
      authUserId:
        authUser.id,
    },
  });

  console.log(
    `✓ ${demoUser.role.padEnd(16)} ${demoUser.email}`,
  );
}

async function main() {
  console.log(
    "Demo Supabase Auth fiókok létrehozása/frissítése...",
  );

  for (
    const demoUser of
    DEMO_AUTH_USERS
  ) {
    await provision(
      demoUser,
    );
  }

  console.log("");
  console.log(
    "Demo auth provisioning kész.",
  );
  console.log(
    "A jelszó nincs kiírva a konzolra.",
  );
  console.log("");
  console.log(
    "Belépési e-mailek:",
  );

  for (
    const demoUser of
    DEMO_AUTH_USERS
  ) {
    console.log(
      `- ${demoUser.role}: ${demoUser.email}`,
    );
  }
}

main()
  .catch((error) => {
    console.error(
      "Demo auth provisioning hiba:",
      error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
