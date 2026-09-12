"use client";

import { apiFetch } from "@/lib/api/client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type User = { id: string; name: string; email: string };
type Contact = {
  id: string;
  name: string;
  email: string;
  position?: string | null;
};
type Client = { id: string; name: string; contacts: Contact[] };
type Access = { canCreateProject: boolean };

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [status, setStatus] = useState("PLANNING");
  const [priority, setPriority] = useState("MEDIUM");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [primaryContactId, setPrimaryContactId] = useState<string | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const activeClient = useMemo(
    () => clients.find((client) => client.id === clientId) ?? null,
    [clients, clientId],
  );

  useEffect(() => {
    async function loadOptions() {
      try {
        const accessRes = await apiFetch("/api/access");
        const access: Access = await accessRes.json();
        setAllowed(Boolean(access.canCreateProject));
        if (!access.canCreateProject) return;

        const [clientsRes, usersRes] = await Promise.all([
          apiFetch("/api/clients"),
          apiFetch("/api/users"),
        ]);

        if (!clientsRes.ok || !usersRes.ok) {
          throw new Error("Nem sikerült betölteni a választási lehetőségeket.");
        }

        setClients(await clientsRes.json());
        setUsers(await usersRes.json());
      } catch (error) {
        console.error(error);
        setError("Nem sikerült betölteni az ügyfeleket és felhasználókat.");
      } finally {
        setIsLoadingOptions(false);
      }
    }

    loadOptions();
  }, []);

  function chooseClient(value: string) {
    setClientId(value);
    setSelectedContacts([]);
    setPrimaryContactId(null);
  }

  function toggleContact(contactId: string) {
    setSelectedContacts((current) => {
      if (current.includes(contactId)) {
        const next = current.filter((id) => id !== contactId);
        if (primaryContactId === contactId) setPrimaryContactId(next[0] ?? null);
        return next;
      }

      const next = [...current, contactId];
      if (!primaryContactId) setPrimaryContactId(contactId);
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!name.trim() || !clientId || !ownerId) {
      setError("A projekt neve, ügyfele és felelőse kötelező.");
      return;
    }

    if (startDate && dueDate && dueDate < startDate) {
      setError("A határidő nem lehet korábbi a kezdési dátumnál.");
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await apiFetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          clientId,
          ownerId,
          status,
          priority,
          startDate,
          dueDate,
          clientContactIds: selectedContacts,
          primaryClientContactId: primaryContactId,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || result.details || "Ismeretlen hiba");

      router.push(`/projects/${result.id}`);
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Hiba történt a projekt létrehozásakor.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoadingOptions) return <main><p>Betöltés...</p></main>;

  if (allowed === false) {
    return (
      <main>
        <div className="pf-card p-5 sm:p-6">
          <h1 className="text-2xl font-bold">Nincs jogosultságod</h1>
          <p className="mt-2 text-sm text-gray-600">
            Új projektet csak tulajdonos, adminisztrátor vagy projektvezető hozhat létre.
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="pf-page">
      <div className="mx-auto max-w-3xl">
        <div className="pf-page-header">
          <div>
            <p className="pf-eyebrow">Új munka</p>
            <h1 className="pf-title">Új projekt</h1>
            <p className="pf-subtitle">
              Válaszd ki az ügyfélcéget, majd a projekt konkrét kapcsolattartóit.
            </p>
          </div>
        </div>

        <div className="pf-card p-5 sm:p-7">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium">Projekt neve</label>
              <input
                className="w-full rounded-xl border bg-white p-3"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Pl. Céges weboldal redesign"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Leírás</label>
              <textarea
                className="w-full rounded-xl border bg-white p-3"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">Ügyfélcég</label>
                <select
                  className="w-full rounded-xl border bg-white p-3"
                  value={clientId}
                  onChange={(event) => chooseClient(event.target.value)}
                >
                  <option value="">Válassz ügyfélcéget</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name} · {client.contacts.length} kapcsolattartó
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Projektvezető</label>
                <select
                  className="w-full rounded-xl border bg-white p-3"
                  value={ownerId}
                  onChange={(event) => setOwnerId(event.target.value)}
                >
                  <option value="">Válassz felelőst</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {activeClient && (
              <div className="rounded-xl border border-[#e6e9f0] bg-[#fbfcff] p-4">
                <div>
                  <p className="text-sm font-semibold text-[#424b5e]">
                    Projekt kapcsolattartói
                  </p>
                  <p className="mt-1 text-xs text-[#8993a5]">
                    A kiválasztott ügyfélcéghez tartozó személyek. Több személy is
                    kijelölhető.
                  </p>
                </div>

                {activeClient.contacts.length === 0 ? (
                  <p className="mt-4 text-sm text-[#8b94a5]">
                    Ennél az ügyfélcégnél még nincs kapcsolattartó. Előbb az Ügyfelek
                    oldalon adj hozzá egy személyt, vagy a projektet most is
                    létrehozhatod kapcsolattartó nélkül.
                  </p>
                ) : (
                  <div className="mt-4 grid gap-2 md:grid-cols-2">
                    {activeClient.contacts.map((contact) => {
                      const checked = selectedContacts.includes(contact.id);
                      return (
                        <div
                          key={contact.id}
                          className={`rounded-xl border p-3 ${
                            checked
                              ? "border-[#bcc3ff] bg-[#f5f6ff]"
                              : "border-[#e7eaf0] bg-white"
                          }`}
                        >
                          <label className="flex cursor-pointer gap-2.5">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleContact(contact.id)}
                              className="mt-1"
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold">
                                {contact.name}
                              </span>
                              <span className="block truncate text-xs text-[#7c8597]">
                                {contact.email}
                              </span>
                            </span>
                          </label>

                          {checked && (
                            <label className="mt-2 flex items-center gap-2 text-xs text-[#687286]">
                              <input
                                type="radio"
                                name="primary-contact"
                                checked={primaryContactId === contact.id}
                                onChange={() => setPrimaryContactId(contact.id)}
                              />
                              Elsődleges
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">Státusz</label>
                <select
                  className="w-full rounded-xl border bg-white p-3"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="PLANNING">Tervezés</option>
                  <option value="ACTIVE">Aktív</option>
                  <option value="ON_HOLD">Szüneteltetve</option>
                  <option value="COMPLETED">Befejezett</option>
                  <option value="CANCELLED">Törölt</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Prioritás</label>
                <select
                  className="w-full rounded-xl border bg-white p-3"
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                >
                  <option value="LOW">Alacsony</option>
                  <option value="MEDIUM">Közepes</option>
                  <option value="HIGH">Magas</option>
                  <option value="URGENT">Sürgős</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">Kezdési dátum</label>
                <input
                  type="date"
                  className="w-full rounded-xl border bg-white p-3"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Határidő</label>
                <input
                  type="date"
                  className="w-full rounded-xl border bg-white p-3"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-[#b33d50]">
                {error}
              </div>
            )}

            <button disabled={isSubmitting} className="pf-button-primary disabled:opacity-50">
              {isSubmitting ? "Mentés..." : "Projekt létrehozása"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
