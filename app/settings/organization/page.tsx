import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { OrganizationRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { OrganizationTeamManager } from "@/components/organization-team-manager";

export default async function OrganizationSettingsPage() {
  const currentUser = await requireCurrentUser();
  const adminMembership = currentUser.memberships.find((m) => m.role === OrganizationRole.OWNER || m.role === OrganizationRole.ADMIN);
  if (!adminMembership) redirect("/dashboard");

  const organization = await prisma.organization.findUnique({
    where: { id: adminMembership.organizationId },
    include: {
      members: {
        include: {
          user: {
            include: {
              clientContacts: {
                where: { client: { organizationId: adminMembership.organizationId } },
                include: { client: { select: { id: true, name: true } } },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      invitations: {
        include: {
          invitedBy: { select: { name: true } },
          client: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      clients: { orderBy: { name: "asc" } },
      _count: { select: { clients: true, projects: true } },
    },
  });
  if (!organization) redirect("/dashboard");

  return <main>
    <div className="mb-8">
      <p className="text-sm font-medium uppercase tracking-wide text-gray-500">Workspace</p>
      <h1 className="mt-1 text-3xl font-bold">{organization.name}</h1>
      <p className="mt-2 text-sm text-gray-500">Tagok, meghívások, ügyfélkapcsolatok és szervezeti szerepkörök kezelése.</p>
    </div>
    <div className="mb-8 grid gap-4 sm:grid-cols-3">
      <div className="rounded-xl border p-5"><p className="text-sm text-gray-500">Tagok</p><p className="mt-2 text-3xl font-bold">{organization.members.length}</p></div>
      <div className="rounded-xl border p-5"><p className="text-sm text-gray-500">Ügyfelek</p><p className="mt-2 text-3xl font-bold">{organization._count.clients}</p></div>
      <div className="rounded-xl border p-5"><p className="text-sm text-gray-500">Projektek</p><p className="mt-2 text-3xl font-bold">{organization._count.projects}</p></div>
    </div>
    <OrganizationTeamManager
      organizationId={organization.id}
      currentUserId={currentUser.id}
      currentUserRole={adminMembership.role as "OWNER" | "ADMIN"}
      clients={organization.clients.map((client) => ({ id: client.id, name: client.name }))}
      initialMembers={organization.members.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        user: { name: m.user.name, email: m.user.email },
        clientId: m.user.clientContacts[0]?.clientId ?? null,
        clientName: m.user.clientContacts[0]?.client.name ?? null,
      }))}
      initialInvitations={organization.invitations.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role as "ADMIN" | "PROJECT_MANAGER" | "MEMBER" | "CONTRACTOR" | "CLIENT",
        token: i.token,
        expiresAt: i.expiresAt.toISOString(),
        invitedBy: i.invitedBy,
        clientId: i.clientId,
        clientName: i.client?.name ?? null,
      }))}
    />
  </main>;
}
