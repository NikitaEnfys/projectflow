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
  CLIENT: "Ügyfél",
};

export function OrganizationTeamManager({ organizationId, currentUserId, currentUserRole, clients, initialMembers, initialInvitations }: Props) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("MEMBER");
  const [inviteClientId, setInviteClientId] = useState(clients[0]?.id ?? "");
  const [clientSelections, setClientSelections] = useState<Record<string, string>>(
    Object.fromEntries(initialMembers.map((member) => [member.userId, member.clientId ?? ""])),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectableRoles = useMemo(
    () => currentUserRole === "OWNER" ? ROLES : ROLES.filter((r) => r !== "ADMIN"),
    [currentUserRole],
  );

  async function getError(response: Response) {
    const data = await response.json().catch(() => null);
    return data?.error || "A művelet nem sikerült.";
  }

  async function invite() {
    setBusy("invite"); setError(""); setMessage("");
    if (role === "CLIENT" && !inviteClientId) {
      setError("Ügyfél szerepkörnél válassz ügyfélcéget."); setBusy(null); return;
    }
    const response = await apiFetch(`/api/organizations/${organizationId}/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role, clientId: role === "CLIENT" ? inviteClientId : null }),
    });
    if (!response.ok) { setError(await getError(response)); setBusy(null); return; }
    const created = await response.json() as Invitation;
    setInvitations((items) => [...items.filter((i) => i.email !== created.email), created]);
    setEmail(""); setRole("MEMBER"); setMessage("Meghívó létrehozva. A linket másold el a meghívottnak."); setBusy(null); router.refresh();
  }

  async function copyInvite(token: string) {
    const url = `${window.location.origin}/invite/${token}`;
    await navigator.clipboard.writeText(url);
    setMessage("Meghívó link vágólapra másolva.");
  }

  async function cancelInvite(invitationId: string) {
    setBusy(invitationId); setError(""); setMessage("");
    const response = await apiFetch(`/api/organizations/${organizationId}/invitations`, {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invitationId }),
    });
    if (!response.ok) { setError(await getError(response)); setBusy(null); return; }
    setInvitations((items) => items.filter((i) => i.id !== invitationId)); setBusy(null); setMessage("Meghívó visszavonva."); router.refresh();
  }

  async function changeRole(member: Member, newRole: Role) {
    setBusy(member.id); setError(""); setMessage("");
    const response = await apiFetch(`/api/organizations/${organizationId}/members`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberId: member.id, role: newRole }),
    });
    if (!response.ok) { setError(await getError(response)); setBusy(null); return; }
    const updated = await response.json() as Member;
    setMembers((items) => items.map((m) => m.id === updated.id ? { ...m, role: updated.role } : m));
    setBusy(null); setMessage("Szervezeti szerepkör módosítva."); router.refresh();
  }

  async function assignClient(member: Member) {
    const clientId = clientSelections[member.userId] || "";
    setBusy(`client-${member.id}`); setError(""); setMessage("");
    const response = await apiFetch(`/api/organizations/${organizationId}/client-contacts`, {
      method: clientId ? "PUT" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: member.userId, clientId }),
    });
    if (!response.ok) { setError(await getError(response)); setBusy(null); return; }
    const selected = clients.find((client) => client.id === clientId) ?? null;
    setMembers((items) => items.map((m) => m.id === member.id ? { ...m, clientId: selected?.id ?? null, clientName: selected?.name ?? null } : m));
    setBusy(null); setMessage(clientId ? "Ügyfélfelhasználó ügyfélcéghez rendelve." : "Ügyfélkapcsolat eltávolítva."); router.refresh();
  }

  async function remove(member: Member) {
    if (!window.confirm(`Biztosan eltávolítod ${member.user.name} felhasználót a szervezetből? A projekttagságai is törlődnek.`)) return;
    setBusy(member.id); setError(""); setMessage("");
    const response = await apiFetch(`/api/organizations/${organizationId}/members`, {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberId: member.id }),
    });
    if (!response.ok) { setError(await getError(response)); setBusy(null); return; }
    setMembers((items) => items.filter((m) => m.id !== member.id)); setBusy(null); setMessage("Tag eltávolítva a szervezetből."); router.refresh();
  }

  return <div className="space-y-8">
    {error && <div className="rounded-lg border border-red-500/50 bg-[#fff2f4] p-3 text-sm text-[#b33d50]">{error}</div>}
    {message && <div className="rounded-lg border border-green-500/50 bg-[#eef9f4] p-3 text-sm text-[#187555]">{message}</div>}

    <section className="pf-card p-5 sm:p-6">
      <h2 className="text-2xl font-semibold">Új tag meghívása</h2>
      <p className="mt-1 text-sm text-gray-500">Ügyfél meghívásakor válaszd ki azt az ügyfélcéget is, amelyhez a felhasználó tartozik.</p>
      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nev@ceg.hu" className="rounded-lg border bg-transparent px-3 py-2" />
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="rounded-lg border bg-transparent px-3 py-2">
          {selectableRoles.map((r) => <option className="bg-white" key={r} value={r}>{LABELS[r]}</option>)}
        </select>
        <button type="button" disabled={!email || busy === "invite" || (role === "CLIENT" && !inviteClientId)} onClick={invite} className="rounded-lg bg-[#5b67f1] px-4 py-2 font-medium text-white disabled:opacity-50">{busy === "invite" ? "Létrehozás…" : "Meghívás"}</button>
      </div>
      {role === "CLIENT" && <div className="mt-3">
        <label className="mb-2 block text-sm font-medium">Ügyfélcég</label>
        {clients.length ? <select value={inviteClientId} onChange={(e) => setInviteClientId(e.target.value)} className="w-full rounded-lg border bg-transparent px-3 py-2 md:max-w-xl">
          {clients.map((client) => <option className="bg-white" key={client.id} value={client.id}>{client.name}</option>)}
        </select> : <p className="text-sm text-amber-300">Előbb hozz létre egy ügyfélcéget.</p>}
      </div>}
    </section>

    <section className="pf-card p-5 sm:p-6">
      <h2 className="text-2xl font-semibold">Szervezeti tagok</h2>
      <div className="mt-5 space-y-3">
        {members.map((member) => <div key={member.id} className="rounded-xl border border-[#e8ebf1] bg-[#fbfcff] p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-medium">{member.user.name}{member.userId === currentUserId && <span className="ml-2 text-xs text-gray-500">(te)</span>}</p>
              <p className="text-sm text-gray-500">{member.user.email}</p>
              {member.role === "CLIENT" && <p className="mt-1 text-xs text-gray-500">Ügyfélcég: {member.clientName ?? "nincs hozzárendelve"}</p>}
            </div>
            {member.role === "OWNER" ? <span className="rounded-full border px-3 py-1 text-xs">Tulajdonos</span> : <div className="flex flex-wrap gap-2">
              <select value={member.role} disabled={busy === member.id || (currentUserRole === "ADMIN" && member.role === "ADMIN")} onChange={(e) => changeRole(member, e.target.value as Role)} className="rounded-xl border bg-white px-3 py-2 text-sm">
                {selectableRoles.map((r) => <option className="bg-white" key={r} value={r}>{LABELS[r]}</option>)}
              </select>
              <button disabled={busy === member.id || member.userId === currentUserId || (currentUserRole === "ADMIN" && member.role === "ADMIN")} onClick={() => remove(member)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">Eltávolítás</button>
            </div>}
          </div>
          {member.role === "CLIENT" && <div className="mt-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
            <select value={clientSelections[member.userId] ?? ""} onChange={(e) => setClientSelections((items) => ({ ...items, [member.userId]: e.target.value }))} className="rounded-xl border bg-white px-3 py-2 text-sm">
              <option className="bg-white" value="">Nincs ügyfélcéghez rendelve</option>
              {clients.map((client) => <option className="bg-white" key={client.id} value={client.id}>{client.name}</option>)}
            </select>
            <button onClick={() => assignClient(member)} disabled={busy === `client-${member.id}`} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">{busy === `client-${member.id}` ? "Mentés…" : "Ügyfélkapcsolat mentése"}</button>
          </div>}
        </div>)}
      </div>
    </section>

    <section className="pf-card p-5 sm:p-6">
      <h2 className="text-2xl font-semibold">Függő meghívások</h2>
      {invitations.length === 0 ? <p className="mt-4 text-sm text-gray-500">Nincs függő meghívó.</p> : <div className="mt-5 space-y-3">{invitations.map((inv) => <div key={inv.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#e8ebf1] bg-[#fbfcff] p-4">
        <div>
          <p className="font-medium">{inv.email}</p>
          <p className="text-sm text-gray-500">{LABELS[inv.role]} · meghívta: {inv.invitedBy.name}</p>
          {inv.role === "CLIENT" && <p className="text-xs text-gray-500">Ügyfélcég: {inv.clientName ?? "nincs megadva"}</p>}
          <p className="text-xs text-gray-500">Lejár: {new Date(inv.expiresAt).toLocaleString("hu-HU")}</p>
        </div>
        <div className="flex gap-2"><button onClick={() => copyInvite(inv.token)} className="rounded-lg border px-3 py-2 text-sm">Link másolása</button><button disabled={busy === inv.id} onClick={() => cancelInvite(inv.id)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Visszavonás</button></div>
      </div>)}</div>}
    </section>
  </div>;
}
