"use client";

import { apiFetch } from "@/lib/api/client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Contact = {
  id: string;
  name: string;
  email: string;
  position: string | null;
  userId: string | null;
};

type Client = {
  id: string;
  name: string;
  contacts: Contact[];
};

type Manager = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type Organization = {
  id: string;
  name: string;
  currentUserRole: string;
  canInvite: boolean;
  clients: Client[];
  managers: Manager[];
};

type SetupOptions = {
  currentUser: {
    id: string;
    name: string;
    email: string;
  };
  organizations: Organization[];
};

const STATUS_OPTIONS = [
  { value: "PLANNING", label: "Tervezés" },
  { value: "ACTIVE", label: "Aktív" },
  { value: "ON_HOLD", label: "Szüneteltetve" },
  { value: "COMPLETED", label: "Befejezett" },
];

const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Alacsony" },
  { value: "MEDIUM", label: "Közepes" },
  { value: "HIGH", label: "Magas" },
  { value: "URGENT", label: "Sürgős" },
];

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Tulajdonos",
  ADMIN: "Adminisztrátor",
  PROJECT_MANAGER: "Projektvezető",
};

export default function NewProjectPage() {
  const router = useRouter();

  const [options, setOptions] = useState<SetupOptions | null>(null);
  const [organizationId, setOrganizationId] = useState("");

  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");

  const [clientChoice, setClientChoice] = useState("");
  const [newClientName, setNewClientName] = useState("");

  const [contactChoice, setContactChoice] = useState("none");
  const [newContactName, setNewContactName] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [newContactPosition, setNewContactPosition] = useState("");

  const [ownerId, setOwnerId] = useState("");
  const [sendInvitation, setSendInvitation] = useState(false);

  const [status, setStatus] = useState("PLANNING");
  const [priority, setPriority] = useState("MEDIUM");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await apiFetch("/api/projects/setup");

        if (!response.ok) {
          throw new Error("Nem sikerült betölteni a projektbeállításokat.");
        }

        const data = (await response.json()) as SetupOptions;
        setOptions(data);

        const firstOrganization = data.organizations[0];

        if (firstOrganization) {
          setOrganizationId(firstOrganization.id);

          const currentUserManager = firstOrganization.managers.find(
            (manager) => manager.id === data.currentUser.id,
          );

          setOwnerId(
            currentUserManager?.id ??
              firstOrganization.managers[0]?.id ??
              "",
          );
        }
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Nem sikerült betölteni az adatokat.",
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const organization = useMemo(
    () =>
      options?.organizations.find(
        (item) => item.id === organizationId,
      ) ?? null,
    [options, organizationId],
  );

  const existingClient = useMemo(() => {
    if (!organization || !clientChoice.startsWith("existing:")) {
      return null;
    }

    const id = clientChoice.slice("existing:".length);

    return organization.clients.find((client) => client.id === id) ?? null;
  }, [organization, clientChoice]);

  const availableContacts = existingClient?.contacts ?? [];

  const selectedExistingContact = useMemo(() => {
    if (!contactChoice.startsWith("existing:")) return null;

    const id = contactChoice.slice("existing:".length);

    return availableContacts.find((contact) => contact.id === id) ?? null;
  }, [availableContacts, contactChoice]);

  function changeOrganization(value: string) {
    setOrganizationId(value);
    setClientChoice("");
    setNewClientName("");
    setContactChoice("none");
    setSendInvitation(false);

    const nextOrganization = options?.organizations.find(
      (item) => item.id === value,
    );

    const currentUserManager = nextOrganization?.managers.find(
      (manager) => manager.id === options?.currentUser.id,
    );

    setOwnerId(
      currentUserManager?.id ??
        nextOrganization?.managers[0]?.id ??
        "",
    );
  }

  function changeClient(value: string) {
    setClientChoice(value);
    setContactChoice("none");
    setNewContactName("");
    setNewContactEmail("");
    setNewContactPosition("");
    setSendInvitation(false);
  }

  function changeContact(value: string) {
    setContactChoice(value);
    setSendInvitation(false);

    if (value !== "new") {
      setNewContactName("");
      setNewContactEmail("");
      setNewContactPosition("");
    }
  }

  const contactForInvitation =
    contactChoice === "new"
      ? {
          email: newContactEmail,
          linked: false,
        }
      : selectedExistingContact
        ? {
            email: selectedExistingContact.email,
            linked: Boolean(selectedExistingContact.userId),
          }
        : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (!projectName.trim()) {
      setError("Add meg a projekt nevét.");
      return;
    }

    if (!organization) {
      setError("Válassz szervezetet.");
      return;
    }

    if (!clientChoice) {
      setError("Válassz ügyfelet vagy hozz létre újat.");
      return;
    }

    if (clientChoice === "new" && !newClientName.trim()) {
      setError("Add meg az új ügyfél nevét.");
      return;
    }

    if (
      contactChoice === "new" &&
      (!newContactName.trim() || !newContactEmail.trim())
    ) {
      setError(
        "Új kapcsolattartónál add meg a nevet és az e-mail címet.",
      );
      return;
    }

    if (!ownerId) {
      setError("Válassz projektvezetőt.");
      return;
    }

    if (startDate && dueDate && dueDate < startDate) {
      setError("A határidő nem lehet korábbi a kezdési dátumnál.");
      return;
    }

    const client =
      clientChoice === "new"
        ? {
            mode: "new",
            name: newClientName,
          }
        : {
            mode: "existing",
            id: clientChoice.slice("existing:".length),
          };

    const contact =
      contactChoice === "none"
        ? { mode: "none" }
        : contactChoice === "new"
          ? {
              mode: "new",
              name: newContactName,
              email: newContactEmail,
              position: newContactPosition,
            }
          : {
              mode: "existing",
              id: contactChoice.slice("existing:".length),
            };

    try {
      setSubmitting(true);

      const response = await apiFetch("/api/projects/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organizationId,
          name: projectName,
          description,
          client,
          contact,
          ownerId,
          sendInvitation,
          status,
          priority,
          startDate,
          dueDate,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Nem sikerült létrehozni a projektet.",
        );
      }

      router.push(`/projects/${result.projectId}`);
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Nem sikerült létrehozni a projektet.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="pf-page">
        <div className="pf-card mx-auto max-w-3xl p-6 text-sm text-[#778195]">
          Projektbeállítások betöltése…
        </div>
      </div>
    );
  }

  if (!options || options.organizations.length === 0) {
    return (
      <div className="pf-page">
        <div className="pf-card mx-auto max-w-3xl p-6">
          <h1 className="text-xl font-bold text-[#30384b]">
            Nem hozhatsz létre projektet
          </h1>
          <p className="mt-2 text-sm text-[#778195]">
            Ehhez tulajdonos, adminisztrátor vagy projektvezető
            szerepkör szükséges.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pf-page">
      <div className="mx-auto max-w-4xl">
        <div className="pf-page-header">
          <div>
            <p className="pf-eyebrow">Gyors projektindítás</p>
            <h1 className="pf-title">Új projekt</h1>
            <p className="pf-subtitle">
              A meglévő adatokat listából választod ki. Új adatot csak
              akkor kell begépelni, ha még nem létezik.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-5">
          {options.organizations.length > 1 && (
            <section className="pf-card p-5 sm:p-6">
              <label className="block text-sm font-semibold text-[#465065]">
                Szervezet
                <select
                  className="mt-2 w-full rounded-xl border bg-white p-3"
                  value={organizationId}
                  onChange={(event) =>
                    changeOrganization(event.target.value)
                  }
                >
                  {options.organizations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </section>
          )}

          <section className="pf-card p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eef0ff] text-sm font-bold text-[#5965df]">
                1
              </span>
              <div>
                <h2 className="font-bold text-[#30384b]">
                  Projekt
                </h2>
                <p className="text-xs text-[#8993a5]">
                  Egyetlen kötelező kézi mező.
                </p>
              </div>
            </div>

            <label className="block text-sm font-semibold text-[#465065]">
              Projekt neve
              <input
                className="mt-2 w-full rounded-xl border bg-white p-3"
                value={projectName}
                onChange={(event) =>
                  setProjectName(event.target.value)
                }
                placeholder="Pl. Weboldal újratervezés"
                autoFocus
              />
            </label>

            <label className="mt-4 block text-sm font-semibold text-[#465065]">
              Rövid leírás
              <textarea
                rows={3}
                className="mt-2 w-full rounded-xl border bg-white p-3"
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                placeholder="Opcionális"
              />
            </label>
          </section>

          <section className="pf-card p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eef0ff] text-sm font-bold text-[#5965df]">
                2
              </span>
              <div>
                <h2 className="font-bold text-[#30384b]">
                  Ügyfél
                </h2>
                <p className="text-xs text-[#8993a5]">
                  Válassz meglévőt, vagy hozz létre újat itt helyben.
                </p>
              </div>
            </div>

            <select
              className="w-full rounded-xl border bg-white p-3"
              value={clientChoice}
              onChange={(event) =>
                changeClient(event.target.value)
              }
            >
              <option value="">Válassz ügyfelet…</option>

              {organization?.clients.map((client) => (
                <option
                  key={client.id}
                  value={`existing:${client.id}`}
                >
                  {client.name}
                  {client.contacts.length
                    ? ` · ${client.contacts.length} kapcsolattartó`
                    : " · nincs kapcsolattartó"}
                </option>
              ))}

              <option value="new">＋ Új ügyfél létrehozása</option>
            </select>

            {clientChoice === "new" && (
              <div className="mt-4 rounded-xl border border-[#dfe3ed] bg-[#fbfcff] p-4">
                <label className="block text-sm font-semibold text-[#465065]">
                  Új ügyfél neve
                  <input
                    className="mt-2 w-full rounded-xl border bg-white p-3"
                    value={newClientName}
                    onChange={(event) =>
                      setNewClientName(event.target.value)
                    }
                    placeholder="Pl. Acme Kft."
                  />
                </label>
              </div>
            )}
          </section>

          {clientChoice && (
            <section className="pf-card p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eef0ff] text-sm font-bold text-[#5965df]">
                  3
                </span>
                <div>
                  <h2 className="font-bold text-[#30384b]">
                    Kapcsolattartó
                  </h2>
                  <p className="text-xs text-[#8993a5]">
                    Nem kötelező. Ha már létezik, csak válaszd ki.
                  </p>
                </div>
              </div>

              <select
                className="w-full rounded-xl border bg-white p-3"
                value={contactChoice}
                onChange={(event) =>
                  changeContact(event.target.value)
                }
              >
                <option value="none">
                  Nincs kijelölt kapcsolattartó
                </option>

                {availableContacts.map((contact) => (
                  <option
                    key={contact.id}
                    value={`existing:${contact.id}`}
                  >
                    {contact.name} · {contact.email}
                    {contact.position
                      ? ` · ${contact.position}`
                      : ""}
                  </option>
                ))}

                <option value="new">
                  ＋ Új kapcsolattartó létrehozása
                </option>
              </select>

              {contactChoice === "new" && (
                <div className="mt-4 grid gap-3 rounded-xl border border-[#dfe3ed] bg-[#fbfcff] p-4 md:grid-cols-2">
                  <label className="text-sm font-semibold text-[#465065]">
                    Név
                    <input
                      className="mt-2 w-full rounded-xl border bg-white p-3"
                      value={newContactName}
                      onChange={(event) =>
                        setNewContactName(event.target.value)
                      }
                    />
                  </label>

                  <label className="text-sm font-semibold text-[#465065]">
                    E-mail
                    <input
                      type="email"
                      className="mt-2 w-full rounded-xl border bg-white p-3"
                      value={newContactEmail}
                      onChange={(event) =>
                        setNewContactEmail(event.target.value)
                      }
                    />
                  </label>

                  <label className="text-sm font-semibold text-[#465065] md:col-span-2">
                    Pozíció
                    <input
                      className="mt-2 w-full rounded-xl border bg-white p-3"
                      value={newContactPosition}
                      onChange={(event) =>
                        setNewContactPosition(event.target.value)
                      }
                      placeholder="Opcionális"
                    />
                  </label>
                </div>
              )}

              {contactForInvitation &&
                organization?.canInvite &&
                !contactForInvitation.linked && (
                  <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-[#e3e6f5] bg-[#f7f8ff] p-4">
                    <input
                      type="checkbox"
                      checked={sendInvitation}
                      onChange={(event) =>
                        setSendInvitation(event.target.checked)
                      }
                      className="mt-1"
                    />

                    <span>
                      <span className="block text-sm font-semibold text-[#465065]">
                        Meghívás küldése a ProjectFlow-ba
                      </span>
                      <span className="mt-1 block text-xs text-[#7d8798]">
                        A projekt létrehozása után automatikusan
                        ügyfél-hozzáférésű meghívót küldünk a(z){" "}
                        {contactForInvitation.email || "megadott e-mail címre"}.
                      </span>
                    </span>
                  </label>
                )}
            </section>
          )}

          <section className="pf-card p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eef0ff] text-sm font-bold text-[#5965df]">
                4
              </span>
              <div>
                <h2 className="font-bold text-[#30384b]">
                  Felelős
                </h2>
                <p className="text-xs text-[#8993a5]">
                  Alapból te vagy kijelölve, de listából módosítható.
                </p>
              </div>
            </div>

            <label className="block text-sm font-semibold text-[#465065]">
              Projektvezető
              <select
                className="mt-2 w-full rounded-xl border bg-white p-3"
                value={ownerId}
                onChange={(event) =>
                  setOwnerId(event.target.value)
                }
              >
                {organization?.managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.name}
                    {manager.id === options.currentUser.id
                      ? " · Te"
                      : ""}
                    {" · "}
                    {ROLE_LABELS[manager.role] ?? manager.role}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="pf-card p-5 sm:p-6">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left"
              onClick={() =>
                setShowAdvanced((current) => !current)
              }
            >
              <span>
                <span className="block font-bold text-[#30384b]">
                  További beállítások
                </span>
                <span className="mt-1 block text-xs text-[#8993a5]">
                  Nem kötelező. Alapból Tervezés / Közepes.
                </span>
              </span>

              <span className="text-[#778195]">
                {showAdvanced ? "▲" : "▼"}
              </span>
            </button>

            {showAdvanced && (
              <div className="mt-5 grid gap-4 border-t border-[#edf0f5] pt-5 md:grid-cols-2">
                <label className="text-sm font-semibold text-[#465065]">
                  Státusz
                  <select
                    className="mt-2 w-full rounded-xl border bg-white p-3"
                    value={status}
                    onChange={(event) =>
                      setStatus(event.target.value)
                    }
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-semibold text-[#465065]">
                  Prioritás
                  <select
                    className="mt-2 w-full rounded-xl border bg-white p-3"
                    value={priority}
                    onChange={(event) =>
                      setPriority(event.target.value)
                    }
                  >
                    {PRIORITY_OPTIONS.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-semibold text-[#465065]">
                  Kezdési dátum
                  <input
                    type="date"
                    className="mt-2 w-full rounded-xl border bg-white p-3"
                    value={startDate}
                    onChange={(event) =>
                      setStartDate(event.target.value)
                    }
                  />
                </label>

                <label className="text-sm font-semibold text-[#465065]">
                  Határidő
                  <input
                    type="date"
                    className="mt-2 w-full rounded-xl border bg-white p-3"
                    value={dueDate}
                    onChange={(event) =>
                      setDueDate(event.target.value)
                    }
                  />
                </label>
              </div>
            )}
          </section>

          {error && (
            <div className="rounded-xl border border-[#f1cdd3] bg-[#fff2f4] p-4 text-sm text-[#b33d50]">
              {error}
            </div>
          )}

          <div className="sticky bottom-4 z-10 rounded-2xl border border-[#e3e6ed] bg-white/95 p-4 shadow-lg backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm text-[#667084]">
                <span className="font-semibold text-[#30384b]">
                  {projectName.trim() || "Új projekt"}
                </span>

                {clientChoice && (
                  <>
                    {" · "}
                    {clientChoice === "new"
                      ? newClientName || "Új ügyfél"
                      : existingClient?.name}
                  </>
                )}
              </div>

              <button
                disabled={
                  submitting ||
                  !projectName.trim() ||
                  !clientChoice ||
                  !ownerId
                }
                className="pf-button-primary disabled:opacity-50"
              >
                {submitting
                  ? "Projekt létrehozása…"
                  : "Projekt létrehozása"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
