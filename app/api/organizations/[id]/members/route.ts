import { NextResponse } from "next/server";
import { OrganizationRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/auth/current-user";

type Ctx = { params: Promise<{ id: string }> };
const EDITABLE = new Set<OrganizationRole>([
  OrganizationRole.ADMIN, OrganizationRole.PROJECT_MANAGER, OrganizationRole.MEMBER,
  OrganizationRole.CONTRACTOR, OrganizationRole.CLIENT,
]);

async function actor(userId: string, organizationId: string) {
  return prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId } } });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id: organizationId } = await params;
  const currentUser = await requireCurrentUser();
  const a = await actor(currentUser.id, organizationId);
  if (!a || ![OrganizationRole.OWNER, OrganizationRole.ADMIN].includes(a.role)) return NextResponse.json({ error: "Nincs jogosultságod." }, { status: 403 });
  const body = await request.json();
  const memberId = typeof body.memberId === "string" ? body.memberId : "";
  const role = typeof body.role === "string" && EDITABLE.has(body.role as OrganizationRole) ? body.role as OrganizationRole : null;
  if (!memberId || !role) return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  const target = await prisma.organizationMember.findFirst({ where: { id: memberId, organizationId }, include: { user: true } });
  if (!target) return NextResponse.json({ error: "Tag nem található." }, { status: 404 });
  if (target.role === OrganizationRole.OWNER) return NextResponse.json({ error: "A tulajdonos szerepköre itt nem módosítható." }, { status: 400 });
  if (a.role === OrganizationRole.ADMIN && (target.role === OrganizationRole.ADMIN || role === OrganizationRole.ADMIN)) return NextResponse.json({ error: "Adminisztrátori szerepkört csak a tulajdonos kezelhet." }, { status: 403 });
  const updated = await prisma.$transaction(async (tx) => {
    const membership = await tx.organizationMember.update({ where: { id: target.id }, data: { role }, include: { user: true } });
    if (target.role === OrganizationRole.CLIENT && role !== OrganizationRole.CLIENT) {
      await tx.clientContact.deleteMany({ where: { userId: target.userId, client: { organizationId } } });
    }
    return membership;
  });
  return NextResponse.json(updated);
}

export async function DELETE(request: Request, { params }: Ctx) {
  const { id: organizationId } = await params;
  const currentUser = await requireCurrentUser();
  const a = await actor(currentUser.id, organizationId);
  if (!a || ![OrganizationRole.OWNER, OrganizationRole.ADMIN].includes(a.role)) return NextResponse.json({ error: "Nincs jogosultságod." }, { status: 403 });
  const body = await request.json();
  const memberId = typeof body.memberId === "string" ? body.memberId : "";
  const target = await prisma.organizationMember.findFirst({ where: { id: memberId, organizationId }, include: { user: true } });
  if (!target) return NextResponse.json({ error: "Tag nem található." }, { status: 404 });
  if (target.role === OrganizationRole.OWNER) return NextResponse.json({ error: "A szervezet tulajdonosa nem távolítható el." }, { status: 400 });
  if (a.role === OrganizationRole.ADMIN && target.role === OrganizationRole.ADMIN) return NextResponse.json({ error: "Adminisztrátort csak a tulajdonos távolíthat el." }, { status: 403 });
  const managedProjects = await prisma.projectMember.findMany({
    where: { userId: target.userId, role: "PROJECT_MANAGER", project: { organizationId } },
    select: { projectId: true, project: { select: { ownerId: true } } },
  });
  const replacements = new Map<string, string>();
  for (const managed of managedProjects) {
    const replacement = await prisma.projectMember.findFirst({
      where: { projectId: managed.projectId, role: "PROJECT_MANAGER", userId: { not: target.userId } },
      orderBy: { createdAt: "asc" },
      select: { userId: true },
    });
    if (!replacement) {
      return NextResponse.json({ error: "A tag nem távolítható el, mert legalább egy projekt egyetlen projektvezetője." }, { status: 400 });
    }
    replacements.set(managed.projectId, replacement.userId);
  }

  await prisma.$transaction(async (tx) => {
    for (const managed of managedProjects) {
      if (managed.project.ownerId === target.userId) {
        await tx.project.update({ where: { id: managed.projectId }, data: { ownerId: replacements.get(managed.projectId)! } });
      }
    }
    await tx.projectMember.deleteMany({ where: { userId: target.userId, project: { organizationId } } });
    await tx.clientContact.deleteMany({ where: { userId: target.userId, client: { organizationId } } });
    await tx.organizationMember.delete({ where: { id: target.id } });
  });
  return NextResponse.json({ success: true });
}
