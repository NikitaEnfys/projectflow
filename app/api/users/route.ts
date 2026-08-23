import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAccessContext } from "@/lib/auth/access";
import { OrganizationRole } from "@prisma/client";

export async function GET() {
  const { oversightOrganizationIds } = await getCurrentAccessContext();
  const users = await prisma.user.findMany({
    where: { memberships: { some: { organizationId: { in: oversightOrganizationIds } } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(users);
}

export async function POST(req: Request) {
  try {
    const { user } = await getCurrentAccessContext();
    const adminMembership = user.memberships.find((m) => m.role === OrganizationRole.OWNER || m.role === OrganizationRole.ADMIN);
    if (!adminMembership) return NextResponse.json({ error: "Nincs jogosultságod felhasználó létrehozásához." }, { status: 403 });
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!name || !email) return NextResponse.json({ error: "A név és az e-mail cím kötelező." }, { status: 400 });
    const created = await prisma.user.create({ data: { name, email, memberships: { create: { organizationId: adminMembership.organizationId, role: "MEMBER" } } } });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Nem sikerült létrehozni a felhasználót.", details: error instanceof Error ? error.message : "Ismeretlen hiba" }, { status: 500 });
  }
}
