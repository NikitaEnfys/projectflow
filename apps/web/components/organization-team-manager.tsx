"use client";

import { apiFetch } from "@/lib/api/client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const ROLES = [
  "ADMIN",
  "PROJECT_MANAGER",
  "MEMBER",
  "CONTRACTOR",
  "CLIENT",
] as const;

type Role = (typeof ROLES)[number];

type ClientOption = {
  id: string;
  name: string;
};

type Member = {
  id: string;
  userId: string;
  role: Role | "OWNER";
  user: {
    name: string;
    email: string;
  };
  clientId: string | null;
  clientName: string | null;
};

type Invitation = {
  id: string;
  email: string;
  role: Role;
  token: string;
  expiresAt: string;
  invitedBy: {
    name: string;
  };
  clientId: string | null;
  clientName: string | null;
};

type InvitationResponse =
  Invitation & {
    emailSent?: boolean;
    emailWarning?: string | null;
  };

type Props = {
  organizationId: string;
  currentUserId: string;
  currentUserRole:
    | "OWNER"
    | "ADMIN";
  clients: ClientOption[];
  initialMembers: Member[];
  initialInvitations: Invitation[];
};

type MemberDraft = {
  role: Role;
  clientId: string;
};

const LABELS: Record<
  string,
  string
> = {
  OWNER: "Tulajdonos",
  ADMIN: "Adminisztrátor",
  PROJECT_MANAGER:
    "Projektvezető",
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

  const [members, setMembers] =
    useState(initialMembers);

  const [
    invitations,
    setInvitations,
  ] = useState(
    initialInvitations,
  );

  const [
    memberDrafts,
    setMemberDrafts,
  ] = useState<
    Record<string, MemberDraft>
  >(() =>
    Object.fromEntries(
      initialMembers
        .filter(
          (member) =>
            member.role !== "OWNER",
        )
        .map((member) => [
          member.id,
          {
            role:
              member.role as Role,
            clientId:
              member.clientId ??
              clients[0]?.id ??
              "",
          },
        ]),
    ),
  );

  const [
    memberEmail,
    setMemberEmail,
  ] = useState("");

  const [
    memberRole,
    setMemberRole,
  ] =
    useState<Role>("MEMBER");

  const [
    memberClientId,
    setMemberClientId,
  ] = useState(
    clients[0]?.id ?? "",
  );

  const [
    inviteEmail,
    setInviteEmail,
  ] = useState("");

  const [
    inviteRole,
    setInviteRole,
  ] =
    useState<Role>("MEMBER");

  const [
    inviteClientId,
    setInviteClientId,
  ] = useState(
    clients[0]?.id ?? "",
  );

  const [busy, setBusy] =
    useState<string | null>(
      null,
    );

  const [error, setError] =
    useState("");

  const [
    message,
    setMessage,
  ] = useState("");

  const selectableRoles =
    useMemo(
      () =>
        currentUserRole ===
        "OWNER"
          ? ROLES
          : ROLES.filter(
              (role) =>
                role !== "ADMIN",
            ),
      [currentUserRole],
    );

  async function getError(
    response: Response,
  ) {
    const data =
      await response
        .json()
        .catch(() => null);

    return (
      data?.error ||
      "A művelet nem sikerült."
    );
  }

  function getDraft(
    member: Member,
  ): MemberDraft {
    return (
      memberDrafts[
        member.id
      ] ?? {
        role:
          member.role ===
          "OWNER"
            ? "MEMBER"
            : member.role,
        clientId:
          member.clientId ??
          clients[0]?.id ??
          "",
      }
    );
  }

  function updateDraft(
    memberId: string,
    patch: Partial<MemberDraft>,
  ) {
    setMemberDrafts(
      (current) => ({
        ...current,
        [memberId]: {
          ...(current[
            memberId
          ] ?? {
            role: "MEMBER",
            clientId:
              clients[0]
                ?.id ?? "",
          }),
          ...patch,
        },
      }),
    );
  }

  async function addExistingMember() {
    setBusy("add-member");
    setError("");
    setMessage("");

    if (
      memberRole ===
        "CLIENT" &&
      !memberClientId
    ) {
      setError(
        "Ügyfélfelhasználónál válassz ügyfélcéget.",
      );
      setBusy(null);
      return;
    }

    const response =
      await apiFetch(
        `/api/organizations/${organizationId}/members`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            email:
              memberEmail,
            role:
              memberRole,
            clientId:
              memberRole ===
              "CLIENT"
                ? memberClientId
                : null,
          }),
        },
      );

    if (!response.ok) {
      setError(
        await getError(
          response,
        ),
      );
      setBusy(null);
      return;
    }

    const created =
      (await response.json()) as Member;

    setMembers((items) => [
      ...items,
      created,
    ]);

    setMemberDrafts(
      (current) => ({
        ...current,
        [created.id]: {
          role:
            created.role as Role,
          clientId:
            created.clientId ??
            clients[0]?.id ??
            "",
        },
      }),
    );

    setMemberEmail("");
    setMemberRole("MEMBER");
    setBusy(null);

    setMessage(
      "A meglévő felhasználó hozzáadva a szervezethez.",
    );

    router.refresh();
  }

  async function invite() {
    setBusy("invite");
    setError("");
    setMessage("");

    if (
      inviteRole ===
        "CLIENT" &&
      !inviteClientId
    ) {
      setError(
        "Ügyfélfelhasználónál válassz ügyfélcéget.",
      );
      setBusy(null);
      return;
    }

    const response =
      await apiFetch(
        `/api/organizations/${organizationId}/invitations`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            email:
              inviteEmail,
            role:
              inviteRole,
            clientId:
              inviteRole ===
              "CLIENT"
                ? inviteClientId
                : null,
          }),
        },
      );

    if (!response.ok) {
      setError(
        await getError(
          response,
        ),
      );
      setBusy(null);
      return;
    }

    const created =
      (await response.json()) as InvitationResponse;

    setInvitations(
      (items) => [
        ...items.filter(
          (invitation) =>
            invitation.email !==
            created.email,
        ),
        created,
      ],
    );

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

  async function copyInvite(
    token: string,
  ) {
    const url = `${window.location.origin}/invite/${token}`;

    await navigator.clipboard.writeText(
      url,
    );

    setMessage(
      "Meghívó link vágólapra másolva.",
    );
  }

  async function cancelInvite(
    invitationId: string,
  ) {
    setBusy(invitationId);
    setError("");
    setMessage("");

    const response =
      await apiFetch(
        `/api/organizations/${organizationId}/invitations`,
        {
          method:
            "DELETE",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            invitationId,
          }),
        },
      );

    if (!response.ok) {
      setError(
        await getError(
          response,
        ),
      );
      setBusy(null);
      return;
    }

    setInvitations(
      (items) =>
        items.filter(
          (invitation) =>
            invitation.id !==
            invitationId,
        ),
    );

    setBusy(null);
    setMessage(
      "Meghívó visszavonva.",
    );

    router.refresh();
  }

  async function saveRole(
    member: Member,
  ) {
    const draft =
      getDraft(member);

    if (
      draft.role ===
        "CLIENT" &&
      !draft.clientId
    ) {
      setError(
        "Ügyfél szerepkörnél válassz ügyfélcéget.",
      );
      return;
    }

    setBusy(member.id);
    setError("");
    setMessage("");

    const response =
      await apiFetch(
        `/api/organizations/${organizationId}/members`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            memberId:
              member.id,
            role:
              draft.role,
            clientId:
              draft.role ===
              "CLIENT"
                ? draft.clientId
                : null,
          }),
        },
      );

    if (!response.ok) {
      setError(
        await getError(
          response,
        ),
      );
      setBusy(null);
      return;
    }

    const updated =
      (await response.json()) as Member;

    setMembers(
      (items) =>
        items.map(
          (item) =>
            item.id ===
            updated.id
              ? {
                  ...item,
                  role:
                    updated.role,
                  clientId:
                    updated.clientId,
                  clientName:
                    updated.clientName,
                }
              : item,
        ),
    );

    setMemberDrafts(
      (current) => ({
        ...current,
        [updated.id]: {
          role:
            updated.role as Role,
          clientId:
            updated.clientId ??
            clients[0]?.id ??
            "",
        },
      }),
    );

    setBusy(null);

    setMessage(
      updated.role ===
        "CLIENT"
        ? `Szervezeti szerepkör módosítva. Ügyfélcég: ${updated.clientName ?? "nincs"}.`
        : "Szervezeti szerepkör módosítva.",
    );

    router.refresh();
  }

  async function remove(
    member: Member,
  ) {
    if (
      !window.confirm(
        `Biztosan eltávolítod ${member.user.name} felhasználót a szervezetből? A projekttagságai megszűnnek, de a CRM kapcsolattartói adatai megmaradnak.`,
      )
    ) {
      return;
    }

    setBusy(member.id);
    setError("");
    setMessage("");

    const response =
      await apiFetch(
        `/api/organizations/${organizationId}/members`,
        {
          method:
            "DELETE",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            memberId:
              member.id,
          }),
        },
      );

    if (!response.ok) {
      setError(
        await getError(
          response,
        ),
      );
      setBusy(null);
      return;
    }

    setMembers(
      (items) =>
        items.filter(
          (item) =>
            item.id !==
            member.id,
        ),
    );

    setBusy(null);

    setMessage(
      "Tag eltávolítva a szervezetből. A CRM kapcsolattartói rekordjai megmaradtak.",
    );

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
        <h2 className="text-2xl font-semibold">
          Meglévő felhasználó hozzáadása
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Ez szervezeti hozzáférést ad. Az ügyfélcégek személyes kapcsolattartóit az Ügyfelek oldalon kezeld.
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
          <input
            type="email"
            value={memberEmail}
            onChange={(event) =>
              setMemberEmail(
                event.target.value,
              )
            }
            placeholder="nev@ceg.hu"
            className="rounded-lg border bg-transparent px-3 py-2"
          />

          <select
            value={memberRole}
            onChange={(event) =>
              setMemberRole(
                event.target
                  .value as Role,
              )
            }
            className="rounded-lg border bg-transparent px-3 py-2"
          >
            {selectableRoles.map(
              (role) => (
                <option
                  className="bg-white"
                  key={role}
                  value={role}
                >
                  {LABELS[role]}
                </option>
              ),
            )}
          </select>

          <button
            type="button"
            disabled={
              !memberEmail ||
              busy ===
                "add-member" ||
              (memberRole ===
                "CLIENT" &&
                !memberClientId)
            }
            onClick={
              addExistingMember
            }
            className="rounded-lg bg-[#5b67f1] px-4 py-2 font-medium text-white disabled:opacity-50"
          >
            {busy ===
            "add-member"
              ? "Mentés…"
              : "Hozzáadás"}
          </button>
        </div>

        {memberRole ===
          "CLIENT" && (
          <div className="mt-3">
            <label className="mb-2 block text-sm font-medium">
              Melyik ügyfélcéghez tartozik?
            </label>

            {clients.length ? (
              <select
                value={
                  memberClientId
                }
                onChange={(event) =>
                  setMemberClientId(
                    event.target
                      .value,
                  )
                }
                className="w-full rounded-lg border bg-transparent px-3 py-2 md:max-w-xl"
              >
                {clients.map(
                  (client) => (
                    <option
                      className="bg-white"
                      key={
                        client.id
                      }
                      value={
                        client.id
                      }
                    >
                      {
                        client.name
                      }
                    </option>
                  ),
                )}
              </select>
            ) : (
              <p className="text-sm text-amber-600">
                Előbb hozz létre egy ügyfélcéget.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="pf-card p-5 sm:p-6">
        <h2 className="text-2xl font-semibold">
          Új tag meghívása
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          A meghívás szervezeti hozzáférést ad. Ügyfélfelhasználónál azt is megadod, melyik ügyfélcéghez tartozik.
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
          <input
            type="email"
            value={inviteEmail}
            onChange={(event) =>
              setInviteEmail(
                event.target.value,
              )
            }
            placeholder="nev@ceg.hu"
            className="rounded-lg border bg-transparent px-3 py-2"
          />

          <select
            value={inviteRole}
            onChange={(event) =>
              setInviteRole(
                event.target
                  .value as Role,
              )
            }
            className="rounded-lg border bg-transparent px-3 py-2"
          >
            {selectableRoles.map(
              (role) => (
                <option
                  className="bg-white"
                  key={role}
                  value={role}
                >
                  {LABELS[role]}
                </option>
              ),
            )}
          </select>

          <button
            type="button"
            disabled={
              !inviteEmail ||
              busy === "invite" ||
              (inviteRole ===
                "CLIENT" &&
                !inviteClientId)
            }
            onClick={invite}
            className="rounded-lg bg-[#5b67f1] px-4 py-2 font-medium text-white disabled:opacity-50"
          >
            {busy === "invite"
              ? "Küldés…"
              : "Meghívás"}
          </button>
        </div>

        {inviteRole ===
          "CLIENT" && (
          <div className="mt-3">
            <label className="mb-2 block text-sm font-medium">
              Ügyfélcég
            </label>

            {clients.length ? (
              <select
                value={
                  inviteClientId
                }
                onChange={(event) =>
                  setInviteClientId(
                    event.target
                      .value,
                  )
                }
                className="w-full rounded-lg border bg-transparent px-3 py-2 md:max-w-xl"
              >
                {clients.map(
                  (client) => (
                    <option
                      className="bg-white"
                      key={
                        client.id
                      }
                      value={
                        client.id
                      }
                    >
                      {
                        client.name
                      }
                    </option>
                  ),
                )}
              </select>
            ) : (
              <p className="text-sm text-amber-600">
                Előbb hozz létre egy ügyfélcéget.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="pf-card p-5 sm:p-6">
        <h2 className="text-2xl font-semibold">
          Szervezeti tagok
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          A szerepkör és az ügyfélcég módosítása csak a Mentés gombbal lép életbe.
        </p>

        <div className="mt-5 space-y-3">
          {members.map(
            (member) => {
              const draft =
                member.role ===
                "OWNER"
                  ? null
                  : getDraft(
                      member,
                    );

              const changed =
                draft &&
                (draft.role !==
                  member.role ||
                  (draft.role ===
                    "CLIENT" &&
                    draft.clientId !==
                      (member.clientId ??
                        "")));

              return (
                <div
                  key={
                    member.id
                  }
                  className="rounded-xl border border-[#e8ebf1] bg-[#fbfcff] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">
                        {
                          member
                            .user
                            .name
                        }
                        {member.userId ===
                          currentUserId && (
                          <span className="ml-2 text-xs text-gray-500">
                            (te)
                          </span>
                        )}
                      </p>

                      <p className="text-sm text-gray-500">
                        {
                          member
                            .user
                            .email
                        }
                      </p>

                      {member.role ===
                        "CLIENT" &&
                        member.clientName && (
                          <p className="mt-1 text-xs text-[#667084]">
                            Ügyfélcég:{" "}
                            {
                              member.clientName
                            }
                          </p>
                        )}
                    </div>

                    {member.role ===
                    "OWNER" ? (
                      <span className="rounded-full border px-3 py-1 text-xs">
                        Tulajdonos
                      </span>
                    ) : (
                      <div className="flex min-w-[280px] flex-col gap-2 sm:min-w-[440px]">
                        <div className="flex flex-wrap gap-2">
                          <select
                            value={
                              draft!
                                .role
                            }
                            disabled={
                              busy ===
                                member.id ||
                              (currentUserRole ===
                                "ADMIN" &&
                                member.role ===
                                  "ADMIN")
                            }
                            onChange={(
                              event,
                            ) =>
                              updateDraft(
                                member.id,
                                {
                                  role: event
                                    .target
                                    .value as Role,
                                },
                              )
                            }
                            className="min-w-[180px] flex-1 rounded-xl border bg-white px-3 py-2 text-sm"
                          >
                            {selectableRoles.map(
                              (
                                role,
                              ) => (
                                <option
                                  className="bg-white"
                                  key={
                                    role
                                  }
                                  value={
                                    role
                                  }
                                >
                                  {
                                    LABELS[
                                      role
                                    ]
                                  }
                                </option>
                              ),
                            )}
                          </select>

                          {draft!
                            .role ===
                            "CLIENT" && (
                            <select
                              value={
                                draft!
                                  .clientId
                              }
                              disabled={
                                busy ===
                                member.id
                              }
                              onChange={(
                                event,
                              ) =>
                                updateDraft(
                                  member.id,
                                  {
                                    clientId:
                                      event
                                        .target
                                        .value,
                                  },
                                )
                              }
                              className="min-w-[180px] flex-1 rounded-xl border bg-white px-3 py-2 text-sm"
                            >
                              <option value="">
                                Válassz ügyfélcéget…
                              </option>

                              {clients.map(
                                (
                                  client,
                                ) => (
                                  <option
                                    key={
                                      client.id
                                    }
                                    value={
                                      client.id
                                    }
                                  >
                                    {
                                      client.name
                                    }
                                  </option>
                                ),
                              )}
                            </select>
                          )}
                        </div>

                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={
                              busy ===
                                member.id ||
                              !changed ||
                              (draft!
                                .role ===
                                "CLIENT" &&
                                !draft!
                                  .clientId) ||
                              (currentUserRole ===
                                "ADMIN" &&
                                member.role ===
                                  "ADMIN")
                            }
                            onClick={() =>
                              saveRole(
                                member,
                              )
                            }
                            className="rounded-lg bg-[#5b67f1] px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
                          >
                            {busy ===
                            member.id
                              ? "Mentés…"
                              : "Mentés"}
                          </button>

                          <button
                            type="button"
                            disabled={
                              busy ===
                                member.id ||
                              member.userId ===
                                currentUserId ||
                              (currentUserRole ===
                                "ADMIN" &&
                                member.role ===
                                  "ADMIN")
                            }
                            onClick={() =>
                              remove(
                                member,
                              )
                            }
                            className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
                          >
                            Eltávolítás
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            },
          )}
        </div>
      </section>

      <section className="pf-card p-5 sm:p-6">
        <h2 className="text-2xl font-semibold">
          Függő meghívások
        </h2>

        {invitations.length ===
        0 ? (
          <p className="mt-4 text-sm text-gray-500">
            Nincs függő meghívó.
          </p>
        ) : (
          <div className="mt-5 space-y-3">
            {invitations.map(
              (
                invitation,
              ) => (
                <div
                  key={
                    invitation.id
                  }
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#e8ebf1] bg-[#fbfcff] p-4"
                >
                  <div>
                    <p className="font-medium">
                      {
                        invitation.email
                      }
                    </p>

                    <p className="text-sm text-gray-500">
                      {
                        LABELS[
                          invitation
                            .role
                        ]
                      }{" "}
                      · meghívta:{" "}
                      {
                        invitation
                          .invitedBy
                          .name
                      }
                    </p>

                    {invitation.role ===
                      "CLIENT" && (
                      <p className="text-xs text-gray-500">
                        Ügyfélcég:{" "}
                        {invitation.clientName ??
                          "nincs ügyfélcég"}
                      </p>
                    )}

                    <p className="text-xs text-gray-500">
                      Lejár:{" "}
                      {new Date(
                        invitation.expiresAt,
                      ).toLocaleString(
                        "hu-HU",
                      )}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        copyInvite(
                          invitation.token,
                        )
                      }
                      className="rounded-lg border px-3 py-2 text-sm"
                    >
                      Link másolása
                    </button>

                    <button
                      disabled={
                        busy ===
                        invitation.id
                      }
                      onClick={() =>
                        cancelInvite(
                          invitation.id,
                        )
                      }
                      className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
                    >
                      Visszavonás
                    </button>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </section>
    </div>
  );
}
