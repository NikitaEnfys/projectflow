"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { useRouter } from "next/navigation";

type Contact = {
  id: string;
  name: string;
  email: string;
  position?: string | null;
};

type Link = {
  id: string;
  clientContactId: string;
  isPrimary: boolean;
  clientContact: Contact;
};

export function ProjectClientContactManager({
  projectId,
  contacts,
  initialLinks,
  canManage,
}: {
  projectId: string;
  contacts: Contact[];
  initialLinks: Link[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(
    initialLinks.map((link) => link.clientContactId),
  );
  const [primary, setPrimary] = useState<string | null>(
    initialLinks.find((link) => link.isPrimary)?.clientContactId ??
      initialLinks[0]?.clientContactId ??
      null,
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function toggle(contactId: string) {
    setSelected((current) => {
      if (current.includes(contactId)) {
        const next = current.filter((id) => id !== contactId);
        if (primary === contactId) setPrimary(next[0] ?? null);
        return next;
      }

      const next = [...current, contactId];
      if (!primary) setPrimary(contactId);
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setError("");
    setMessage("");

    const response = await apiFetch(`/api/projects/${projectId}/client-contacts`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientContactIds: selected,
        primaryClientContactId: primary,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Nem sikerült menteni a kapcsolattartókat.");
      setBusy(false);
      return;
    }

    setMessage("A projekt kapcsolattartói mentve.");
    setBusy(false);
    router.refresh();
  }

  return (
    <section className="pf-card mb-7 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#30384b]">Ügyfél kapcsolattartói</h2>
          <p className="mt-1 text-xs text-[#8d96a7]">
            A projekthez kijelölt kapcsolattartók az ügyfélcég személyei közül.
          </p>
        </div>
        <span className="pf-chip">{selected.length} kijelölve</span>
      </div>

      {contacts.length === 0 ? (
        <div className="mt-4 pf-empty py-5 text-sm">
          Az ügyfélcéghez még nincs kapcsolattartó rögzítve.
        </div>
      ) : (
        <div className="mt-5 grid gap-2.5 md:grid-cols-2">
          {contacts.map((contact) => {
            const checked = selected.includes(contact.id);
            return (
              <div
                key={contact.id}
                className={`rounded-xl border p-3.5 ${
                  checked ? "border-[#bfc5ff] bg-[#f6f7ff]" : "border-[#e8ebf1] bg-white"
                }`}
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!canManage}
                    onChange={() => toggle(contact.id)}
                    className="mt-1"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-[#414a5d]">
                      {contact.name}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-[#7c8597]">
                      {contact.email}
                      {contact.position ? ` · ${contact.position}` : ""}
                    </span>
                  </span>
                </label>

                {checked && (
                  <label className="mt-3 flex items-center gap-2 border-t border-[#e4e7f5] pt-3 text-xs text-[#687286]">
                    <input
                      type="radio"
                      name={`primary-contact-${projectId}`}
                      checked={primary === contact.id}
                      disabled={!canManage}
                      onChange={() => setPrimary(contact.id)}
                    />
                    Elsődleges kapcsolattartó
                  </label>
                )}
              </div>
            );
          })}
        </div>
      )}

      {error && <p className="mt-4 text-sm text-[#b33d50]">{error}</p>}
      {message && <p className="mt-4 text-sm text-[#187555]">{message}</p>}

      {canManage && contacts.length > 0 && (
        <button
          type="button"
          disabled={busy}
          onClick={save}
          className="pf-button-primary mt-5 disabled:opacity-50"
        >
          {busy ? "Mentés…" : "Kapcsolattartók mentése"}
        </button>
      )}
    </section>
  );
}
