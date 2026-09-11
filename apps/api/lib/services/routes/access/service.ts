import { json } from "@/lib/http/response";
import { OrganizationRole } from "@/lib/domain/enums";
import { clientContactRepository } from "@/lib/repositories";
import { requireCurrentUser } from "@/lib/auth/current-user";

export async function GET() {
  const user = await requireCurrentUser();
  const roles = user.memberships.map((membership) => membership.role);
  const canCreateClient = roles.some((role) => role === OrganizationRole.OWNER || role === OrganizationRole.ADMIN);
  const canCreateProject = roles.some((role) => role === OrganizationRole.OWNER || role === OrganizationRole.ADMIN || role === OrganizationRole.PROJECT_MANAGER);
  const canManageOrganization = roles.some((role) => role === OrganizationRole.OWNER || role === OrganizationRole.ADMIN);
  const hasClientLink = Boolean(await clientContactRepository.findFirst({ where: { userId: user.id }, select: { id: true } }));
  const canViewClients = hasClientLink || roles.some((role) => role === OrganizationRole.OWNER || role === OrganizationRole.ADMIN || role === OrganizationRole.PROJECT_MANAGER);
  return json({ user: { id: user.id, name: user.name, email: user.email }, canCreateClient, canCreateProject, canManageOrganization, canViewClients });
}
