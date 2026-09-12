"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";

type Contact = {
  id: string;
  name: string;
  email: string;
  position: string | null;
  userId: string | null;
};

export function ClientCrudManager({
  clientId,
  initialName,
  initialContacts,
}: {
  clientId: string;
  initialName: string;
  initialContacts: Contact[];
}) {
  const router = useRouter();

  const [clientName, setClientName] = useState(initialName);
  const [editClient, setEditClient] = useState(false);

  const [contacts, setContacts] = useState(initialContacts);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPosition, setNewPosition] = useState("");

  const [editingContactId, setEditingContactId] =
    useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPosition, setEditPosition] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function readError(response: Response) {
    const data = await response.json().catch(() => null);
    return data?.error || data?.details || "A művelet nem sikerült.";
  }

  async function saveClient() {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await apiFetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: clientName }),
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      setEditClient(false);
      setMessage("Ügyfél módosítva.");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Hiba történt.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteClient() {
    if (
      !window.confirm(
        `Biztosan végleg törlöd a(z) „${initialName}” ügyfelet?`,
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await apiFetch(`/api/clients/${clientId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      router.push("/clients");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Hiba történt.",
      );
      setBusy(false);
    }
  }

  async function createContact(event: React.FormEvent) {
    event.preventDefault();

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await apiFetch(
        `/api/clients/${clientId}/contacts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newName,
            email: newEmail,
            position: newPosition,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const contact = (await response.json()) as Contact;

      setContacts((current) =>
        [...current, contact].sort((a, b) =>
          a.name.localeCompare(b.name, "hu"),
        ),
      );

      setNewName("");
      setNewEmail("");
      setNewPosition("");
      setMessage("Kapcsolattartó létrehozva.");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Hiba történt.",
      );
    } finally {
      setBusy(false);
    }
  }

  function beginContactEdit(contact: Contact) {
    setEditingContactId(contact.id);
    setEditName(contact.name);
    setEditEmail(contact.email);
    setEditPosition(contact.position ?? "");
    setError("");
    setMessage("");
  }

  async function saveContact() {
    if (!editingContactId) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await apiFetch(
        `/api/clients/${clientId}/contacts`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactId: editingContactId,
            name: editName,
            email: editEmail,
            position: editPosition,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const updated = (await response.json()) as Contact;

      setContacts((current) =>
        current
          .map((contact) =>
            contact.id === updated.id ? updated : contact,
          )
          .sort((a, b) => a.name.localeCompare(b.name, "hu")),
      );

      setEditingContactId(null);
      setMessage("Kapcsolattartó módosítva.");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Hiba történt.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteContact(contact: Contact) {
    if (
      !window.confirm(
        `Biztosan végleg törlöd ${contact.name} kapcsolattartót?`,
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await apiFetch(
        `/api/clients/${clientId}/contacts`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactId: contact.id }),
        },
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      setContacts((current) =>
        current.filter((item) => item.id !== contact.id),
      );

      if (editingContactId === contact.id) {
        setEditingContactId(null);
      }

      setMessage("Kapcsolattartó törölve.");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Hiba történt.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-7">
      {(error || message) && (
        <div
          className={`rounded-xl border p-3.5 text-sm ${
            error
              ? "border-[#f1cdd3] bg-[#fff2f4] text-[#b33d50]"
              : "border-[#cce8dc] bg-[#eef9f4] text-[#187555]"
          }`}
        >
          {error || message}
        </div>
      )}

      <section className="pf-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-[#30384b]">
              Ügyfél kezelése
            </h2>
            <p className="mt-1 text-xs text-[#8993a5]">
              Az ügyfél adatainak módosítása vagy végleges törlése.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setEditClient((current) => !current)}
              className="pf-button-secondary"
            >
              {editClient ? "Mégse" : "Szerkesztés"}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={deleteClient}
              className="rounded-xl border border-[#efc9cf] bg-[#fff7f8] px-4 py-2 text-sm font-semibold text-[#b33d50] disabled:opacity-50"
            >
              Törlés
            </button>
          </div>
        </div>

        {editClient && (
          <div className="mt-4 flex flex-col gap-3 border-t border-[#edf0f5] pt-4 sm:flex-row">
            <input
              value={clientName}
              onChange={(event) => setClientName(event.target.value)}
              className="min-w-0 flex-1 rounded-xl border bg-white px-3.5 py-2.5"
            />

            <button
              type="button"
              disabled={busy || !clientName.trim()}
              onClick={saveClient}
              className="pf-button-primary disabled:opacity-50"
            >
              Változások mentése
            </button>
          </div>
        )}
      </section>

      <section className="pf-card p-5 sm:p-6">
        <div>
          <h2 className="text-base font-bold text-[#30384b]">
            Új kapcsolattartó
          </h2>
          <p className="mt-1 text-xs text-[#8993a5]">
            A kapcsolattartó ProjectFlow-fiók nélkül is létezhet.
          </p>
        </div>

        <form
          onSubmit={createContact}
          className="mt-5 grid gap-3 md:grid-cols-2"
        >
          <input
            className="rounded-xl border bg-white p-3"
            placeholder="Név"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />

          <input
            type="email"
            className="rounded-xl border bg-white p-3"
            placeholder="E-mail"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
          />

          <input
            className="rounded-xl border bg-white p-3 md:col-span-2"
            placeholder="Pozíció (opcionális)"
            value={newPosition}
            onChange={(event) => setNewPosition(event.target.value)}
          />

          <div className="md:col-span-2">
            <button
              disabled={busy || !newName.trim() || !newEmail.trim()}
              className="pf-button-primary disabled:opacity-50"
            >
              + Kapcsolattartó létrehozása
            </button>
          </div>
        </form>
      </section>

      <section className="pf-card p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-[#30384b]">
            Kapcsolattartók
          </h2>
          <span className="pf-chip">{contacts.length} fő</span>
        </div>

        {contacts.length === 0 ? (
          <div className="mt-4 pf-empty py-5 text-sm">
            Még nincs kapcsolattartó.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {contacts.map((contact) =>
              editingContactId === contact.id ? (
                <div
                  key={contact.id}
                  className="grid gap-3 rounded-xl border border-[#e8ebf1] bg-[#fbfcff] p-4 md:grid-cols-2"
                >
                  <input
                    className="rounded-xl border bg-white p-3"
                    value={editName}
                    onChange={(event) =>
                      setEditName(event.target.value)
                    }
                  />

                  <input
                    type="email"
                    className="rounded-xl border bg-white p-3"
                    value={editEmail}
                    onChange={(event) =>
                      setEditEmail(event.target.value)
                    }
                  />

                  <input
                    className="rounded-xl border bg-white p-3 md:col-span-2"
                    value={editPosition}
                    onChange={(event) =>
                      setEditPosition(event.target.value)
                    }
                    placeholder="Pozíció"
                  />

                  <div className="flex gap-2 md:col-span-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={saveContact}
                      className="pf-button-primary disabled:opacity-50"
                    >
                      Mentés
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditingContactId(null)}
                      className="pf-button-secondary"
                    >
                      Mégse
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  key={contact.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e9ecf2] bg-[#fbfcff] p-4"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[#444d60]">
                      {contact.name}
                    </p>
                    <p className="mt-1 text-sm text-[#778195]">
                      {contact.email}
                      {contact.position
                        ? ` · ${contact.position}`
                        : ""}
                    </p>
                    <p className="mt-1 text-[10px] text-[#9ca4b3]">
                      ProjectFlow fiók:{" "}
                      {contact.userId ? "összekapcsolva" : "nincs"}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => beginContactEdit(contact)}
                      className="rounded-lg border px-3 py-2 text-xs"
                    >
                      Szerkesztés
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => deleteContact(contact)}
                      className="rounded-lg border border-[#efc9cf] px-3 py-2 text-xs font-semibold text-[#b33d50] disabled:opacity-50"
                    >
                      Törlés
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
