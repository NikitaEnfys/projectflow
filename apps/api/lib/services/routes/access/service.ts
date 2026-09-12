import { json } from "@/lib/http/response";
import { OrganizationRole } from "@/lib/domain/enums";
import { clientContactRepository } from "@/lib/repositories";
import { requireCurrentUser } from "@/lib/auth/current-user";

const CONTENT_MANAGERS = new Set<OrganizationRole>([
  OrganizationRole.OWNER,
  OrganizationRole.ADMIN,
  OrganizationRole.PROJECT_MANAGER,
]);

export async function GET() {
  const user = await requireCurrentUser();
  const roles = user.memberships.map((membership) => membership.role);

  const canManageContent = roles.some((role) => CONTENT_MANAGERS.has(role));

  const canManageOrganization = roles.some(
    (role) =>
      role === OrganizationRole.OWNER || role === OrganizationRole.ADMIN,
  );

  const hasClientLink = Boolean(
    await clientContactRepository.findFirst({
      where: { userId: user.id },
      select: { id: true },
    }),
  );

  return json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    canCreateClient: canManageContent,
    canManageClients: canManageContent,
    canCreateProject: canManageContent,
    canManageProjects: canManageContent,
    canManageOrganization,
    canViewClients: hasClientLink || canManageContent,
  });
}
