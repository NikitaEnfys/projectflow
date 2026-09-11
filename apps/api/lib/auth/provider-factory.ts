import type { AuthProvider } from "@/lib/auth/provider";
import { SupabaseAuthProvider } from "@/lib/auth/providers/supabase";

let provider: AuthProvider | undefined;

export function getAuthProvider(): AuthProvider {
  // Provider choice is centralized here. Routes and services depend only on AuthProvider.
  provider ??= new SupabaseAuthProvider();
  return provider;
}
