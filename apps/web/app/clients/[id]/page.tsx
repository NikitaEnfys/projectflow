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

type AccessResponse = {
  canManageClients: boolean;
};

type ClientContact = {
  id: string;
  name: string;
  email: string;
  position: string | null;
  userId: string | null;
};

type ClientProject = {
  id: string;
  name: string;
  description: string | null;
  owner: {
    id: string;
    name: string;
    email: string;
  } | null;
};

type ClientDetails = {
  id: string;
  name: string;
  contacts: ClientContact[];
  projects: ClientProject[];
};

export default async function ClientDetailsPage({
  params,
}: ClientPageProps) {
  const { id } = await params;

  let client: ClientDetails;
  let access: AccessResponse;

  try {
    [client, access] = await Promise.all([
      serverApi<ClientDetails>(`/api/clients/${id}`),
      serverApi<AccessResponse>("/api/access"),
    ]);
  } catch (error) {
    if (
      error instanceof ApiResponseError &&
      error.status === 403
    ) {
      redirect("/dashboard");
    }

    throw error;
  }

  const canManageClients = Boolean(
    access.canManageClients,
  );

  return (
    <div className="pf-page">
      <div className="pf-page-header">
        <div>
          <p className="pf-eyebrow">Ügyfél</p>
          <h1 className="pf-title">
            {client.name}
          </h1>
          <p className="pf-subtitle">
            {canManageClients
              ? "Ügyféladatok, kapcsolattartók és projektek kezelése."
              : "Ügyféladatok, kapcsolattartók és kapcsolódó projektek."}
          </p>
        </div>

        <span className="pf-chip">
          {client.projects.length} projekt
        </span>
      </div>

      {canManageClients ? (
        <ClientCrudManager
          clientId={client.id}
          initialName={client.name}
          initialContacts={client.contacts.map(
            (contact) => ({
              id: contact.id,
              name: contact.name,
              email: contact.email,
              position:
                contact.position ?? null,
              userId: contact.userId ?? null,
            }),
          )}
        />
      ) : (
        <section className="pf-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-[#30384b]">
              Kapcsolattartók
            </h2>
            <span className="pf-chip">
              {client.contacts.length} fő
            </span>
          </div>

          {client.contacts.length === 0 ? (
            <div className="mt-4 pf-empty py-5 text-sm">
              Még nincs kapcsolattartó.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {client.contacts.map(
                (contact) => (
                  <div
                    key={contact.id}
                    className="rounded-xl border border-[#e9ecf2] bg-[#fbfcff] p-4"
                  >
                    <p className="font-semibold text-[#444d60]">
                      {contact.name}
                    </p>
                    <p className="mt-1 text-sm text-[#778195]">
                      {contact.email}
                      {contact.position
                        ? ` · ${contact.position}`
                        : ""}
                    </p>
                  </div>
                ),
              )}
            </div>
          )}
        </section>
      )}

      <section className="mt-7">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-[#293145]">
            Kapcsolódó projektek
          </h2>

          {canManageClients && (
            <p className="mt-1 text-xs text-[#8d96a7]">
              Az ügyfél törlése előtt a hozzá tartozó
              projekteket törölni kell.
            </p>
          )}
        </div>

        {client.projects.length === 0 ? (
          <div className="pf-empty">
            Ehhez az ügyfélhez még nincs projekt.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {client.projects.map((project) => (
              <Link
                href={`/projects/${project.id}`}
                key={project.id}
                className="pf-card pf-card-hover p-5"
              >
                <h3 className="text-base font-bold text-[#30384b]">
                  {project.name}
                </h3>

                <p className="mt-2 line-clamp-2 text-sm leading-5 text-[#758093]">
                  {project.description ||
                    "Nincs leírás."}
                </p>

                <p className="mt-4 text-xs text-[#8e97a8]">
                  Felelős:{" "}
                  <span className="font-semibold text-[#5b6477]">
                    {project.owner?.name ||
                      "Nincs felelős"}
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
