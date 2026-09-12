"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";

function dateValue(value: string | null) {
  return value
    ? new Date(value).toISOString().slice(0, 10)
    : "";
}

export function ProjectCrudManager({
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
  const [description, setDescription] =
    useState(project.description ?? "");
  const [status, setStatus] = useState(project.status);
  const [priority, setPriority] = useState(project.priority);
  const [startDate, setStartDate] =
    useState(dateValue(project.startDate));
  const [dueDate, setDueDate] =
    useState(dateValue(project.dueDate));

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function readError(response: Response) {
    const data = await response.json().catch(() => null);
    return data?.error || data?.details || "A művelet nem sikerült.";
  }

  async function save() {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await apiFetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          status,
          priority,
          startDate,
          dueDate,
        }),
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      setEditing(false);
      setMessage("Projekt módosítva.");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Hiba történt.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (
      !window.confirm(
        `Biztosan végleg törlöd a(z) „${project.name}” projektet? ` +
          "A feladatok, mérföldkövek, kommentek és aktivitások is törlődnek.",
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await apiFetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      router.push("/projects");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Hiba történt.",
      );
      setBusy(false);
    }
  }

  return (
    <section className="pf-card mb-7 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-[#30384b]">
            Projekt kezelése
          </h2>
          <p className="mt-1 text-xs text-[#8993a5]">
            Projektadatok módosítása vagy a projekt végleges törlése.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEditing((current) => !current)}
            className="pf-button-secondary"
          >
            {editing ? "Mégse" : "Szerkesztés"}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={remove}
            className="rounded-xl border border-[#efc9cf] bg-[#fff7f8] px-4 py-2 text-sm font-semibold text-[#b33d50] disabled:opacity-50"
          >
            Törlés
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-[#fff2f4] p-3 text-sm text-[#b33d50]">
          {error}
        </p>
      )}

      {message && (
        <p className="mt-4 rounded-xl bg-[#eef9f4] p-3 text-sm text-[#187555]">
          {message}
        </p>
      )}

      {editing && (
        <div className="mt-5 grid gap-4 border-t border-[#edf0f5] pt-5">
          <div>
            <label className="mb-2 block text-xs font-semibold text-[#687286]">
              Projekt neve
            </label>
            <input
              className="w-full rounded-xl border bg-white p-3"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-[#687286]">
              Leírás
            </label>
            <textarea
              rows={3}
              className="w-full rounded-xl border bg-white p-3"
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-semibold text-[#687286]">
                Státusz
              </label>
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
              <label className="mb-2 block text-xs font-semibold text-[#687286]">
                Prioritás
              </label>
              <select
                className="w-full rounded-xl border bg-white p-3"
                value={priority}
                onChange={(event) =>
                  setPriority(event.target.value)
                }
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
              <label className="mb-2 block text-xs font-semibold text-[#687286]">
                Kezdés
              </label>
              <input
                type="date"
                className="w-full rounded-xl border bg-white p-3"
                value={startDate}
                onChange={(event) =>
                  setStartDate(event.target.value)
                }
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold text-[#687286]">
                Határidő
              </label>
              <input
                type="date"
                className="w-full rounded-xl border bg-white p-3"
                value={dueDate}
                onChange={(event) =>
                  setDueDate(event.target.value)
                }
              />
            </div>
          </div>

          <div>
            <button
              type="button"
              disabled={busy || !name.trim()}
              onClick={save}
              className="pf-button-primary disabled:opacity-50"
            >
              {busy ? "Mentés…" : "Változások mentése"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
