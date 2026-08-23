import { OrganizationRole, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/auth/current-user";

const OVERSIGHT_ROLES: OrganizationRole[] = [
  OrganizationRole.OWNER,
  OrganizationRole.ADMIN,
  OrganizationRole.PROJECT_MANAGER,
];

export async function getCurrentAccessContext() {
  const user = await requireCurrentUser();
  const oversightOrganizationIds = user.memberships
    .filter((membership) => OVERSIGHT_ROLES.includes(membership.role))
    .map((membership) => membership.organizationId);
  const organizationIds = user.memberships.map((membership) => membership.organizationId);

  const clientContacts = await prisma.clientContact.findMany({
    where: { userId: user.id },
    select: { clientId: true, client: { select: { organizationId: true } } },
  });
  const linkedClientIds = [...new Set(clientContacts.map((contact) => contact.clientId))];

  return { user, oversightOrganizationIds, organizationIds, linkedClientIds };
}

export function projectVisibilityWhere(
  userId: string,
  oversightOrganizationIds: string[],
  linkedClientIds: string[] = [],
): Prisma.ProjectWhereInput {
  return {
    OR: [
      { members: { some: { userId } } },
      ...(linkedClientIds.length ? [{ clientId: { in: linkedClientIds } }] : []),
      ...(oversightOrganizationIds.length
        ? [{ organizationId: { in: oversightOrganizationIds } }]
        : []),
    ],
  };
}

export function clientVisibilityWhere(
  userId: string,
  oversightOrganizationIds: string[],
): Prisma.ClientWhereInput {
  return {
    OR: [
      ...(oversightOrganizationIds.length
        ? [{ organizationId: { in: oversightOrganizationIds } }]
        : []),
      { contacts: { some: { userId } } },
    ],
  };
}
