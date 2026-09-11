"use client";
import { apiFetch } from "@/lib/api/client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function InvitationAccept({ token }: { token: string }) {
  const router = useRouter(); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function accept() { setBusy(true); setError(""); const r = await apiFetch(`/api/invitations/${token}/accept`, { method: "POST" }); if (!r.ok) { const d = await r.json().catch(() => null); setError(d?.error || "Nem sikerült elfogadni a meghívást."); setBusy(false); return; } router.replace("/dashboard"); router.refresh(); }
  return <div className="mt-6">{error && <p className="mb-3 rounded-lg border border-red-500/50 p-3 text-sm text-red-300">{error}</p>}<button onClick={accept} disabled={busy} className="rounded-lg bg-white px-5 py-3 font-medium text-black disabled:opacity-50">{busy ? "Elfogadás…" : "Meghívás elfogadása"}</button></div>;
}
