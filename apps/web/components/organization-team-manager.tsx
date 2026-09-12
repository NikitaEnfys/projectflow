"use client";

import { apiFetch } from "@/lib/api/client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const ROLES = ["ADMIN", "PROJECT_MANAGER", "MEMBER", "CONTRACTOR", "CLIENT"] as const;
type Role = (typeof ROLES)[number];

type ClientOption = { id: string; name: string };

type Member = {
  id: string;
  userId: string;
  role: Role | "OWNER";
  user: { name: string; email: string };
  clientId: string | null;
  clientName: string | null;
};

type Invitation = {
  id: string;
  email: string;
  role: Role;
  token: string;
  expiresAt: string;
  invitedBy: { name: string };
  clientId: string | null;
  clientName: string | null;
};

type InvitationResponse = Invitation & {
  emailSent?: boolean;
  emailWarning?: string | null;
};

type Props = {
  organizationId: string;
  currentUserId: string;
  currentUserRole: "OWNER" | "ADMIN";
  clients: ClientOption[];
  initialMembers: Member[];
  initialInvitations: Invitation[];
};

const LABELS: Record<string, string> = {
  OWNER: "Tulajdonos",
  ADMIN: "Adminisztrátor",
  PROJECT_MANAGER: "Projektvezető",
  MEMBER: "Munkatárs",
  CONTRACTOR: "Alvállalkozó",
  CLIENT: "Ügyfélfelhasználó",
};

export function OrganizationTeamManager({
  organizationId,
  currentUserId,
  currentUserRole,
  clients,
  initialMembers,
  initialInvitations,
}: Props) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [invitations, setInvitations] = useState(initialInvitations);

  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<Role>("MEMBER");
  const [memberClientId, setMemberClientId] = useState(clients[0]?.id ?? "");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("MEMBER");
  const [inviteClientId, setInviteClientId] = useState(clients[0]?.id ?? "");

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectableRoles = useMemo(
    () =>
      currentUserRole === "OWNER"
        ? ROLES
        : ROLES.filter((role) => role !== "ADMIN"),
    [currentUserRole],
  );

  async function getError(response: Response) {
    const data = await response.json().catch(() => null);
    return data?.error || "A művelet nem sikerült.";
  }

  async function addExistingMember() {
    setBusy("add-member");
    setError("");
    setMessage("");

    if (memberRole === "CLIENT" && !memberClientId) {
      setError("Ügyfélfelhasználónál válassz ügyfélcéget.");
      setBusy(null);
      return;
    }

    const response = await apiFetch(`/api/organizations/${organizationId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: memberEmail,
        role: memberRole,
        clientId: memberRole === "CLIENT" ? memberClientId : null,
      }),
    });

    if (!response.ok) {
      setError(await getError(response));
      setBusy(null);
      return;
    }

    const created = (await response.json()) as Member;
    setMembers((items) => [...items, created]);
    setMemberEmail("");
    setMemberRole("MEMBER");
    setBusy(null);
    setMessage("A meglévő felhasználó hozzáadva a szervezethez.");
    router.refresh();
  }

  async function invite() {
    setBusy("invite");
    setError("");
    setMessage("");

    if (inviteRole === "CLIENT" && !inviteClientId) {
      setError("Ügyfélfelhasználónál válassz ügyfélcéget.");
      setBusy(null);
      return;
    }

    const response = await apiFetch(`/api/organizations/${organizationId}/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: inviteEmail,
        role: inviteRole,
        clientId: inviteRole === "CLIENT" ? inviteClientId : null,
      }),
    });

    if (!response.ok) {
      setError(await getError(response));
      setBusy(null);
      return;
    }

    const created = (await response.json()) as InvitationResponse;
    setInvitations((items) => [
      ...items.filter((invitation) => invitation.email !== created.email),
      created,
    ]);

    setInviteEmail("");
    setInviteRole("MEMBER");
    setBusy(null);

    setMessage(
      created.emailSent
        ? "Meghívó létrehozva, az email automatikusan elküldve."
        : created.emailWarning ??
            "Meghívó létrehozva. Az email nem ment ki, a link kézzel is megosztható.",
    );

    router.refresh();
  }

  async function copyInvite(token: string) {
    const url = `${window.location.origin}/invite/${token}`;
    await navigator.clipboard.writeText(url);
    setMessage("Meghívó link vágólapra másolva.");
  }

  async function cancelInvite(invitationId: string) {
    setBusy(invitationId);
    setError("");
    setMessage("");

    const response = await apiFetch(`/api/organizations/${organizationId}/invitations`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitationId }),
    });

    if (!response.ok) {
      setError(await getError(response));
      setBusy(null);
      return;
    }

    setInvitations((items) =>
      items.filter((invitation) => invitation.id !== invitationId),
    );
    setBusy(null);
    setMessage("Meghívó visszavonva.");
    router.refresh();
  }

  async function changeRole(member: Member, newRole: Role) {
    setBusy(member.id);
    setError("");
    setMessage("");

    const response = await apiFetch(`/api/organizations/${organizationId}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: member.id, role: newRole }),
    });

    if (!response.ok) {
      setError(await getError(response));
      setBusy(null);
      return;
    }

    const updated = (await response.json()) as Member;
    setMembers((items) =>
      items.map((item) =>
        item.id === updated.id ? { ...item, role: updated.role } : item,
      ),
    );
    setBusy(null);
    setMessage("Szervezeti szerepkör módosítva.");
    router.refresh();
  }

  async function remove(member: Member) {
    if (
      !window.confirm(
        `Biztosan eltávolítod ${member.user.name} felhasználót a szervezetből? A projekttagságai is törlődnek.`,
      )
    ) {
      return;
    }

    setBusy(member.id);
    setError("");
    setMessage("");

    const response = await apiFetch(`/api/organizations/${organizationId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: member.id }),
    });

    if (!response.ok) {
      setError(await getError(response));
      setBusy(null);
      return;
    }

    setMembers((items) => items.filter((item) => item.id !== member.id));
    setBusy(null);
    setMessage("Tag eltávolítva a szervezetből.");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-lg border border-red-500/50 bg-[#fff2f4] p-3 text-sm text-[#b33d50]">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-lg border border-green-500/50 bg-[#eef9f4] p-3 text-sm text-[#187555]">
          {message}
        </div>
      )}

      <section className="pf-card p-5 sm:p-6">
        <h2 className="text-2xl font-semibold">Meglévő felhasználó hozzáadása</h2>
        <p className="mt-1 text-sm text-gray-500">
          Ez szervezeti hozzáférést ad. Az ügyfélcégek személyes kapcsolattartóit az
          Ügyfelek oldalon kezeld.
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
          <input
            type="email"
            value={memberEmail}
            onChange={(event) => setMemberEmail(event.target.value)}
            placeholder="nev@ceg.hu"
            className="rounded-lg border bg-transparent px-3 py-2"
          />
          <select
            value={memberRole}
            onChange={(event) => setMemberRole(event.target.value as Role)}
            className="rounded-lg border bg-transparent px-3 py-2"
          >
            {selectableRoles.map((role) => (
              <option className="bg-white" key={role} value={role}>
                {LABELS[role]}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={
              !memberEmail ||
              busy === "add-member" ||
              (memberRole === "CLIENT" && !memberClientId)
            }
            onClick={addExistingMember}
            className="rounded-lg bg-[#5b67f1] px-4 py-2 font-medium text-white disabled:opacity-50"
          >
            {busy === "add-member" ? "Mentés…" : "Hozzáadás"}
          </button>
        </div>

        {memberRole === "CLIENT" && (
          <div className="mt-3">
            <label className="mb-2 block text-sm font-medium">
              Melyik ügyfélcéghez kapjon hozzáférést?
            </label>
            {clients.length ? (
              <select
                value={memberClientId}
                onChange={(event) => setMemberClientId(event.target.value)}
                className="w-full rounded-lg border bg-transparent px-3 py-2 md:max-w-xl"
              >
                {clients.map((client) => (
                  <option className="bg-white" key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-amber-600">Előbb hozz létre egy ügyfélcéget.</p>
            )}
          </div>
        )}
      </section>

      <section className="pf-card p-5 sm:p-6">
        <h2 className="text-2xl font-semibold">Új tag meghívása</h2>
        <p className="mt-1 text-sm text-gray-500">
          A meghívás szervezeti hozzáférést ad. Ügyfélfelhasználónál azt is megadod,
          melyik ügyfélcég adatait érheti el.
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
          <input
            type="email"
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            placeholder="nev@ceg.hu"
            className="rounded-lg border bg-transparent px-3 py-2"
          />
          <select
            value={inviteRole}
            onChange={(event) => setInviteRole(event.target.value as Role)}
            className="rounded-lg border bg-transparent px-3 py-2"
          >
            {selectableRoles.map((role) => (
              <option className="bg-white" key={role} value={role}>
                {LABELS[role]}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={
              !inviteEmail ||
              busy === "invite" ||
              (inviteRole === "CLIENT" && !inviteClientId)
            }
            onClick={invite}
            className="rounded-lg bg-[#5b67f1] px-4 py-2 font-medium text-white disabled:opacity-50"
          >
            {busy === "invite" ? "Küldés…" : "Meghívás"}
          </button>
        </div>

        {inviteRole === "CLIENT" && (
          <div className="mt-3">
            <label className="mb-2 block text-sm font-medium">
              Hozzáférés ügyfélcéghez
            </label>
            {clients.length ? (
              <select
                value={inviteClientId}
                onChange={(event) => setInviteClientId(event.target.value)}
                className="w-full rounded-lg border bg-transparent px-3 py-2 md:max-w-xl"
              >
                {clients.map((client) => (
                  <option className="bg-white" key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-amber-600">Előbb hozz létre egy ügyfélcéget.</p>
            )}
          </div>
        )}
      </section>

      <section className="pf-card p-5 sm:p-6">
        <h2 className="text-2xl font-semibold">Szervezeti tagok</h2>
        <p className="mt-1 text-sm text-gray-500">
          Ez a lista a ProjectFlow-felhasználókat mutatja, nem az ügyfélcégek
          kapcsolattartó-listáját.
        </p>

        <div className="mt-5 space-y-3">
          {members.map((member) => (
            <div
              key={member.id}
              className="rounded-xl border border-[#e8ebf1] bg-[#fbfcff] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-medium">
                    {member.user.name}
                    {member.userId === currentUserId && (
                      <span className="ml-2 text-xs text-gray-500">(te)</span>
                    )}
                  </p>
                  <p className="text-sm text-gray-500">{member.user.email}</p>
                </div>

                {member.role === "OWNER" ? (
                  <span className="rounded-full border px-3 py-1 text-xs">
                    Tulajdonos
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={member.role}
                      disabled={
                        busy === member.id ||
                        (currentUserRole === "ADMIN" && member.role === "ADMIN")
                      }
                      onChange={(event) =>
                        changeRole(member, event.target.value as Role)
                      }
                      className="rounded-xl border bg-white px-3 py-2 text-sm"
                    >
                      {selectableRoles.map((role) => (
                        <option className="bg-white" key={role} value={role}>
                          {LABELS[role]}
                        </option>
                      ))}
                    </select>

                    <button
                      disabled={
                        busy === member.id ||
                        member.userId === currentUserId ||
                        (currentUserRole === "ADMIN" && member.role === "ADMIN")
                      }
                      onClick={() => remove(member)}
                      className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
                    >
                      Eltávolítás
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="pf-card p-5 sm:p-6">
        <h2 className="text-2xl font-semibold">Függő meghívások</h2>

        {invitations.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">Nincs függő meghívó.</p>
        ) : (
          <div className="mt-5 space-y-3">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#e8ebf1] bg-[#fbfcff] p-4"
              >
                <div>
                  <p className="font-medium">{invitation.email}</p>
                  <p className="text-sm text-gray-500">
                    {LABELS[invitation.role]} · meghívta: {invitation.invitedBy.name}
                  </p>
                  {invitation.role === "CLIENT" && (
                    <p className="text-xs text-gray-500">
                      Hozzáférés: {invitation.clientName ?? "nincs ügyfélcég"}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    Lejár: {new Date(invitation.expiresAt).toLocaleString("hu-HU")}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => copyInvite(invitation.token)}
                    className="rounded-lg border px-3 py-2 text-sm"
                  >
                    Link másolása
                  </button>
                  <button
                    disabled={busy === invitation.id}
                    onClick={() => cancelInvite(invitation.id)}
                    className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
                  >
                    Visszavonás
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
