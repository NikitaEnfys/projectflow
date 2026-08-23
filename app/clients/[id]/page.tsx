import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { canViewClient } from "@/lib/permissions";
import { redirect } from "next/navigation";

type ClientPageProps = { params: Promise<{ id: string }> };

export default async function ClientDetailsPage({ params }: ClientPageProps) {
  const { id } = await params;
  const currentUser = await requireCurrentUser();
  if (!(await canViewClient(currentUser.id, id))) redirect("/dashboard");

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      contacts: { include: { user: true }, orderBy: { name: "asc" } },
      projects: { include: { owner: true }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!client) return <main><h1 className="text-2xl font-bold">Ügyfél nem található</h1><p className="mt-2 text-sm text-gray-600">A keresett ügyfél nem létezik.</p></main>;

  return <main>
    <div className="mb-6"><h1 className="text-3xl font-bold">{client.name}</h1><p className="mt-2 text-sm text-gray-600">Ügyfél részletes nézete.</p></div>
    <div className="mb-6 grid gap-6 lg:grid-cols-2">
      <section className="rounded-xl border p-6 shadow-sm"><h2 className="text-xl font-semibold">Alapadatok</h2><div className="mt-4 grid gap-4 text-sm"><div><p className="font-medium">Ügyfél azonosító</p><p className="break-all text-gray-700">{client.id}</p></div><div><p className="font-medium">Létrehozva</p><p className="text-gray-700">{new Date(client.createdAt).toLocaleString("hu-HU")}</p></div></div></section>
      <section className="rounded-xl border p-6 shadow-sm"><h2 className="text-xl font-semibold">Kapcsolattartók</h2>{client.contacts.length === 0 ? <p className="mt-4 text-sm text-gray-600">Még nincs kapcsolattartó.</p> : <div className="mt-4 space-y-3">{client.contacts.map((contact) => <div key={contact.id} className="rounded-lg border p-3"><p className="font-medium">{contact.name}</p><p className="text-sm text-gray-600">{contact.email}</p><p className="mt-1 text-xs text-gray-500">ProjectFlow fiók: {contact.userId ? "igen" : "nem"}</p></div>)}</div>}</section>
    </div>
    <section><h2 className="mb-4 text-2xl font-semibold">Kapcsolódó projektek</h2>{client.projects.length === 0 ? <div className="rounded-xl border p-6"><p>Ehhez az ügyfélhez még nincs projekt.</p></div> : <div className="grid gap-4">{client.projects.map((project) => <Link href={`/projects/${project.id}`} key={project.id} className="rounded-xl border p-5 shadow-sm"><h3 className="text-xl font-semibold">{project.name}</h3><p className="mt-2 text-sm text-gray-700">{project.description || "Nincs leírás."}</p><p className="mt-3 text-sm text-gray-600">Felelős: {project.owner?.name || "Nincs felelős"}</p></Link>)}</div>}</section>
  </main>;
}
