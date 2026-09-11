import { redirect } from "next/navigation";
import { OrganizationTeamManager } from "@/components/organization-team-manager";
import { ApiResponseError, serverApi } from "@/lib/api/server";

export default async function OrganizationSettingsPage() {
  let data: any;
  try { data = await serverApi<any>("/api/organizations/settings"); }
  catch (error) { if (error instanceof ApiResponseError && error.status === 403) redirect("/dashboard"); throw error; }
  const { organization, currentUserId, currentUserRole } = data;
  const stats = [
    ["Tagok", organization.members.length, "Aktív csapattag"],
    ["Ügyfelek", organization._count.clients, "Kapcsolódó ügyfél"],
    ["Projektek", organization._count.projects, "Szervezeti projekt"],
  ];

  return <div className="pf-page">
    <div className="pf-page-header">
      <div><p className="pf-eyebrow">Munkaterület</p><h1 className="pf-title">{organization.name}</h1><p className="pf-subtitle">Tagok, meghívások, ügyfélkapcsolatok és szervezeti szerepkörök kezelése.</p></div>
      <span className="pf-chip">{currentUserRole === "OWNER" ? "Tulajdonos" : "Adminisztrátor"}</span>
    </div>
    <div className="mb-7 grid gap-4 sm:grid-cols-3">
      {stats.map(([label, value, hint]) => <section key={String(label)} className="pf-card p-5"><p className="text-sm font-medium text-[#778093]">{label}</p><p className="mt-2 text-3xl font-bold tracking-[-0.04em] text-[#20283a]">{value}</p><p className="mt-1 text-xs text-[#9ca4b3]">{hint}</p></section>)}
    </div>
    <OrganizationTeamManager
      organizationId={organization.id}
      currentUserId={currentUserId}
      currentUserRole={currentUserRole as "OWNER" | "ADMIN"}
      clients={organization.clients.map((client:any) => ({ id: client.id, name: client.name }))}
      initialMembers={organization.members.map((m:any) => ({ id: m.id, userId: m.userId, role: m.role, user: { name: m.user.name, email: m.user.email }, clientId: m.user.clientContacts[0]?.clientId ?? null, clientName: m.user.clientContacts[0]?.client.name ?? null }))}
      initialInvitations={organization.invitations.map((i:any) => ({ id: i.id, email: i.email, role: i.role, token: i.token, expiresAt: i.expiresAt, invitedBy: i.invitedBy, clientId: i.clientId, clientName: i.client?.name ?? null }))}
    />
  </div>;
}
