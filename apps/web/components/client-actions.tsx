"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";

export function ClientActions({
  clientId,
  initialName,
}: {
  clientId: string;
  initialName: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");

    const response = await apiFetch(`/api/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      setError(data?.error ?? "Nem sikerült módosítani az ügyfélcéget.");
      setBusy(false);
      return;
    }

    setEditing(false);
    setBusy(false);
    router.refresh();
  }

  async function remove() {
    if (!window.confirm(`Biztosan törlöd a(z) „${initialName}” ügyfélcéget?`)) return;

    setBusy(true);
    setError("");

    const response = await apiFetch(`/api/clients/${clientId}`, { method: "DELETE" });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      setError(data?.error ?? "Nem sikerült törölni az ügyfélcéget.");
      setBusy(false);
      return;
    }

    router.push("/clients");
    router.refresh();
  }

  return (
    <section className="pf-card mb-7 border border-[#e3e7ef] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#30384b]">Ügyfélcég műveletek</h2>
          <p className="mt-1 text-xs text-[#8993a5]">
            Módosítás vagy végleges törlés az adatbázisból.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setEditing(!editing)} className="pf-button-secondary">
            {editing ? "Mégse" : "Szerkesztés"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={remove}
            className="rounded-xl border border-[#e9aeb8] bg-[#fff3f5] px-4 py-2 text-sm font-bold text-[#b02f46] disabled:opacity-50"
          >
            Törlés
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-4 flex flex-col gap-3 border-t border-[#edf0f5] pt-4 sm:flex-row">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="min-w-0 flex-1 rounded-xl border bg-white px-3.5 py-2.5"
          />
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={save}
            className="pf-button-primary disabled:opacity-50"
          >
            Mentés
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-[#b33d50]">{error}</p>}
    </section>
  );
}
