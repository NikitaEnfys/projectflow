"use client";
import { apiFetch } from "@/lib/api/client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type UserRef = { id: string; name: string; email: string };
type MemberRef = UserRef & { role: string };
type MilestoneRef = { id: string; name: string };
type Comment = { id: string; content: string; visibility: string; createdAt: string; authorId: string; author: UserRef };
type Task = {
  id: string; title: string; description: string | null; status: string; priority: string; dueDate: string | null;
  clientVisible: boolean; assigneeId: string | null; creatorId: string; milestoneId: string | null;
  assignee: UserRef | null; creator: UserRef; milestone: MilestoneRef | null; comments: Comment[];
};

type Props = {
  projectId: string;
  tasks: Task[];
  members: MemberRef[];
  milestones: MilestoneRef[];
  canManage: boolean;
  clientViewer: boolean;
  currentUserId: string;
};

const COLUMNS = [
  ["TODO", "Teendő"], ["IN_PROGRESS", "Folyamatban"], ["REVIEW", "Ellenőrzés"], ["BLOCKED", "Blokkolt"], ["DONE", "Kész"],
] as const;
const PRIORITY_LABELS: Record<string, string> = { LOW: "Alacsony", MEDIUM: "Közepes", HIGH: "Magas", URGENT: "Sürgős" };
const ROLE_LABELS: Record<string, string> = { PROJECT_MANAGER: "Projektvezető", MEMBER: "Belső munkatárs", CONTRACTOR: "Alvállalkozó" };

function dateValue(v: string | null) { return v ? new Date(v).toISOString().slice(0, 10) : ""; }

export function TaskKanban({ projectId, tasks, members, milestones, canManage, clientViewer, currentUserId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", priority: "MEDIUM", dueDate: "", assigneeId: "", milestoneId: "", clientVisible: false });
  const [edit, setEdit] = useState({ title: "", description: "", status: "TODO", priority: "MEDIUM", dueDate: "", assigneeId: "", milestoneId: "", clientVisible: false });
  const [comment, setComment] = useState("");
  const [commentVisibility, setCommentVisibility] = useState("INTERNAL");

  const selected = tasks.find(t => t.id === selectedTaskId) ?? null;
  const byStatus = useMemo(() => Object.fromEntries(COLUMNS.map(([s]) => [s, tasks.filter(t => t.status === s)])), [tasks]);

  async function api(url: string, init: RequestInit) {
    const r = await apiFetch(url, init);
    if (!r.ok) { const d = await r.json().catch(() => null); throw new Error(d?.error || d?.details || "A művelet nem sikerült."); }
    return r;
  }

  async function createTask(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      await api(`/api/projects/${projectId}/tasks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      setForm({ title: "", description: "", priority: "MEDIUM", dueDate: "", assigneeId: "", milestoneId: "", clientVisible: false });
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Hiba történt."); } finally { setBusy(false); }
  }

  function openTask(t: Task) {
    setSelectedTaskId(t.id);
    setEdit({ title: t.title, description: t.description || "", status: t.status, priority: t.priority, dueDate: dateValue(t.dueDate), assigneeId: t.assigneeId || "", milestoneId: t.milestoneId || "", clientVisible: t.clientVisible });
    setComment(""); setCommentVisibility("INTERNAL"); setError("");
  }

  async function saveEdit() {
    if (!selected) return; setBusy(true); setError("");
    try {
      await api(`/api/projects/${projectId}/tasks/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(edit) });
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Hiba történt."); } finally { setBusy(false); }
  }

  async function moveTask(task: Task, status: string) {
    if (task.status === status || (!canManage && task.assigneeId !== currentUserId)) return;
    setBusy(true); setError("");
    try {
      await api(`/api/projects/${projectId}/tasks/${task.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Hiba történt."); } finally { setBusy(false); }
  }

  async function removeTask(task: Task) {
    if (!confirm(`Biztosan törlöd a(z) „${task.title}” feladatot?`)) return;
    setBusy(true); setError("");
    try { await api(`/api/projects/${projectId}/tasks/${task.id}`, { method: "DELETE" }); setSelectedTaskId(null); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Hiba történt."); } finally { setBusy(false); }
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !comment.trim()) return;
    setBusy(true); setError("");
    try {
      await api(`/api/projects/${projectId}/tasks/${selected.id}/comments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: comment, visibility: clientViewer ? "CLIENT_VISIBLE" : commentVisibility }),
      });
      setComment(""); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Hiba történt."); } finally { setBusy(false); }
  }

  async function deleteComment(commentId: string) {
    if (!selected || !confirm("Biztosan törlöd ezt a kommentet?")) return;
    setBusy(true); setError("");
    try { await api(`/api/projects/${projectId}/tasks/${selected.id}/comments/${commentId}`, { method: "DELETE" }); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Hiba történt."); } finally { setBusy(false); }
  }

  return <section className="pf-card mb-7 p-5 sm:p-6">
    <div className="mb-5"><h2 className="text-2xl font-semibold">Feladatok és Kanban</h2><p className="mt-1 text-sm text-gray-600">A feladatok állapota, felelősei, kommentjei és határidői egy helyen.</p></div>
    {error && <p className="mb-4 rounded-lg border border-red-500/40 bg-[#fff2f4] p-3 text-sm text-[#b33d50]">{error}</p>}

    {canManage && <form onSubmit={createTask} className="mb-7 grid gap-3 rounded-xl border border-[#e8ebf1] bg-[#fbfcff] p-4 md:grid-cols-2 xl:grid-cols-4">
      <input className="rounded-xl border bg-white p-3 xl:col-span-2" placeholder="Feladat címe" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/>
      <select className="rounded-xl border bg-white p-3" value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}><option value="LOW">Alacsony</option><option value="MEDIUM">Közepes</option><option value="HIGH">Magas</option><option value="URGENT">Sürgős</option></select>
      <input type="date" className="rounded-xl border bg-white p-3" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}/>
      <textarea className="rounded-xl border bg-white p-3 md:col-span-2" rows={2} placeholder="Leírás" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>
      <select className="rounded-xl border bg-white p-3" value={form.assigneeId} onChange={e=>setForm({...form,assigneeId:e.target.value})}>
        <option value="">Nincs felelős</option>{members.map(m=><option key={m.id} value={m.id}>{m.name} · {ROLE_LABELS[m.role] ?? m.role}</option>)}
      </select>
      <select className="rounded-xl border bg-white p-3" value={form.milestoneId} onChange={e=>setForm({...form,milestoneId:e.target.value})}><option value="">Nincs mérföldkő</option>{milestones.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.clientVisible} onChange={e=>setForm({...form,clientVisible:e.target.checked})}/> Ügyfél számára látható</label>
      <button disabled={busy || !form.title.trim()} className="rounded-lg bg-[#5b67f1] px-4 py-2 font-medium text-white disabled:opacity-50">+ Feladat</button>
    </form>}

    <div className="grid gap-4 xl:grid-cols-5">
      {COLUMNS.map(([status,label]) => <div key={status} className="min-w-0 rounded-lg border bg-[#f8f9fc] p-3" onDragOver={e=>e.preventDefault()} onDrop={e=>{const id=e.dataTransfer.getData("text/task-id"); const t=tasks.find(x=>x.id===id); if(t) moveTask(t,status);}}>
        <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">{label}</h3><span className="rounded-full border px-2 py-0.5 text-xs">{byStatus[status]?.length || 0}</span></div>
        <div className="grid gap-3">{byStatus[status]?.map(task => {
          const movable = canManage || task.assigneeId === currentUserId;
          return <article key={task.id} draggable={movable && !busy} onDragStart={e=>e.dataTransfer.setData("text/task-id",task.id)} className="rounded-lg border bg-white p-3">
            <div className="flex items-start justify-between gap-2"><button className="text-left font-medium hover:underline" onClick={()=>openTask(task)}>{task.title}</button><span className="text-[10px] uppercase text-gray-500">{PRIORITY_LABELS[task.priority]}</span></div>
            {task.description && <p className="mt-2 line-clamp-3 text-xs text-gray-600">{task.description}</p>}
            <div className="mt-3 grid gap-1 text-xs text-gray-500"><span>Felelős: {task.assignee?.name || "nincs"}</span><span>Mérföldkő: {task.milestone?.name || "nincs"}</span><span>Határidő: {task.dueDate ? new Date(task.dueDate).toLocaleDateString("hu-HU") : "nincs"}</span><span>Kommentek: {task.comments.length}</span>{task.clientVisible && <span>Ügyfélnek látható</span>}</div>
            {movable && <select disabled={busy} className="mt-3 w-full rounded-lg border bg-white p-2 text-xs" value={task.status} onChange={e=>moveTask(task,e.target.value)}>{COLUMNS.map(([s,l])=><option key={s} value={s}>{l}</option>)}</select>}
          </article>})}</div>
      </div>)}
    </div>

    {selected && <div className="mt-6 rounded-xl border p-5">
      <div className="mb-4 flex items-center justify-between"><div><h3 className="text-xl font-semibold">{selected.title}</h3><p className="mt-1 text-xs text-gray-500">Létrehozta: {selected.creator.name}</p></div><button onClick={()=>setSelectedTaskId(null)} className="text-sm">Bezárás</button></div>
      {canManage ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <input className="rounded-xl border bg-white p-3 xl:col-span-2" value={edit.title} onChange={e=>setEdit({...edit,title:e.target.value})}/>
        <select className="rounded-xl border bg-white p-3" value={edit.status} onChange={e=>setEdit({...edit,status:e.target.value})}>{COLUMNS.map(([s,l])=><option key={s} value={s}>{l}</option>)}</select>
        <select className="rounded-xl border bg-white p-3" value={edit.priority} onChange={e=>setEdit({...edit,priority:e.target.value})}><option value="LOW">Alacsony</option><option value="MEDIUM">Közepes</option><option value="HIGH">Magas</option><option value="URGENT">Sürgős</option></select>
        <textarea className="rounded-xl border bg-white p-3 md:col-span-2" rows={3} value={edit.description} onChange={e=>setEdit({...edit,description:e.target.value})}/>
        <input type="date" className="rounded-xl border bg-white p-3" value={edit.dueDate} onChange={e=>setEdit({...edit,dueDate:e.target.value})}/>
        <select className="rounded-xl border bg-white p-3" value={edit.assigneeId} onChange={e=>setEdit({...edit,assigneeId:e.target.value})}><option value="">Nincs felelős</option>{members.map(m=><option key={m.id} value={m.id}>{m.name} · {ROLE_LABELS[m.role] ?? m.role}</option>)}</select>
        <select className="rounded-xl border bg-white p-3" value={edit.milestoneId} onChange={e=>setEdit({...edit,milestoneId:e.target.value})}><option value="">Nincs mérföldkő</option>{milestones.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.clientVisible} onChange={e=>setEdit({...edit,clientVisible:e.target.checked})}/> Ügyfél számára látható</label>
        <div className="flex gap-2"><button disabled={busy || !edit.title.trim()} onClick={saveEdit} className="rounded-lg bg-[#5b67f1] px-4 py-2 text-white disabled:opacity-50">Mentés</button><button disabled={busy} onClick={()=>removeTask(selected)} className="rounded-lg border px-4 py-2">Törlés</button></div>
      </div> : <div className="grid gap-2 text-sm"><p>{selected.description || "Nincs leírás."}</p><p className="text-gray-500">Felelős: {selected.assignee?.name || "nincs"}</p><p className="text-gray-500">Határidő: {selected.dueDate ? new Date(selected.dueDate).toLocaleDateString("hu-HU") : "nincs"}</p></div>}

      <div className="mt-6 border-t border-[#edf0f5] pt-5">
        <h4 className="font-semibold">Kommentek</h4>
        <div className="mt-3 grid gap-3">
          {selected.comments.length === 0 ? <p className="text-sm text-gray-500">Még nincs komment.</p> : selected.comments.map(c => <article key={c.id} className="rounded-xl border border-[#e8ebf1] bg-white p-3.5">
            <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{c.author.name}</p><p className="mt-1 whitespace-pre-wrap text-sm text-gray-700 text-gray-700">{c.content}</p></div>{(canManage || c.authorId === currentUserId) && <button disabled={busy} onClick={()=>deleteComment(c.id)} className="text-xs text-gray-500 hover:underline">Törlés</button>}</div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500"><span>{new Date(c.createdAt).toLocaleString("hu-HU")}</span><span>{c.visibility === "CLIENT_VISIBLE" ? "Ügyfélnek látható" : "Belső"}</span></div>
          </article>)}
        </div>
        <form onSubmit={addComment} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <textarea rows={2} maxLength={5000} className="rounded-xl border bg-white p-3" placeholder="Új komment…" value={comment} onChange={e=>setComment(e.target.value)}/>
          {!clientViewer && <select className="rounded-xl border bg-white p-3" value={commentVisibility} onChange={e=>setCommentVisibility(e.target.value)}><option value="INTERNAL">Belső</option>{selected.clientVisible && <option value="CLIENT_VISIBLE">Ügyfélnek látható</option>}</select>}
          <button disabled={busy || !comment.trim()} className="rounded-lg bg-[#5b67f1] px-4 py-2 text-white disabled:opacity-50">Komment</button>
        </form>
      </div>
    </div>}
  </section>;
}
