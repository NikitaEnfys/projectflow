"use client";
import { apiFetch } from "@/lib/api/client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function InvitationAccept({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function accept() {
    setBusy(true); setError("");
    const r = await apiFetch(`/api/invitations/${token}/accept`, { method: "POST" });
    if (!r.ok) { const d = await r.json().catch(() => null); setError(d?.error || "Nem sikerült elfogadni a meghívást."); setBusy(false); return; }
    router.replace("/dashboard"); router.refresh();
  }
  return <div className="mt-6">{error && <p className="mb-3 rounded-xl border border-[#f1cdd3] bg-[#fff2f4] p-3.5 text-sm text-[#b33d50]">{error}</p>}<button onClick={accept} disabled={busy} className="pf-button-primary disabled:opacity-50">{busy ? "Elfogadás…" : "Meghívás elfogadása"}</button></div>;
}
