import Link from "next/link";
import { serverApi } from "@/lib/api/server";
import { ProjectListActions } from "@/components/project-list-actions";

const STATUS_LABELS: Record<string, string> = {
  PLANNING: "Tervezés",
  ACTIVE: "Aktív",
  ON_HOLD: "Szünetel",
  COMPLETED: "Kész",
  CANCELLED: "Törölt",
};

export default async function ProjectsPage() {
  const [projects, access] = await Promise.all([
    serverApi<any[]>("/api/projects"),
    serverApi<any>("/api/access"),
  ]);

  const canManageProjects = Boolean(
    access.canManageProjects,
  );

  return (
    <div className="pf-page">
      <div className="pf-page-header">
        <div>
          <p className="pf-eyebrow">Munka</p>
          <h1 className="pf-title">Projektek</h1>
          <p className="pf-subtitle">
            Minden projekted, felelősöd és határidőd egy
            átlátható nézetben.
          </p>
        </div>

        {access.canCreateProject && (
          <Link
            href="/projects/new"
            className="pf-button-primary"
          >
            <span className="text-lg leading-none">+</span>{" "}
            Új projekt
          </Link>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="pf-empty">
          <p className="font-semibold text-[#424b5e]">
            Még nincs elérhető projekt.
          </p>
          <p className="mt-1 text-sm">
            {access.canCreateProject
              ? "Hozz létre egy új projektet."
              : "Jelenleg nincs számodra elérhető projekt."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {projects.map((project) => (
            <article
              key={project.id}
              className="pf-card p-5 sm:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="pf-chip">
                      {STATUS_LABELS[project.status] ??
                        project.status}
                    </span>
                    <span className="text-xs text-[#a0a7b5]">
                      {project.priority}
                    </span>
                  </div>

                  <Link
                    href={`/projects/${project.id}`}
                    className="block truncate text-lg font-bold tracking-[-0.02em] text-[#242c3f] hover:underline"
                  >
                    {project.name}
                  </Link>

                  <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-[#758093]">
                    {project.description || "Nincs leírás."}
                  </p>
                </div>

                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f1f2ff] text-sm font-bold text-[#5965df]">
                  {project.name
                    ?.slice(0, 1)
                    ?.toUpperCase()}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[#edf0f5] pt-4 text-xs">
                <div>
                  <p className="text-[#9aa2b1]">
                    Ügyfél
                  </p>
                  <p className="mt-1 truncate font-semibold text-[#515a6d]">
                    {project.client?.name ||
                      "Nincs ügyfél"}
                  </p>
                </div>

                <div>
                  <p className="text-[#9aa2b1]">
                    Felelős
                  </p>
                  <p className="mt-1 truncate font-semibold text-[#515a6d]">
                    {project.owner?.name ||
                      "Nincs felelős"}
                  </p>
                </div>

                <div>
                  <p className="text-[#9aa2b1]">
                    Határidő
                  </p>
                  <p className="mt-1 font-semibold text-[#515a6d]">
                    {project.dueDate
                      ? new Date(
                          project.dueDate,
                        ).toLocaleDateString("hu-HU")
                      : "Nincs megadva"}
                  </p>
                </div>

                <div>
                  <p className="text-[#9aa2b1]">
                    Előrehaladás
                  </p>
                  <p className="mt-1 font-semibold text-[#515a6d]">
                    {project.progress}%
                  </p>
                </div>
              </div>

              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#eceff5]">
                <div
                  className="h-full rounded-full bg-[#6672ee]"
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(
                        100,
                        project.progress ?? 0,
                      ),
                    )}%`,
                  }}
                />
              </div>

              {canManageProjects ? (
                <ProjectListActions
                  projectId={project.id}
                  projectName={project.name}
                />
              ) : (
                <div className="mt-4 border-t border-[#edf0f5] pt-3">
                  <Link
                    href={`/projects/${project.id}`}
                    className="inline-flex rounded-lg border px-3 py-1.5 text-xs font-semibold text-[#566074]"
                  >
                    Megnyitás
                  </Link>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
