import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/current-user";
export async function GET() {
  const user = await requireCurrentUser();
  return NextResponse.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, memberships: user.memberships, projectMemberships: user.projectMemberships } });
}
