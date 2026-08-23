import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { OrganizationRole } from "@prisma/client";

export async function GET() {
  const user = await requireCurrentUser();
  const ids = user.memberships.map((m) => m.organizationId);
  const organizations = await prisma.organization.findMany({
    where: { id: { in: ids } },
    include: { _count: { select: { members: true, clients: true, projects: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(organizations);
}

export async function POST(req: Request) {
  const user = await requireCurrentUser();
  const isOwner = user.memberships.some((m) => m.role === OrganizationRole.OWNER);
  if (!isOwner && user.memberships.length > 0) return NextResponse.json({ error: "Nincs jogosultságod új szervezet létrehozásához." }, { status: 403 });
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "A szervezet neve kötelező." }, { status: 400 });
  const organization = await prisma.organization.create({ data: { name, members: { create: { userId: user.id, role: "OWNER" } } } });
  return NextResponse.json(organization, { status: 201 });
}
