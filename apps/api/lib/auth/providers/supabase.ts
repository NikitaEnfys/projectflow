import { createClient, type User } from "@supabase/supabase-js";
import type {
  AuthIdentity,
  AuthProvider,
  RegistrationResult,
} from "@/lib/auth/provider";

function getPublicClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("A Supabase auth környezeti változói hiányoznak.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      "A meghívásos fiókkezeléshez SUPABASE_SECRET_KEY szükséges.",
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function identityFromUser(user: User): AuthIdentity {
  const email = user.email?.toLowerCase();

  if (!email) {
    throw new Error("Az auth szolgáltató nem adott vissza e-mail címet.");
  }

  const metadata = user.user_metadata as
    | { full_name?: string; name?: string }
    | undefined;

  return {
    providerUserId: user.id,
    email,
    name:
      metadata?.full_name ||
      metadata?.name ||
      email.split("@")[0],
  };
}

async function findUserByEmail(email: string): Promise<User | null> {
  const normalized = email.trim().toLowerCase();
  const admin = getAdminClient();

  // Supabase Admin currently exposes paginated user listing rather than a
  // dedicated email lookup in the JS client. The invitation endpoint is
  // low-frequency, so a paginated server-side lookup is acceptable here.
  const perPage = 1000;

  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(error.message);
    }

    const match = data.users.find(
      (user) => user.email?.toLowerCase() === normalized,
    );

    if (match) return match;
    if (data.users.length < perPage) return null;
  }

  throw new Error("Túl sok auth felhasználó; az e-mail keresés nem fejeződött be.");
}

export class SupabaseAuthProvider implements AuthProvider {
  async signIn(
    email: string,
    password: string,
  ): Promise<AuthIdentity> {
    const { data, error } = await getPublicClient().auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      throw new Error(
        error?.message ?? "Sikertelen bejelentkezés.",
      );
    }

    return identityFromUser(data.user);
  }

  async signUp(input: {
    name: string;
    email: string;
    password: string;
    emailRedirectTo: string;
  }): Promise<RegistrationResult> {
    const { data, error } = await getPublicClient().auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: { full_name: input.name },
        emailRedirectTo: input.emailRedirectTo,
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    return {
      identity: data.user ? identityFromUser(data.user) : null,
      authenticated: Boolean(data.session && data.user),
      requiresEmailConfirmation: !data.session,
    };
  }

  async exchangeCode(code: string): Promise<AuthIdentity> {
    const { data, error } =
      await getPublicClient().auth.exchangeCodeForSession(code);

    if (error || !data.user) {
      throw new Error(
        error?.message ?? "Érvénytelen vagy lejárt auth callback.",
      );
    }

    return identityFromUser(data.user);
  }

  async invitedAccountExists(email: string): Promise<boolean> {
    return Boolean(await findUserByEmail(email));
  }

  async prepareInvitedAccount(input: {
    name: string;
    email: string;
    password: string;
  }): Promise<AuthIdentity> {
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim() || email.split("@")[0];

    const admin = getAdminClient();
    const existing = await findUserByEmail(email);

    if (existing) {
      const { data, error } = await admin.auth.admin.updateUserById(
        existing.id,
        {
          password: input.password,
          user_metadata: {
            ...(existing.user_metadata ?? {}),
            full_name:
              (existing.user_metadata as { full_name?: string } | undefined)
                ?.full_name || name,
          },
        },
      );

      if (error || !data.user) {
        throw new Error(
          error?.message ?? "Nem sikerült frissíteni a meghívott fiókot.",
        );
      }

      return identityFromUser(data.user);
    }

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        full_name: name,
      },
    });

    if (error || !data.user) {
      throw new Error(
        error?.message ?? "Nem sikerült létrehozni a meghívott fiókot.",
      );
    }

    return identityFromUser(data.user);
  }
}
