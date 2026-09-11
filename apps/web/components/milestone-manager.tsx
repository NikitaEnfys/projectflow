"use client";
import { apiFetch } from "@/lib/api/client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Milestone = { id: string; name: string; description: string | null; status: string; dueDate: Date | string | null };
const STATUS_LABELS: Record<string,string> = { PLANNED: "Tervezett", IN_PROGRESS: "Folyamatban", COMPLETED: "Kész" };

function dateInputValue(value: Date | string | null) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function MilestoneManager({ projectId, initialMilestones, canManage }: { projectId: string; initialMilestones: Milestone[]; canManage: boolean }) {
  const router = useRouter();
  const [name,setName]=useState("");
  const [description,setDescription]=useState("");
  const [dueDate,setDueDate]=useState("");
  const [status,setStatus]=useState("PLANNED");
  const [editingId,setEditingId]=useState<string|null>(null);
  const [editName,setEditName]=useState("");
  const [editDescription,setEditDescription]=useState("");
  const [editDueDate,setEditDueDate]=useState("");
  const [editStatus,setEditStatus]=useState("PLANNED");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  async function readError(response: Response) {
    const data = await response.json().catch(() => null);
    return data?.error || data?.details || "A művelet nem sikerült.";
  }

  async function submit(e:React.FormEvent){
    e.preventDefault(); setError("");
    try{
      setBusy(true);
      const r=await apiFetch(`/api/projects/${projectId}/milestones`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,description,dueDate,status})});
      if(!r.ok) throw new Error(await readError(r));
      setName("");setDescription("");setDueDate("");setStatus("PLANNED");router.refresh();
    }catch(err){setError(err instanceof Error?err.message:"Hiba történt.");}finally{setBusy(false);}
  }

  function beginEdit(m: Milestone) {
    setEditingId(m.id); setEditName(m.name); setEditDescription(m.description ?? ""); setEditDueDate(dateInputValue(m.dueDate)); setEditStatus(m.status); setError("");
  }

  async function saveEdit() {
    if (!editingId) return;
    setBusy(true); setError("");
    try {
      const r = await apiFetch(`/api/projects/${projectId}/milestones/${editingId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, description: editDescription, dueDate: editDueDate, status: editStatus }),
      });
      if (!r.ok) throw new Error(await readError(r));
      setEditingId(null); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Hiba történt."); }
    finally { setBusy(false); }
  }

  async function remove(id: string, title: string) {
    if (!window.confirm(`Biztosan törlöd a(z) „${title}” mérföldkövet?`)) return;
    setBusy(true); setError("");
    try {
      const r = await apiFetch(`/api/projects/${projectId}/milestones/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(await readError(r));
      if (editingId === id) setEditingId(null);
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Hiba történt."); }
    finally { setBusy(false); }
  }

  return <section className="mb-8 rounded-xl border p-6">
    <div className="mb-5"><h2 className="text-2xl font-semibold">Mérföldkövek</h2><p className="mt-1 text-sm text-gray-600">A projekt fő fázisai és üzleti határpontjai.</p></div>
    {error && <p className="mb-4 rounded-lg border border-red-500/40 bg-red-950/20 p-3 text-sm text-red-300">{error}</p>}
    {canManage ? <form onSubmit={submit} className="mb-6 grid gap-3 rounded-lg border p-4 md:grid-cols-2"><input className="rounded-lg border bg-transparent p-3" placeholder="Mérföldkő neve" value={name} onChange={e=>setName(e.target.value)} /><input type="date" className="rounded-lg border bg-transparent p-3" value={dueDate} onChange={e=>setDueDate(e.target.value)} /><textarea className="rounded-lg border bg-transparent p-3 md:col-span-2" placeholder="Leírás" value={description} onChange={e=>setDescription(e.target.value)} rows={2}/><select className="rounded-lg border bg-transparent p-3" value={status} onChange={e=>setStatus(e.target.value)}><option value="PLANNED">Tervezett</option><option value="IN_PROGRESS">Folyamatban</option><option value="COMPLETED">Kész</option></select><button disabled={busy||!name.trim()} className="rounded-lg bg-white px-4 py-2 font-medium text-black disabled:opacity-50">{busy?"Mentés...":"+ Mérföldkő"}</button></form> : null}
    {initialMilestones.length===0 ? <div className="rounded-lg border p-4 text-sm text-gray-600">Még nincs mérföldkő.</div> : <div className="grid gap-3">{initialMilestones.map(m => editingId === m.id ? <div key={m.id} className="grid gap-3 rounded-lg border p-4 md:grid-cols-2"><input className="rounded-lg border bg-transparent p-3" value={editName} onChange={e=>setEditName(e.target.value)} /><input type="date" className="rounded-lg border bg-transparent p-3" value={editDueDate} onChange={e=>setEditDueDate(e.target.value)} /><textarea className="rounded-lg border bg-transparent p-3 md:col-span-2" value={editDescription} onChange={e=>setEditDescription(e.target.value)} rows={2}/><select className="rounded-lg border bg-transparent p-3" value={editStatus} onChange={e=>setEditStatus(e.target.value)}><option value="PLANNED">Tervezett</option><option value="IN_PROGRESS">Folyamatban</option><option value="COMPLETED">Kész</option></select><div className="flex gap-2"><button type="button" disabled={busy || !editName.trim()} onClick={saveEdit} className="rounded-lg bg-white px-4 py-2 text-black disabled:opacity-50">Mentés</button><button type="button" disabled={busy} onClick={()=>setEditingId(null)} className="rounded-lg border px-4 py-2">Mégse</button></div></div> : <div key={m.id} className="rounded-lg border p-4"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-semibold">{m.name}</p><p className="mt-1 text-sm text-gray-600">{m.description||"Nincs leírás."}</p></div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border px-3 py-1 text-xs">{STATUS_LABELS[m.status]||m.status}</span>{canManage && <><button type="button" onClick={()=>beginEdit(m)} className="rounded-lg border px-3 py-1 text-xs">Szerkesztés</button><button type="button" disabled={busy} onClick={()=>remove(m.id,m.name)} className="rounded-lg border px-3 py-1 text-xs disabled:opacity-50">Törlés</button></>}</div></div><p className="mt-3 text-xs text-gray-500">Határidő: {m.dueDate ? new Date(m.dueDate).toLocaleDateString("hu-HU") : "nincs megadva"}</p></div>)}</div>}
  </section>;
}
