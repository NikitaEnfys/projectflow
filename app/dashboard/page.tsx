import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { clientVisibilityWhere, getCurrentAccessContext, projectVisibilityWhere } from "@/lib/auth/access";

export default async function DashboardPage() {
  const { user, oversightOrganizationIds, linkedClientIds } = await getCurrentAccessContext();
  const [projects, clients] = await Promise.all([
    prisma.project.findMany({
      where: projectVisibilityWhere(user.id, oversightOrganizationIds, linkedClientIds),
      include: { client: true, owner: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({
      where: clientVisibilityWhere(user.id, oversightOrganizationIds),
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const organizationCount = user.memberships.length;
  return <main>
    <div className="mb-8"><p className="text-sm text-gray-500">Bejelentkezve: {user.email}</p><h1 className="mt-1 text-3xl font-bold">Szia, {user.name}!</h1><p className="mt-2 text-sm text-gray-600">Csak azok az adatok jelennek meg, amelyekhez jogosultságod van.</p></div>
    <div className="mb-8 grid gap-4 md:grid-cols-3"><div className="rounded-xl border p-5"><p className="text-sm text-gray-600">Látható projektek</p><p className="mt-2 text-3xl font-bold">{projects.length}</p></div><div className="rounded-xl border p-5"><p className="text-sm text-gray-600">Látható ügyfelek</p><p className="mt-2 text-3xl font-bold">{clients.length}</p></div><div className="rounded-xl border p-5"><p className="text-sm text-gray-600">Szervezeti tagságok</p><p className="mt-2 text-3xl font-bold">{organizationCount}</p></div></div>
    <section className="rounded-xl border p-6"><div className="mb-4 flex items-center justify-between"><h2 className="text-2xl font-semibold">Legutóbbi projektek</h2><Link href="/projects" className="text-sm underline">Összes projekt</Link></div>{projects.length === 0 ? <p className="text-sm text-gray-600">Nincs számodra elérhető projekt.</p> : <div className="grid gap-3">{projects.slice(0,5).map((project)=><Link key={project.id} href={`/projects/${project.id}`} className="block rounded-lg border p-4 hover:bg-gray-50"><p className="font-medium">{project.name}</p><p className="mt-1 text-sm text-gray-600">Ügyfél: {project.client.name}</p><p className="mt-1 text-sm text-gray-600">Felelős: {project.owner.name}</p></Link>)}</div>}</section>
  </main>;
}
