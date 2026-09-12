import Link from "next/link";
import { serverApi } from "@/lib/api/server";
import { ClientListActions } from "@/components/client-list-actions";

export default async function ClientsPage() {
  const clients = await serverApi<any[]>("/api/clients");

  return (
    <div className="pf-page">
      <div className="pf-page-header">
        <div>
          <p className="pf-eyebrow">Kapcsolatok</p>
          <h1 className="pf-title">Ügyfélcégek</h1>
          <p className="pf-subtitle">
            Ügyfélcégek, kapcsolattartók és a hozzájuk tartozó projektek.
          </p>
        </div>
        <Link href="/clients/new" className="pf-button-primary">
          <span className="text-lg leading-none">+</span> Új ügyfélcég
        </Link>
      </div>

      {clients.length === 0 ? (
        <div className="pf-empty">
          <p className="font-semibold text-[#424b5e]">Még nincs elérhető ügyfélcég.</p>
          <p className="mt-1 text-sm">Hozd létre az első ügyfélcéget.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {clients.map((client) => (
            <article key={client.id} className="pf-card p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3.5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eaf8f3] text-sm font-bold text-[#238764]">
                    {client.name?.slice(0, 1)?.toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <Link
                      href={`/clients/${client.id}`}
                      className="truncate text-lg font-bold tracking-[-0.02em] text-[#283044] hover:underline"
                    >
                      {client.name}
                    </Link>
                    <p className="mt-1 text-xs text-[#8d96a8]">
                      {client._count.projects} projekt · {client.contacts.length} kapcsolattartó
                    </p>
                  </div>
                </div>
                <span className="pf-chip">{client.contacts.length} fő</span>
              </div>

              <div className="mt-5 border-t border-[#edf0f5] pt-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#a0a8b7]">
                  Kapcsolattartók
                </p>
                {client.contacts.length === 0 ? (
                  <p className="text-sm text-[#9199a9]">Még nincs kapcsolattartó.</p>
                ) : (
                  <div className="space-y-1.5">
                    {client.contacts.slice(0, 3).map((contact: any) => (
                      <p key={contact.id} className="truncate text-sm text-[#667084]">
                        <span className="font-semibold text-[#4a5366]">{contact.name}</span>
                        {" · "}
                        {contact.email}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              <ClientListActions clientId={client.id} clientName={client.name} />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
