import Link from "next/link";
import { redirect } from "next/navigation";
import { ApiResponseError, serverApi } from "@/lib/api/server";

type ClientPageProps = { params: Promise<{ id: string }> };

export default async function ClientDetailsPage({ params }: ClientPageProps) {
  const { id } = await params;
  let client: any;
  try { client = await serverApi<any>(`/api/clients/${id}`); }
  catch (error) { if (error instanceof ApiResponseError && error.status === 403) redirect("/dashboard"); throw error; }

  return <div className="pf-page">
    <div className="pf-page-header">
      <div><p className="pf-eyebrow">Ügyfél</p><h1 className="pf-title">{client.name}</h1><p className="pf-subtitle">Kapcsolattartók és az ügyfélhez tartozó projektek.</p></div>
      <span className="pf-chip">{client.projects.length} projekt</span>
    </div>

    <div className="mb-7 grid gap-4 lg:grid-cols-[.85fr_1.15fr]">
      <section className="pf-card p-5 sm:p-6">
        <h2 className="text-base font-bold text-[#30384b]">Alapadatok</h2>
        <div className="mt-5 grid gap-5 text-sm">
          <div><p className="text-xs font-medium text-[#99a2b2]">Ügyfél azonosító</p><p className="mt-1.5 break-all font-medium text-[#566074]">{client.id}</p></div>
          <div><p className="text-xs font-medium text-[#99a2b2]">Létrehozva</p><p className="mt-1.5 font-medium text-[#566074]">{new Date(client.createdAt).toLocaleString("hu-HU")}</p></div>
        </div>
      </section>

      <section className="pf-card p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3"><h2 className="text-base font-bold text-[#30384b]">Kapcsolattartók</h2><span className="pf-chip">{client.contacts.length} fő</span></div>
        {client.contacts.length === 0 ? <div className="mt-4 pf-empty py-5 text-sm">Még nincs kapcsolattartó.</div> : <div className="mt-4 grid gap-2.5 sm:grid-cols-2">{client.contacts.map((contact:any) => <div key={contact.id} className="rounded-xl border border-[#e9ecf2] bg-[#fbfcff] p-3.5"><p className="text-sm font-semibold text-[#444d60]">{contact.name}</p><p className="mt-1 truncate text-xs text-[#778195]">{contact.email}</p><p className="mt-2 text-[10px] font-medium text-[#9ca4b3]">ProjectFlow fiók: {contact.userId ? "igen" : "nem"}</p></div>)}</div>}
      </section>
    </div>

    <section>
      <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-bold text-[#293145]">Kapcsolódó projektek</h2><p className="mt-1 text-xs text-[#8d96a7]">Az ügyfélhez rendelt aktív és korábbi munkák.</p></div></div>
      {client.projects.length === 0 ? <div className="pf-empty">Ehhez az ügyfélhez még nincs projekt.</div> : <div className="grid gap-4 lg:grid-cols-2">{client.projects.map((project:any) => <Link href={`/projects/${project.id}`} key={project.id} className="pf-card pf-card-hover p-5"><div className="flex items-start justify-between gap-4"><div><h3 className="text-base font-bold text-[#30384b]">{project.name}</h3><p className="mt-2 line-clamp-2 text-sm leading-5 text-[#758093]">{project.description || "Nincs leírás."}</p><p className="mt-4 text-xs text-[#8e97a8]">Felelős: <span className="font-semibold text-[#5b6477]">{project.owner?.name || "Nincs felelős"}</span></p></div><span className="text-[#aab1be]">→</span></div></Link>)}</div>}
    </section>
  </div>;
}
