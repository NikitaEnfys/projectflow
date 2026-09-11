import Link from "next/link";
import { serverApi } from "@/lib/api/server";

export default async function ClientsPage() {
  const clients = await serverApi<any[]>("/api/clients");
  return <main>
    <div className="mb-6"><h1 className="text-3xl font-bold">Ügyfelek</h1><p className="mt-2 text-sm text-gray-600">Ügyfélcégek, kapcsolattartók és kapcsolódó projektek.</p></div>
    {clients.length === 0 ? <div className="rounded-xl border p-6"><p>Nincs számodra elérhető ügyfél.</p></div> : <div className="grid gap-4">{clients.map((client) => <Link key={client.id} href={`/clients/${client.id}`} className="block rounded-xl border p-5 shadow-sm transition hover:bg-gray-50"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">{client.name}</h2><p className="mt-1 text-sm text-gray-600">{client._count.projects} projekt</p></div><span className="rounded-full border px-3 py-1 text-xs">{client.contacts.length} kapcsolattartó</span></div>{client.contacts.length > 0 && <div className="mt-4 border-t pt-3"><p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Kapcsolattartók</p>{client.contacts.slice(0,3).map((contact:any) => <p key={contact.id} className="text-sm text-gray-600">{contact.name} · {contact.email}</p>)}</div>}</Link>)}</div>}
  </main>;
}
