import { redirect } from "next/navigation";
import { OrganizationTeamManager } from "@/components/organization-team-manager";
import { ApiResponseError, serverApi } from "@/lib/api/server";

type OrganizationRole =
  | "OWNER"
  | "ADMIN"
  | "PROJECT_MANAGER"
  | "MEMBER"
  | "CONTRACTOR"
  | "CLIENT";

type OrganizationClient = {
  id: string;
  name: string;
};

type OrganizationMember = {
  id: string;
  userId: string;
  role: OrganizationRole;
  user: {
    name: string;
    email: string;
  };
};

type OrganizationInvitation = {
  id: string;
  email: string;
  role: Exclude<OrganizationRole, "OWNER">;
  token: string;
  expiresAt: string;
  invitedBy: {
    name: string;
  };
  clientId: string | null;
  client: {
    name: string;
  } | null;
};

type OrganizationSettingsResponse = {
  organization: {
    id: string;
    name: string;
    clients: OrganizationClient[];
    members: OrganizationMember[];
    invitations: OrganizationInvitation[];
    _count: {
      clients: number;
      projects: number;
    };
  };
  currentUserId: string;
  currentUserRole: "OWNER" | "ADMIN";
};

export default async function OrganizationSettingsPage() {
  let data: OrganizationSettingsResponse;

  try {
    data = await serverApi<OrganizationSettingsResponse>(
      "/api/organizations/settings",
    );
  } catch (error) {
    if (
      error instanceof ApiResponseError &&
      error.status === 403
    ) {
      redirect("/dashboard");
    }
    throw error;
  }

  const { organization, currentUserId, currentUserRole } = data;

  const stats = [
    ["Tagok", organization.members.length, "Aktív szervezeti tag"],
    ["Ügyfélcégek", organization._count.clients, "Kezelt ügyfélcég"],
    ["Projektek", organization._count.projects, "Szervezeti projekt"],
  ] as const;

  return (
    <div className="pf-page">
      <div className="pf-page-header">
        <div>
          <p className="pf-eyebrow">Munkaterület</p>
          <h1 className="pf-title">{organization.name}</h1>
          <p className="pf-subtitle">
            Szervezeti tagok, meghívások és szerepkörök kezelése. Az ügyfélcégek és
            kapcsolattartóik az Ügyfelek menüpontban kezelhetők.
          </p>
        </div>
        <span className="pf-chip">
          {currentUserRole === "OWNER" ? "Tulajdonos" : "Adminisztrátor"}
        </span>
      </div>

      <div className="mb-7 grid gap-4 sm:grid-cols-3">
        {stats.map(([label, value, hint]) => (
          <section key={label} className="pf-card p-5">
            <p className="text-sm font-medium text-[#778093]">{label}</p>
            <p className="mt-2 text-3xl font-bold tracking-[-0.04em] text-[#20283a]">
              {value}
            </p>
            <p className="mt-1 text-xs text-[#9ca4b3]">{hint}</p>
          </section>
        ))}
      </div>

      <OrganizationTeamManager
        organizationId={organization.id}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        clients={organization.clients.map((client) => ({
          id: client.id,
          name: client.name,
        }))}
        initialMembers={organization.members.map((member) => ({
          id: member.id,
          userId: member.userId,
          role: member.role,
          user: {
            name: member.user.name,
            email: member.user.email,
          },
          clientId: null,
          clientName: null,
        }))}
        initialInvitations={organization.invitations.map((invitation) => ({
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          token: invitation.token,
          expiresAt: invitation.expiresAt,
          invitedBy: invitation.invitedBy,
          clientId: invitation.clientId,
          clientName: invitation.client?.name ?? null,
        }))}
      />
    </div>
  );
}
