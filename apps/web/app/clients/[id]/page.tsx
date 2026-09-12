import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ApiResponseError,
  serverApi,
} from "@/lib/api/server";
import { ClientCrudManager } from "@/components/client-crud-manager";

type ClientPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ClientDetailsPage({
  params,
}: ClientPageProps) {
  const { id } = await params;

  let client: any;

  try {
    client = await serverApi<any>(`/api/clients/${id}`);
  } catch (error) {
    if (
      error instanceof ApiResponseError &&
      error.status === 403
    ) {
      redirect("/dashboard");
    }

    throw error;
  }

  return (
    <div className="pf-page">
      <div className="pf-page-header">
        <div>
          <p className="pf-eyebrow">Ügyfél</p>
          <h1 className="pf-title">{client.name}</h1>
          <p className="pf-subtitle">
            Ügyféladatok, kapcsolattartók és projektek kezelése.
          </p>
        </div>

        <span className="pf-chip">
          {client.projects.length} projekt
        </span>
      </div>

      <ClientCrudManager
        clientId={client.id}
        initialName={client.name}
        initialContacts={client.contacts.map((contact: any) => ({
          id: contact.id,
          name: contact.name,
          email: contact.email,
          position: contact.position ?? null,
          userId: contact.userId ?? null,
        }))}
      />

      <section className="mt-7">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-[#293145]">
            Kapcsolódó projektek
          </h2>
          <p className="mt-1 text-xs text-[#8d96a7]">
            Az ügyfél törlése előtt a hozzá tartozó projekteket
            törölni kell.
          </p>
        </div>

        {client.projects.length === 0 ? (
          <div className="pf-empty">
            Ehhez az ügyfélhez még nincs projekt.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {client.projects.map((project: any) => (
              <Link
                href={`/projects/${project.id}`}
                key={project.id}
                className="pf-card pf-card-hover p-5"
              >
                <h3 className="text-base font-bold text-[#30384b]">
                  {project.name}
                </h3>

                <p className="mt-2 line-clamp-2 text-sm leading-5 text-[#758093]">
                  {project.description || "Nincs leírás."}
                </p>

                <p className="mt-4 text-xs text-[#8e97a8]">
                  Felelős:{" "}
                  <span className="font-semibold text-[#5b6477]">
                    {project.owner?.name || "Nincs felelős"}
                  </span>
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
