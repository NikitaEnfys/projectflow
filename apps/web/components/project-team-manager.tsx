"use client";
import { apiFetch } from "@/lib/api/client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const PROJECT_ROLES = ["PROJECT_MANAGER", "MEMBER", "CONTRACTOR", "CLIENT"] as const;
type ProjectRoleValue = (typeof PROJECT_ROLES)[number];

type TeamMember = {
  id: string;
  userId: string;
  role: ProjectRoleValue;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

type Candidate = {
  userId: string;
  name: string;
  email: string;
  organizationRole: string;
};

type ProjectTeamManagerProps = {
  projectId: string;
  initialMembers: TeamMember[];
  candidates: Candidate[];
  canManage: boolean;
  currentUserId: string;
};

const ROLE_LABELS: Record<ProjectRoleValue, string> = {
  PROJECT_MANAGER: "Projektvezető",
  MEMBER: "Belső munkatárs",
  CONTRACTOR: "Alvállalkozó",
  CLIENT: "Ügyfél",
};

function allowedRolesForCandidate(candidate: Candidate | undefined): readonly ProjectRoleValue[] {
  return candidate?.organizationRole === "CLIENT" ? ["CLIENT"] : PROJECT_ROLES;
}

export function ProjectTeamManager({
  projectId,
  initialMembers,
  candidates,
  canManage,
  currentUserId,
}: ProjectTeamManagerProps) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [availableCandidates, setAvailableCandidates] = useState(candidates);
  const [selectedUserId, setSelectedUserId] = useState(candidates[0]?.userId ?? "");
  const [selectedRole, setSelectedRole] = useState<ProjectRoleValue>(candidates[0]?.organizationRole === "CLIENT" ? "CLIENT" : "MEMBER");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const managerCount = useMemo(
    () => members.filter((member) => member.role === "PROJECT_MANAGER").length,
    [members]
  );
  const selectedCandidate = useMemo(
    () => availableCandidates.find((candidate) => candidate.userId === selectedUserId),
    [availableCandidates, selectedUserId]
  );
  const addableRoles = allowedRolesForCandidate(selectedCandidate);

  async function readError(response: Response) {
    const data = await response.json().catch(() => null);
    return data?.error || "A művelet nem sikerült.";
  }

  async function addMember() {
    if (!selectedUserId) return;
    setError(null);
    setMessage(null);
    setBusyId("add");

    const response = await apiFetch(`/api/projects/${projectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedUserId, role: selectedRole }),
    });

    if (!response.ok) {
      setError(await readError(response));
      setBusyId(null);
      return;
    }

    const created = (await response.json()) as TeamMember;
    setMembers((current) => [...current, created]);
    setAvailableCandidates((current) => current.filter((candidate) => candidate.userId !== selectedUserId));
    const remaining = availableCandidates.filter((candidate) => candidate.userId !== selectedUserId);
    const nextCandidate = remaining[0];
    setSelectedUserId(nextCandidate?.userId ?? "");
    setSelectedRole(nextCandidate?.organizationRole === "CLIENT" ? "CLIENT" : "MEMBER");
    setMessage(`${created.user.name} hozzáadva a projekthez.`);
    setBusyId(null);
    router.refresh();
  }

  async function changeRole(member: TeamMember, role: ProjectRoleValue) {
    if (member.role === role) return;
    setError(null);
    setMessage(null);
    setBusyId(member.id);

    const response = await apiFetch(`/api/projects/${projectId}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: member.id, role }),
    });

    if (!response.ok) {
      setError(await readError(response));
      setBusyId(null);
      return;
    }

    const updated = (await response.json()) as TeamMember;
    setMembers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    setMessage(`${updated.user.name} szerepköre módosítva.`);
    setBusyId(null);
    router.refresh();
  }

  async function removeMember(member: TeamMember) {
    const selfRemoval = member.userId === currentUserId;
    const confirmed = window.confirm(
      selfRemoval
        ? "Biztosan eltávolítod saját magad a projektből? Elveszítheted a hozzáférésedet."
        : `Biztosan eltávolítod ${member.user.name} felhasználót a projektből?`
    );
    if (!confirmed) return;

    setError(null);
    setMessage(null);
    setBusyId(member.id);

    const response = await apiFetch(`/api/projects/${projectId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: member.id }),
    });

    if (!response.ok) {
      setError(await readError(response));
      setBusyId(null);
      return;
    }

    setMembers((current) => current.filter((item) => item.id !== member.id));
    setAvailableCandidates((current) => [
      ...current,
      {
        userId: member.userId,
        name: member.user.name,
        email: member.user.email,
        organizationRole: "",
      },
    ].sort((a, b) => a.name.localeCompare(b.name, "hu")));
    setSelectedUserId((current) => current || member.userId);
    setMessage(`${member.user.name} eltávolítva a projektből.`);
    setBusyId(null);
    router.refresh();
  }

  return (
    <section className="mb-8 pf-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Projektcsapat</h2>
          <p className="mt-1 text-sm text-gray-600">
            A projekthez rendelt felhasználók és projektszintű szerepköreik.
          </p>
        </div>
        {canManage && (
          <span className="rounded-full border px-3 py-1 text-xs text-gray-600">
            {managerCount} projektvezető
          </span>
        )}
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-500/50 bg-[#fff2f4] p-3 text-sm text-[#b33d50]">{error}</div>}
      {message && <div className="mt-4 rounded-lg border border-green-500/50 bg-[#eef9f4] p-3 text-sm text-[#187555]">{message}</div>}

      {canManage && (
        <div className="mt-5 rounded-xl border border-[#e8ebf1] bg-[#fbfcff] p-4">
          <h3 className="font-medium">Tag hozzáadása</h3>
          {availableCandidates.length === 0 ? (
            <p className="mt-2 text-sm text-gray-600">A szervezet minden felhasználója már tagja ennek a projektnek.</p>
          ) : (
            <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
              <select
                value={selectedUserId}
                onChange={(event) => {
                  const nextUserId = event.target.value;
                  const candidate = availableCandidates.find((item) => item.userId === nextUserId);
                  setSelectedUserId(nextUserId);
                  setSelectedRole(candidate?.organizationRole === "CLIENT" ? "CLIENT" : "MEMBER");
                }}
                className="rounded-xl border bg-white px-3 py-2 text-sm"
              >
                {availableCandidates.map((candidate) => (
                  <option key={candidate.userId} value={candidate.userId} className="bg-white">
                    {candidate.name} — {candidate.email}
                  </option>
                ))}
              </select>
              <select
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.target.value as ProjectRoleValue)}
                className="rounded-xl border bg-white px-3 py-2 text-sm"
              >
                {addableRoles.map((role) => (
                  <option key={role} value={role} className="bg-white">{ROLE_LABELS[role]}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={addMember}
                disabled={!selectedUserId || busyId === "add"}
                className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
              >
                {busyId === "add" ? "Hozzáadás…" : "+ Tag hozzáadása"}
              </button>
            </div>
          )}
        </div>
      )}

      {members.length === 0 ? (
        <p className="mt-5 text-sm text-gray-600">Még nincs projekttag hozzárendelve.</p>
      ) : (
        <div className="mt-5 grid gap-3">
          {members.map((member) => (
            <div key={member.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#e8ebf1] bg-[#fbfcff] p-4">
              <div>
                <p className="font-medium">
                  {member.user.name}
                  {member.userId === currentUserId && <span className="ml-2 text-xs text-gray-500">(te)</span>}
                </p>
                <p className="text-sm text-gray-600">{member.user.email}</p>
              </div>

              {canManage ? (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={member.role}
                    onChange={(event) => changeRole(member, event.target.value as ProjectRoleValue)}
                    disabled={busyId === member.id}
                    className="rounded-xl border bg-white px-3 py-2 text-sm"
                  >
                    {PROJECT_ROLES.map((role) => (
                      <option key={role} value={role} className="bg-white">{ROLE_LABELS[role]}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeMember(member)}
                    disabled={busyId === member.id}
                    className="rounded-lg border px-3 py-2 text-sm hover:bg-[#f7f8fc] disabled:opacity-50"
                  >
                    Eltávolítás
                  </button>
                </div>
              ) : (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-black">
                  {ROLE_LABELS[member.role]}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
