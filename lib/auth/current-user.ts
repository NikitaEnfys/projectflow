import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims?.sub) return null;

  const authUserId = String(claims.sub);
  const email = typeof claims.email === "string" ? claims.email.toLowerCase() : null;

  let user = await prisma.user.findUnique({
    where: { authUserId },
    include: { memberships: true, projectMemberships: true },
  });

  if (user) return user;
  if (!email) return null;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.authUserId && existing.authUserId !== authUserId) {
      throw new Error("Ehhez az e-mail címhez már másik Auth-fiók tartozik.");
    }
    user = await prisma.user.update({
      where: { id: existing.id },
      data: { authUserId },
      include: { memberships: true, projectMemberships: true },
    });
    return user;
  }

  const metadata = claims.user_metadata as { full_name?: string; name?: string } | undefined;
  const name = metadata?.full_name || metadata?.name || email.split("@")[0];

  return prisma.user.create({
    data: { name, email, authUserId },
    include: { memberships: true, projectMemberships: true },
  });
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
