"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
export default function NewClientPage() {
  const router = useRouter(); const [name,setName]=useState(""); const [allowed,setAllowed]=useState<boolean|null>(null); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  useEffect(()=>{ fetch("/api/access").then(r=>r.json()).then(a=>setAllowed(Boolean(a.canCreateClient))).catch(()=>setAllowed(false)); },[]);
  async function submit(e:React.FormEvent){ e.preventDefault(); setError(""); if(!name.trim()) return setError("Az ügyfél neve kötelező."); try{setBusy(true); const r=await fetch("/api/clients",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name})}); const x=await r.json(); if(!r.ok) throw new Error(x.error||x.details); router.push(`/clients/${x.id}`); router.refresh();}catch(err){setError(err instanceof Error?err.message:"Hiba történt.");}finally{setBusy(false);} }
  if(allowed===null) return <main><p>Betöltés...</p></main>;
  if(!allowed) return <main><div className="rounded-xl border p-6"><h1 className="text-2xl font-bold">Nincs jogosultságod</h1><p className="mt-2 text-sm text-gray-600">Új ügyfelet csak a szervezet tulajdonosa vagy adminisztrátora hozhat létre.</p></div></main>;
  return <main><div className="mx-auto max-w-2xl"><h1 className="mb-6 text-3xl font-bold">Új ügyfél létrehozása</h1><div className="rounded-xl border p-6"><form onSubmit={submit} className="space-y-4"><div><label className="mb-2 block text-sm font-medium">Ügyfél neve</label><input className="w-full rounded-lg border bg-transparent p-3" value={name} onChange={e=>setName(e.target.value)} /></div>{error?<div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>:null}<button disabled={busy} className="rounded-lg bg-white px-4 py-2 font-medium text-black disabled:opacity-50">{busy?"Mentés...":"Ügyfél létrehozása"}</button></form></div></div></main>;
}
