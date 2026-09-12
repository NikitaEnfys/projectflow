"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";

function dateValue(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

export function ProjectActions({
  projectId,
  project,
}: {
  projectId: string;
  project: {
    name: string;
    description: string | null;
    status: string;
    priority: string;
    startDate: string | null;
    dueDate: string | null;
  };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [status, setStatus] = useState(project.status);
  const [priority, setPriority] = useState(project.priority);
  const [startDate, setStartDate] = useState(dateValue(project.startDate));
  const [dueDate, setDueDate] = useState(dateValue(project.dueDate));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");

    const response = await apiFetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, status, priority, startDate, dueDate }),
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      setError(data?.error ?? "Nem sikerült módosítani a projektet.");
      setBusy(false);
      return;
    }

    setEditing(false);
    setBusy(false);
    router.refresh();
  }

  async function remove() {
    if (
      !window.confirm(
        `Biztosan törlöd a(z) „${project.name}” projektet? ` +
          "A hozzá tartozó feladatok, mérföldkövek, kommentek és aktivitások is törlődnek.",
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");

    const response = await apiFetch(`/api/projects/${projectId}`, { method: "DELETE" });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      setError(data?.error ?? "Nem sikerült törölni a projektet.");
      setBusy(false);
      return;
    }

    router.push("/projects");
    router.refresh();
  }

  return (
    <section className="pf-card mb-7 border border-[#e3e7ef] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#30384b]">Projekt műveletek</h2>
          <p className="mt-1 text-xs text-[#8993a5]">
            Alapadatok módosítása vagy a projekt végleges törlése.
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
        <div className="mt-5 grid gap-4 border-t border-[#edf0f5] pt-5">
          <input className="rounded-xl border bg-white p-3" value={name} onChange={(e) => setName(e.target.value)} />
          <textarea className="rounded-xl border bg-white p-3" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="grid gap-4 md:grid-cols-2">
            <select className="rounded-xl border bg-white p-3" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="PLANNING">Tervezés</option>
              <option value="ACTIVE">Aktív</option>
              <option value="ON_HOLD">Szüneteltetve</option>
              <option value="COMPLETED">Befejezett</option>
              <option value="CANCELLED">Törölt</option>
            </select>
            <select className="rounded-xl border bg-white p-3" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="LOW">Alacsony</option>
              <option value="MEDIUM">Közepes</option>
              <option value="HIGH">Magas</option>
              <option value="URGENT">Sürgős</option>
            </select>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <input type="date" className="rounded-xl border bg-white p-3" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <input type="date" className="rounded-xl border bg-white p-3" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <button
              type="button"
              disabled={busy || !name.trim()}
              onClick={save}
              className="pf-button-primary disabled:opacity-50"
            >
              Változások mentése
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-[#b33d50]">{error}</p>}
    </section>
  );
}
