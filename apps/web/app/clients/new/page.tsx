"use client";
import { apiFetch } from "@/lib/api/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function NewClientPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { apiFetch("/api/access").then(r => r.json()).then(a => setAllowed(Boolean(a.canCreateClient))).catch(() => setAllowed(false)); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (!name.trim()) return setError("Az ügyfél neve kötelező.");
    try {
      setBusy(true);
      const r = await apiFetch("/api/clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const x = await r.json();
      if (!r.ok) throw new Error(x.error || x.details);
      router.push(`/clients/${x.id}`); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Hiba történt."); }
    finally { setBusy(false); }
  }

  if (allowed === null) return <div className="pf-page"><div className="pf-card p-6 text-sm text-[#778195]">Betöltés…</div></div>;
  if (!allowed) return <div className="pf-page"><div className="pf-card max-w-2xl p-6"><p className="pf-eyebrow">Hozzáférés</p><h1 className="text-2xl font-bold text-[#232b3e]">Nincs jogosultságod</h1><p className="mt-2 text-sm leading-6 text-[#748094]">Új ügyfelet csak a szervezet tulajdonosa vagy adminisztrátora hozhat létre.</p></div></div>;

  return <div className="pf-page">
    <div className="mx-auto max-w-2xl">
      <div className="pf-page-header"><div><p className="pf-eyebrow">Új kapcsolat</p><h1 className="pf-title">Új ügyfél</h1><p className="pf-subtitle">Add meg az ügyfél nevét. A kapcsolattartókat és projekteket később is hozzáadhatod.</p></div></div>
      <div className="pf-card p-5 sm:p-7">
        <form onSubmit={submit} className="space-y-5">
          <label className="block text-sm font-semibold text-[#465065]">Ügyfél neve<input className="mt-2 w-full rounded-xl border px-3.5 py-3" value={name} onChange={e => setName(e.target.value)} placeholder="Pl. Acme Kft." autoFocus /></label>
          {error ? <div className="rounded-xl border border-[#f1cdd3] bg-[#fff2f4] p-3.5 text-sm text-[#b33d50]">{error}</div> : null}
          <div className="flex flex-wrap gap-3 border-t border-[#edf0f5] pt-5"><button disabled={busy} className="pf-button-primary disabled:opacity-50">{busy ? "Mentés…" : "Ügyfél létrehozása"}</button><button type="button" onClick={() => router.back()} className="pf-button-secondary">Mégse</button></div>
        </form>
      </div>
    </div>
  </div>;
}
