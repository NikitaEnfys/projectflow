import { serverApi } from "@/lib/api/server";
import { ProjectTeamManager } from "@/components/project-team-manager";
import { MilestoneManager } from "@/components/milestone-manager";
import { TaskKanban } from "@/components/task-kanban";
import { ActivityFeed } from "@/components/activity-feed";
import { ProjectCrudManager } from "@/components/project-crud-manager";

type ProjectPageProps = {
  params: Promise<{ id: string }>;
};

const STATUS_LABELS: Record<string, string> = {
  PLANNING: "Tervezés",
  ACTIVE: "Aktív",
  ON_HOLD: "Szüneteltetve",
  COMPLETED: "Befejezett",
  CANCELLED: "Törölt",
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Alacsony",
  MEDIUM: "Közepes",
  HIGH: "Magas",
  URGENT: "Sürgős",
};

export default async function ProjectDetailsPage({
  params,
}: ProjectPageProps) {
  const { id } = await params;

  const data = await serverApi<any>(
    `/api/projects/${id}/overview`,
  );

  const {
    project,
    currentUserId,
    canManage,
    canManageTeam,
    clientViewer,
    candidates: candidateRows,
    taskMembers,
    approvalCandidates,
    activities,
  } = data;

  return (
    <div className="pf-page">
      <div className="pf-page-header">
        <div className="min-w-0">
          <p className="pf-eyebrow">Projekt</p>
          <h1 className="pf-title truncate">
            {project.name}
          </h1>
          <p className="pf-subtitle">
            {project.description ||
              "Ehhez a projekthez még nincs leírás."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="pf-chip bg-[#eef0ff] text-[#5864dd]">
            {STATUS_LABELS[project.status]}
          </span>
          <span className="pf-chip">
            {PRIORITY_LABELS[project.priority]} prioritás
          </span>
        </div>
      </div>

      <section className="pf-card mb-7 p-5 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="text-xs font-medium text-[#98a1b1]">
              Ügyfél
            </p>
            <p className="mt-1.5 font-semibold text-[#3b4458]">
              {project.client.name}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-[#98a1b1]">
              Projektvezető
            </p>
            <p className="mt-1.5 font-semibold text-[#3b4458]">
              {project.owner.name}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-[#98a1b1]">
              Kezdés
            </p>
            <p className="mt-1.5 font-semibold text-[#3b4458]">
              {project.startDate
                ? new Date(
                    project.startDate,
                  ).toLocaleDateString("hu-HU")
                : "Nincs megadva"}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-[#98a1b1]">
              Határidő
            </p>
            <p className="mt-1.5 font-semibold text-[#3b4458]">
              {project.dueDate
                ? new Date(
                    project.dueDate,
                  ).toLocaleDateString("hu-HU")
                : "Nincs megadva"}
            </p>
          </div>
        </div>
      </section>

      {canManage && (
        <ProjectCrudManager
          projectId={project.id}
          project={{
            name: project.name,
            description: project.description,
            status: project.status,
            priority: project.priority,
            startDate: project.startDate ?? null,
            dueDate: project.dueDate ?? null,
          }}
        />
      )}

      <MilestoneManager
        projectId={project.id}
        initialMilestones={project.milestones.map(
          (milestone: any) => ({
            ...milestone,
            dueDate: milestone.dueDate ?? null,
          }),
        )}
        canManage={canManage}
      />

      <TaskKanban
        projectId={project.id}
        tasks={project.tasks}
        members={taskMembers}
        approvalCandidates={approvalCandidates}
        milestones={project.milestones.map(
          (milestone: any) => ({
            id: milestone.id,
            name: milestone.name,
          }),
        )}
        canManage={canManage}
        clientViewer={clientViewer}
        currentUserId={currentUserId}
      />

      <ActivityFeed
        activities={activities.map((activity: any) => ({
          id: activity.id,
          action: activity.action,
          message: activity.message,
          clientVisible:
            activity.clientVisible,
          createdAt: activity.createdAt,
          user: activity.user
            ? {
                id: activity.user.id,
                name: activity.user.name,
                email:
                  activity.user.email,
              }
            : null,
          task: activity.task
            ? {
                id: activity.task.id,
                title:
                  activity.task.title,
              }
            : null,
        }))}
      />

      {!clientViewer && (
        <ProjectTeamManager
          projectId={project.id}
          initialMembers={project.members}
          candidates={candidateRows}
          canManage={canManageTeam}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}
