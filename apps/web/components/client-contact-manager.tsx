"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { useRouter } from "next/navigation";

type Contact = {
  id: string;
  name: string;
  email: string;
  position: string | null;
  userId: string | null;
};

export function ClientContactManager({
  clientId,
  initialContacts,
}: {
  clientId: string;
  initialContacts: Contact[];
}) {
  const router = useRouter();
  const [contacts, setContacts] = useState(initialContacts);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [position, setPosition] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPosition, setEditPosition] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function readError(response: Response) {
    const data = await response.json().catch(() => null);
    return data?.error ?? "A művelet nem sikerült.";
  }

  async function addContact(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    const response = await apiFetch(`/api/clients/${clientId}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, position }),
    });

    if (!response.ok) {
      setError(await readError(response));
      setBusy(false);
      return;
    }

    const created = (await response.json()) as Contact;
    setContacts((items) => [...items, created].sort((a, b) => a.name.localeCompare(b.name, "hu")));
    setName("");
    setEmail("");
    setPosition("");
    setBusy(false);
    setMessage("Kapcsolattartó hozzáadva.");
    router.refresh();
  }

  function beginEdit(contact: Contact) {
    setEditingId(contact.id);
    setEditName(contact.name);
    setEditEmail(contact.email);
    setEditPosition(contact.position ?? "");
    setError("");
    setMessage("");
  }

  async function saveEdit() {
    if (!editingId) return;
    setBusy(true);
    setError("");

    const response = await apiFetch(`/api/clients/${clientId}/contacts`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactId: editingId,
        name: editName,
        email: editEmail,
        position: editPosition,
      }),
    });

    if (!response.ok) {
      setError(await readError(response));
      setBusy(false);
      return;
    }

    const updated = (await response.json()) as Contact;
    setContacts((items) =>
      items
        .map((item) => (item.id === updated.id ? updated : item))
        .sort((a, b) => a.name.localeCompare(b.name, "hu")),
    );
    setEditingId(null);
    setBusy(false);
    setMessage("Kapcsolattartó módosítva.");
    router.refresh();
  }

  async function removeContact(contact: Contact) {
    if (!window.confirm(`Biztosan törlöd ${contact.name} kapcsolattartót?`)) return;

    setBusy(true);
    setError("");

    const response = await apiFetch(`/api/clients/${clientId}/contacts`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: contact.id }),
    });

    if (!response.ok) {
      setError(await readError(response));
      setBusy(false);
      return;
    }

    setContacts((items) => items.filter((item) => item.id !== contact.id));
    if (editingId === contact.id) setEditingId(null);
    setBusy(false);
    setMessage("Kapcsolattartó törölve az adatbázisból.");
    router.refresh();
  }

  return (
    <section className="pf-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#30384b]">Kapcsolattartók</h2>
          <p className="mt-1 text-xs text-[#8993a5]">
            Létrehozás, szerkesztés és végleges törlés.
          </p>
        </div>
        <span className="pf-chip">{contacts.length} fő</span>
      </div>

      {error && <p className="mt-4 rounded-xl bg-[#fff2f4] p-3 text-sm text-[#b33d50]">{error}</p>}
      {message && <p className="mt-4 rounded-xl bg-[#eef9f4] p-3 text-sm text-[#187555]">{message}</p>}

      <form onSubmit={addContact} className="mt-5 grid gap-3 md:grid-cols-2">
        <input className="rounded-xl border bg-white px-3.5 py-2.5" placeholder="Kapcsolattartó neve" value={name} onChange={(e) => setName(e.target.value)} required />
        <input type="email" className="rounded-xl border bg-white px-3.5 py-2.5" placeholder="nev@ceg.hu" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="rounded-xl border bg-white px-3.5 py-2.5 md:col-span-2" placeholder="Pozíció (opcionális)" value={position} onChange={(e) => setPosition(e.target.value)} />
        <div className="md:col-span-2">
          <button disabled={busy} className="pf-button-primary disabled:opacity-50">
            + Kapcsolattartó
          </button>
        </div>
      </form>

      <div className="mt-6 space-y-3 border-t border-[#edf0f5] pt-5">
        {contacts.map((contact) =>
          editingId === contact.id ? (
            <div key={contact.id} className="grid gap-2 rounded-xl border bg-[#fbfcff] p-4 md:grid-cols-2">
              <input className="rounded-xl border bg-white p-2.5" value={editName} onChange={(e) => setEditName(e.target.value)} />
              <input type="email" className="rounded-xl border bg-white p-2.5" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
              <input className="rounded-xl border bg-white p-2.5 md:col-span-2" value={editPosition} onChange={(e) => setEditPosition(e.target.value)} placeholder="Pozíció" />
              <div className="flex gap-2 md:col-span-2">
                <button type="button" disabled={busy} onClick={saveEdit} className="pf-button-primary">Mentés</button>
                <button type="button" onClick={() => setEditingId(null)} className="pf-button-secondary">Mégse</button>
              </div>
            </div>
          ) : (
            <div key={contact.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e9ecf2] bg-[#fbfcff] p-3.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#444d60]">{contact.name}</p>
                <p className="mt-1 text-xs text-[#778195]">
                  {contact.email}{contact.position ? ` · ${contact.position}` : ""}
                </p>
                <p className="mt-1 text-[10px] text-[#9ca4b3]">
                  ProjectFlow fiók: {contact.userId ? "összekapcsolva" : "nincs"}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => beginEdit(contact)} className="rounded-lg border px-3 py-1.5 text-xs">Szerkesztés</button>
                <button type="button" disabled={busy} onClick={() => removeContact(contact)} className="rounded-lg border border-[#efc9cf] px-3 py-1.5 text-xs text-[#b33d50]">Törlés</button>
              </div>
            </div>
          ),
        )}

        {contacts.length === 0 && <div className="pf-empty py-5 text-sm">Még nincs kapcsolattartó.</div>}
      </div>
    </section>
  );
}
