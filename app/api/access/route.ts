import { NextResponse } from "next/server";
import { OrganizationRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/auth/current-user";

export async function GET() {
  const user = await requireCurrentUser();
  const roles = user.memberships.map((membership) => membership.role);
  const canCreateClient = roles.some((role) => role === OrganizationRole.OWNER || role === OrganizationRole.ADMIN);
  const canCreateProject = roles.some((role) => role === OrganizationRole.OWNER || role === OrganizationRole.ADMIN || role === OrganizationRole.PROJECT_MANAGER);
  const canManageOrganization = roles.some((role) => role === OrganizationRole.OWNER || role === OrganizationRole.ADMIN);
  const hasClientLink = Boolean(await prisma.clientContact.findFirst({ where: { userId: user.id }, select: { id: true } }));
  const canViewClients = hasClientLink || roles.some((role) => role === OrganizationRole.OWNER || role === OrganizationRole.ADMIN || role === OrganizationRole.PROJECT_MANAGER);
  return NextResponse.json({ canCreateClient, canCreateProject, canManageOrganization, canViewClients });
}
