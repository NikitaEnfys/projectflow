"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type User = { id: string; name: string; email: string };
type Client = { id: string; name: string };
type Access = { canCreateProject: boolean };

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [status, setStatus] = useState("PLANNING");
  const [priority, setPriority] = useState("MEDIUM");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadOptions() {
      try {
        const accessRes = await fetch("/api/access");
        const access: Access = await accessRes.json();
        setAllowed(Boolean(access.canCreateProject));
        if (!access.canCreateProject) return;
        const [clientsRes, usersRes] = await Promise.all([fetch("/api/clients"), fetch("/api/users")]);
        if (!clientsRes.ok || !usersRes.ok) throw new Error("Nem sikerült betölteni a választási lehetőségeket.");
        setClients(await clientsRes.json());
        setUsers(await usersRes.json());
      } catch (err) {
        console.error(err);
        setError("Nem sikerült betölteni az ügyfeleket és felhasználókat.");
      } finally {
        setIsLoadingOptions(false);
      }
    }
    loadOptions();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError("");
    if (!name.trim() || !clientId || !ownerId) { setError("A projekt neve, ügyfele és felelőse kötelező."); return; }
    if (startDate && dueDate && dueDate < startDate) { setError("A határidő nem lehet korábbi a kezdési dátumnál."); return; }
    try {
      setIsSubmitting(true);
      const response = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, description, clientId, ownerId, status, priority, startDate, dueDate }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || result.details || "Ismeretlen hiba");
      router.push(`/projects/${result.id}`); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Hiba történt a projekt létrehozásakor."); }
    finally { setIsSubmitting(false); }
  }

  if (isLoadingOptions) return <main><p>Betöltés...</p></main>;
  if (allowed === false) return <main><div className="rounded-xl border p-6"><h1 className="text-2xl font-bold">Nincs jogosultságod</h1><p className="mt-2 text-sm text-gray-600">Új projektet csak tulajdonos, adminisztrátor vagy projektvezető hozhat létre.</p></div></main>;

  return <main><div className="mx-auto max-w-3xl"><h1 className="mb-6 text-3xl font-bold">Új projekt létrehozása</h1><div className="rounded-xl border p-6 shadow-sm">
    <form onSubmit={handleSubmit} className="space-y-5">
      <div><label className="mb-2 block text-sm font-medium">Projekt neve</label><input className="w-full rounded-lg border bg-transparent p-3" value={name} onChange={(e)=>setName(e.target.value)} placeholder="Pl. Céges weboldal redesign" /></div>
      <div><label className="mb-2 block text-sm font-medium">Leírás</label><textarea className="w-full rounded-lg border bg-transparent p-3" value={description} onChange={(e)=>setDescription(e.target.value)} rows={4} /></div>
      <div className="grid gap-4 md:grid-cols-2">
        <div><label className="mb-2 block text-sm font-medium">Ügyfél</label><select className="w-full rounded-lg border bg-transparent p-3" value={clientId} onChange={(e)=>setClientId(e.target.value)}><option value="">Válassz ügyfelet</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label className="mb-2 block text-sm font-medium">Projektvezető</label><select className="w-full rounded-lg border bg-transparent p-3" value={ownerId} onChange={(e)=>setOwnerId(e.target.value)}><option value="">Válassz felelőst</option>{users.map(u=><option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}</select></div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div><label className="mb-2 block text-sm font-medium">Státusz</label><select className="w-full rounded-lg border bg-transparent p-3" value={status} onChange={(e)=>setStatus(e.target.value)}><option value="PLANNING">Tervezés</option><option value="ACTIVE">Aktív</option><option value="ON_HOLD">Szüneteltetve</option><option value="COMPLETED">Befejezett</option><option value="CANCELLED">Törölt</option></select></div>
        <div><label className="mb-2 block text-sm font-medium">Prioritás</label><select className="w-full rounded-lg border bg-transparent p-3" value={priority} onChange={(e)=>setPriority(e.target.value)}><option value="LOW">Alacsony</option><option value="MEDIUM">Közepes</option><option value="HIGH">Magas</option><option value="URGENT">Sürgős</option></select></div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div><label className="mb-2 block text-sm font-medium">Kezdési dátum</label><input type="date" className="w-full rounded-lg border bg-transparent p-3" value={startDate} onChange={(e)=>setStartDate(e.target.value)} /></div>
        <div><label className="mb-2 block text-sm font-medium">Határidő</label><input type="date" className="w-full rounded-lg border bg-transparent p-3" value={dueDate} onChange={(e)=>setDueDate(e.target.value)} /></div>
      </div>
      {error ? <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div> : null}
      <button disabled={isSubmitting} className="rounded-lg bg-white px-4 py-2 font-medium text-black disabled:opacity-50">{isSubmitting ? "Mentés..." : "Projekt létrehozása"}</button>
    </form>
  </div></div></main>;
}
