import Link from "next/link";
import { serverApi } from "@/lib/api/server";

export default async function DashboardPage() {
  const data = await serverApi<any>("/api/dashboard");
  const { user, projects, organizationCount, clientCount } = data;

  const stats = [
    { label: "Látható projektek", value: projects.length, hint: "Aktív munkaterületek", accent: "#5b67f1", soft: "#eef0ff" },
    { label: "Látható ügyfelek", value: clientCount, hint: "Kapcsolódó partnerek", accent: "#1f9d78", soft: "#eaf8f3" },
    { label: "Szervezeti tagságok", value: organizationCount, hint: "Munkaterületek száma", accent: "#c37b22", soft: "#fff6e9" },
  ];

  return <div className="pf-page">
    <div className="pf-page-header">
      <div>
        <p className="pf-eyebrow">Napi áttekintés</p>
        <h1 className="pf-title">Szia, {user.name}! 👋</h1>
        <p className="pf-subtitle">Itt van minden fontos információ, amihez jelenleg hozzáférsz. Bejelentkezve: {user.email}</p>
      </div>
      <Link href="/projects" className="pf-button-secondary">Összes projekt <span aria-hidden>→</span></Link>
    </div>

    <div className="mb-7 grid gap-4 md:grid-cols-3">
      {stats.map((stat) => <section key={stat.label} className="pf-card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#70798b]">{stat.label}</p>
            <p className="mt-2 text-[34px] font-bold tracking-[-0.04em] text-[#1e2638]">{stat.value}</p>
            <p className="mt-1 text-xs text-[#9aa2b2]">{stat.hint}</p>
          </div>
          <span className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl" style={{ backgroundColor: stat.soft, color: stat.accent }}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stat.accent }} />
          </span>
        </div>
      </section>)}
    </div>

    <section className="pf-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#edf0f5] px-5 py-5 sm:px-6">
        <div>
          <h2 className="text-lg font-bold tracking-[-0.02em] text-[#20283a]">Legutóbbi projektek</h2>
          <p className="mt-1 text-xs text-[#8d96a8]">A legutóbb elérhető projektjeid gyors áttekintése.</p>
        </div>
        <Link href="/projects" className="text-sm font-semibold text-[#5965df] hover:text-[#434fc9]">Összes megnyitása</Link>
      </div>

      {projects.length === 0 ? <div className="p-6"><div className="pf-empty">Nincs számodra elérhető projekt.</div></div> : <div className="divide-y divide-[#edf0f5]">
        {projects.slice(0, 5).map((project: any) => <Link key={project.id} href={`/projects/${project.id}`} className="group flex flex-wrap items-center justify-between gap-4 px-5 py-4 hover:bg-[#fafbff] sm:px-6">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef0ff] text-sm font-bold text-[#5864e4]">{project.name?.slice(0, 1)?.toUpperCase()}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#30384b] group-hover:text-[#4e5add]">{project.name}</p>
              <p className="mt-1 truncate text-xs text-[#8a93a5]">{project.client?.name ?? "Nincs ügyfél"} · {project.owner?.name ?? "Nincs felelős"}</p>
            </div>
          </div>
          <span className="text-sm text-[#b0b6c2] group-hover:translate-x-0.5 group-hover:text-[#5965df]">→</span>
        </Link>)}
      </div>}
    </section>
  </div>;
}
