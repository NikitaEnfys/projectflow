import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { OrganizationRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/auth/current-user";

const INVITABLE = new Set<OrganizationRole>([
  OrganizationRole.ADMIN,
  OrganizationRole.PROJECT_MANAGER,
  OrganizationRole.MEMBER,
  OrganizationRole.CONTRACTOR,
  OrganizationRole.CLIENT,
]);

type Ctx = { params: Promise<{ id: string }> };

async function manager(userId: string, organizationId: string) {
  return prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
}

export async function POST(request: Request, { params }: Ctx) {
  const { id: organizationId } = await params;
  const currentUser = await requireCurrentUser();
  const membership = await manager(currentUser.id, organizationId);
  if (!membership || ![OrganizationRole.OWNER, OrganizationRole.ADMIN].includes(membership.role)) {
    return NextResponse.json({ error: "Nincs jogosultságod meghívót küldeni." }, { status: 403 });
  }

  const body = await request.json();
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = typeof body.role === "string" && INVITABLE.has(body.role as OrganizationRole)
    ? (body.role as OrganizationRole)
    : null;
  if (!email || !role) return NextResponse.json({ error: "Érvényes e-mail és szerepkör szükséges." }, { status: 400 });
  if (membership.role === OrganizationRole.ADMIN && role === OrganizationRole.ADMIN) {
    return NextResponse.json({ error: "Adminisztrátort csak a tulajdonos hívhat meg." }, { status: 403 });
  }

  let clientId: string | null = null;
  if (role === OrganizationRole.CLIENT) {
    clientId = typeof body.clientId === "string" && body.clientId ? body.clientId : null;
    if (!clientId) {
      return NextResponse.json({ error: "Ügyfél szerepkörnél ki kell választani az ügyfélcéget." }, { status: 400 });
    }
    const client = await prisma.client.findFirst({ where: { id: clientId, organizationId }, select: { id: true } });
    if (!client) return NextResponse.json({ error: "A kiválasztott ügyfél nem ehhez a szervezethez tartozik." }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const existingMembership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: existingUser.id } },
    });
    if (existingMembership) return NextResponse.json({ error: "Ez a felhasználó már tagja a szervezetnek." }, { status: 409 });
  }

  const invitation = await prisma.organizationInvitation.upsert({
    where: { organizationId_email: { organizationId, email } },
    update: {
      role,
      clientId,
      token: randomUUID(),
      invitedById: currentUser.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    create: {
      organizationId,
      email,
      role,
      clientId,
      token: randomUUID(),
      invitedById: currentUser.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    include: { invitedBy: { select: { name: true } }, client: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ ...invitation, clientName: invitation.client?.name ?? null }, { status: 201 });
}

export async function DELETE(request: Request, { params }: Ctx) {
  const { id: organizationId } = await params;
  const currentUser = await requireCurrentUser();
  const membership = await manager(currentUser.id, organizationId);
  if (!membership || ![OrganizationRole.OWNER, OrganizationRole.ADMIN].includes(membership.role)) {
    return NextResponse.json({ error: "Nincs jogosultságod." }, { status: 403 });
  }
  const body = await request.json();
  const invitationId = typeof body.invitationId === "string" ? body.invitationId : "";
  const invitation = await prisma.organizationInvitation.findFirst({ where: { id: invitationId, organizationId } });
  if (!invitation) return NextResponse.json({ error: "Meghívó nem található." }, { status: 404 });
  await prisma.organizationInvitation.delete({ where: { id: invitation.id } });
  return NextResponse.json({ success: true });
}
