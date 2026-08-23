import { NextResponse } from "next/server";
import { OrganizationRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/auth/current-user";

type Ctx = { params: Promise<{ id: string }> };

async function requireOrganizationManager(userId: string, organizationId: string) {
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
  return membership && [OrganizationRole.OWNER, OrganizationRole.ADMIN].includes(membership.role) ? membership : null;
}

export async function PUT(request: Request, { params }: Ctx) {
  const { id: organizationId } = await params;
  const currentUser = await requireCurrentUser();
  if (!(await requireOrganizationManager(currentUser.id, organizationId))) {
    return NextResponse.json({ error: "Nincs jogosultságod ügyfélkapcsolatot kezelni." }, { status: 403 });
  }

  const body = await request.json();
  const userId = typeof body.userId === "string" ? body.userId : "";
  const clientId = typeof body.clientId === "string" ? body.clientId : "";
  if (!userId || !clientId) return NextResponse.json({ error: "Felhasználó és ügyfélcég szükséges." }, { status: 400 });

  const [targetMembership, client, user] = await Promise.all([
    prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId } } }),
    prisma.client.findFirst({ where: { id: clientId, organizationId } }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);
  if (!targetMembership || targetMembership.role !== OrganizationRole.CLIENT) {
    return NextResponse.json({ error: "Csak CLIENT szerepkörű szervezeti tag rendelhető ügyfélcéghez." }, { status: 400 });
  }
  if (!client || !user) return NextResponse.json({ error: "A felhasználó vagy ügyfélcég nem található." }, { status: 404 });

  const contact = await prisma.$transaction(async (tx) => {
    await tx.clientContact.deleteMany({
      where: { userId, client: { organizationId } },
    });
    return tx.clientContact.create({
      data: { clientId, userId, name: user.name, email: user.email.toLowerCase() },
      include: { client: { select: { id: true, name: true } } },
    });
  });

  return NextResponse.json(contact);
}

export async function DELETE(request: Request, { params }: Ctx) {
  const { id: organizationId } = await params;
  const currentUser = await requireCurrentUser();
  if (!(await requireOrganizationManager(currentUser.id, organizationId))) {
    return NextResponse.json({ error: "Nincs jogosultságod ügyfélkapcsolatot kezelni." }, { status: 403 });
  }
  const body = await request.json();
  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!userId) return NextResponse.json({ error: "Felhasználó szükséges." }, { status: 400 });
  await prisma.clientContact.deleteMany({ where: { userId, client: { organizationId } } });
  return NextResponse.json({ success: true });
}
