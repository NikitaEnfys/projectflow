import { json } from "@/lib/http/response";
import { OrganizationRole } from "@/lib/domain/enums";
import { organizationRepository } from "@/lib/repositories";
import { requireCurrentUser } from "@/lib/auth/current-user";

export async function GET() {
  const currentUser = await requireCurrentUser();
  const adminMembership = currentUser.memberships.find((m) => m.role === OrganizationRole.OWNER || m.role === OrganizationRole.ADMIN);
  if (!adminMembership) return json({ error: "Nincs szervezetkezelési jogosultságod." }, { status: 403 });
  const organization = await organizationRepository.findUnique({
    where: { id: adminMembership.organizationId },
    include: {
      members: {
        include: { user: { include: { clientContacts: { where: { client: { organizationId: adminMembership.organizationId } }, include: { client: { select: { id: true, name: true } } } } } } },
        orderBy: { createdAt: "asc" },
      },
      invitations: {
        include: { invitedBy: { select: { name: true } }, client: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
      clients: { orderBy: { name: "asc" } },
      _count: { select: { clients: true, projects: true } },
    },
  });
  if (!organization) return json({ error: "Szervezet nem található." }, { status: 404 });
  return json({ currentUserId: currentUser.id, currentUserRole: adminMembership.role, organization });
}
