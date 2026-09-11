import { redirect } from "next/navigation";
import { OrganizationTeamManager } from "@/components/organization-team-manager";
import { ApiResponseError, serverApi } from "@/lib/api/server";

export default async function OrganizationSettingsPage() {
  let data: any;
  try { data = await serverApi<any>("/api/organizations/settings"); }
  catch (error) { if (error instanceof ApiResponseError && error.status === 403) redirect("/dashboard"); throw error; }
  const { organization, currentUserId, currentUserRole } = data;
  return <main>
    <div className="mb-8"><p className="text-sm font-medium uppercase tracking-wide text-gray-500">Workspace</p><h1 className="mt-1 text-3xl font-bold">{organization.name}</h1><p className="mt-2 text-sm text-gray-500">Tagok, meghívások, ügyfélkapcsolatok és szervezeti szerepkörök kezelése.</p></div>
    <div className="mb-8 grid gap-4 sm:grid-cols-3"><div className="rounded-xl border p-5"><p className="text-sm text-gray-500">Tagok</p><p className="mt-2 text-3xl font-bold">{organization.members.length}</p></div><div className="rounded-xl border p-5"><p className="text-sm text-gray-500">Ügyfelek</p><p className="mt-2 text-3xl font-bold">{organization._count.clients}</p></div><div className="rounded-xl border p-5"><p className="text-sm text-gray-500">Projektek</p><p className="mt-2 text-3xl font-bold">{organization._count.projects}</p></div></div>
    <OrganizationTeamManager
      organizationId={organization.id}
      currentUserId={currentUserId}
      currentUserRole={currentUserRole as "OWNER" | "ADMIN"}
      clients={organization.clients.map((client:any) => ({ id: client.id, name: client.name }))}
      initialMembers={organization.members.map((m:any) => ({ id: m.id, userId: m.userId, role: m.role, user: { name: m.user.name, email: m.user.email }, clientId: m.user.clientContacts[0]?.clientId ?? null, clientName: m.user.clientContacts[0]?.client.name ?? null }))}
      initialInvitations={organization.invitations.map((i:any) => ({ id: i.id, email: i.email, role: i.role, token: i.token, expiresAt: i.expiresAt, invitedBy: i.invitedBy, clientId: i.clientId, clientName: i.client?.name ?? null }))}
    />
  </main>;
}
