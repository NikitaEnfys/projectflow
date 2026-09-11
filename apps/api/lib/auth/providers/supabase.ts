import { createClient, type User } from "@supabase/supabase-js";
import type { AuthIdentity, AuthProvider, RegistrationResult } from "@/lib/auth/provider";

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("A Supabase auth környezeti változói hiányoznak.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function identityFromUser(user: User): AuthIdentity {
  const email = user.email?.toLowerCase();
  if (!email) throw new Error("Az auth szolgáltató nem adott vissza e-mail címet.");
  const metadata = user.user_metadata as { full_name?: string; name?: string } | undefined;
  return {
    providerUserId: user.id,
    email,
    name: metadata?.full_name || metadata?.name || email.split("@")[0],
  };
}

export class SupabaseAuthProvider implements AuthProvider {
  async signIn(email: string, password: string): Promise<AuthIdentity> {
    const { data, error } = await getClient().auth.signInWithPassword({ email, password });
    if (error || !data.user) throw new Error(error?.message ?? "Sikertelen bejelentkezés.");
    return identityFromUser(data.user);
  }

  async signUp(input: { name: string; email: string; password: string; emailRedirectTo: string }): Promise<RegistrationResult> {
    const { data, error } = await getClient().auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: { full_name: input.name },
        emailRedirectTo: input.emailRedirectTo,
      },
    });
    if (error) throw new Error(error.message);
    return {
      identity: data.user ? identityFromUser(data.user) : null,
      authenticated: Boolean(data.session && data.user),
      requiresEmailConfirmation: !data.session,
    };
  }

  async exchangeCode(code: string): Promise<AuthIdentity> {
    const { data, error } = await getClient().auth.exchangeCodeForSession(code);
    if (error || !data.user) throw new Error(error?.message ?? "Érvénytelen vagy lejárt auth callback.");
    return identityFromUser(data.user);
  }
}

