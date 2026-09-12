"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";

export function ProjectListActions({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (
      !window.confirm(
        `Biztosan törlöd a(z) „${projectName}” projektet? ` +
          "A projekt feladatai, mérföldkövei, kommentjei és aktivitásai is törlődnek.",
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

    router.refresh();
  }

  return (
    <div className="mt-4 border-t border-[#edf0f5] pt-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => router.push(`/projects/${projectId}`)}
          className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-[#566074]"
        >
          Megnyitás / szerkesztés
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={remove}
          className="rounded-lg border border-[#efc9cf] bg-[#fff7f8] px-3 py-1.5 text-xs font-semibold text-[#b33d50] disabled:opacity-50"
        >
          {busy ? "Törlés…" : "Törlés"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-[#b33d50]">{error}</p>}
    </div>
  );
}
