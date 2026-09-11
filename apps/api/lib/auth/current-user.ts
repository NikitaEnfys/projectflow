import { readSessionToken, verifySessionToken } from "@/lib/auth/session";
import { getUserRepository } from "@/lib/repositories/user";

export async function getCurrentUser() {
  const session = verifySessionToken(await readSessionToken());
  if (!session) return null;
  return getUserRepository().resolveIdentity({
    providerUserId: session.sub,
    email: session.email,
    name: session.name,
  });
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}
