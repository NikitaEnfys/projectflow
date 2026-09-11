import { serverApi } from "@/lib/api/server";
import { ProjectTeamManager } from "@/components/project-team-manager";
import { MilestoneManager } from "@/components/milestone-manager";
import { TaskKanban } from "@/components/task-kanban";
import { ActivityFeed } from "@/components/activity-feed";

type ProjectPageProps = { params: Promise<{ id: string }> };
const STATUS_LABELS: Record<string,string> = { PLANNING:"Tervezés", ACTIVE:"Aktív", ON_HOLD:"Szüneteltetve", COMPLETED:"Befejezett", CANCELLED:"Törölt" };
const PRIORITY_LABELS: Record<string,string> = { LOW:"Alacsony", MEDIUM:"Közepes", HIGH:"Magas", URGENT:"Sürgős" };

export default async function ProjectDetailsPage({ params }: ProjectPageProps) {
  const { id } = await params;
  const data = await serverApi<any>(`/api/projects/${id}/overview`);
  const { project, currentUserId, canManage, canManageTeam, clientViewer, candidates: candidateRows, taskMembers, activities } = data;

  return <div className="pf-page">
    <div className="pf-page-header">
      <div className="min-w-0">
        <p className="pf-eyebrow">Projekt</p>
        <h1 className="pf-title truncate">{project.name}</h1>
        <p className="pf-subtitle">{project.description || "Ehhez a projekthez még nincs leírás."}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="pf-chip bg-[#eef0ff] text-[#5864dd]">{STATUS_LABELS[project.status]}</span>
        <span className="pf-chip">{PRIORITY_LABELS[project.priority]} prioritás</span>
      </div>
    </div>

    <section className="pf-card mb-7 p-5 sm:p-6">
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <div><p className="text-xs font-medium text-[#98a1b1]">Ügyfél</p><p className="mt-1.5 font-semibold text-[#3b4458]">{project.client.name}</p></div>
        <div><p className="text-xs font-medium text-[#98a1b1]">Projektvezető</p><p className="mt-1.5 font-semibold text-[#3b4458]">{project.owner.name}</p></div>
        <div><p className="text-xs font-medium text-[#98a1b1]">Kezdés</p><p className="mt-1.5 font-semibold text-[#3b4458]">{project.startDate ? new Date(project.startDate).toLocaleDateString("hu-HU") : "Nincs megadva"}</p></div>
        <div><p className="text-xs font-medium text-[#98a1b1]">Határidő</p><p className="mt-1.5 font-semibold text-[#3b4458]">{project.dueDate ? new Date(project.dueDate).toLocaleDateString("hu-HU") : "Nincs megadva"}</p></div>
      </div>
      <div className="mt-6 border-t border-[#edf0f5] pt-5">
        <div className="mb-2 flex justify-between text-xs font-semibold text-[#687286]"><span>Előrehaladás</span><span>{project.progress}%</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-[#e9ecf3]"><div className="h-full rounded-full bg-gradient-to-r from-[#5b67f1] to-[#7b86f5]" style={{ width: `${project.progress}%` }} /></div>
        <p className="mt-2 text-[11px] text-[#9aa2b1]">Automatikusan a kész feladatok arányából számolva.</p>
      </div>
    </section>

    <MilestoneManager projectId={project.id} initialMilestones={project.milestones.map((m: any) => ({ ...m, dueDate: m.dueDate ?? null }))} canManage={canManage} />

    <TaskKanban
      projectId={project.id}
      tasks={project.tasks.map((task: any) => ({
        id: task.id, title: task.title, description: task.description, status: task.status, priority: task.priority,
        dueDate: task.dueDate ?? null, clientVisible: task.clientVisible, assigneeId: task.assigneeId, creatorId: task.creatorId,
        milestoneId: task.milestoneId,
        assignee: task.assignee ? { id: task.assignee.id, name: task.assignee.name, email: task.assignee.email } : null,
        creator: { id: task.creator.id, name: task.creator.name, email: task.creator.email },
        milestone: task.milestone ? { id: task.milestone.id, name: task.milestone.name } : null,
        comments: task.comments.map((comment: any) => ({ id: comment.id, content: comment.content, visibility: comment.visibility, createdAt: comment.createdAt, authorId: comment.authorId, author: { id: comment.author.id, name: comment.author.name, email: comment.author.email } })),
      }))}
      members={taskMembers}
      milestones={project.milestones.map((m: any) => ({ id: m.id, name: m.name }))}
      canManage={canManage}
      clientViewer={clientViewer}
      currentUserId={currentUserId}
    />

    <ActivityFeed activities={activities.map((activity: any) => ({
      id: activity.id, action: activity.action, message: activity.message, clientVisible: activity.clientVisible, createdAt: activity.createdAt,
      user: activity.user ? { id: activity.user.id, name: activity.user.name, email: activity.user.email } : null,
      task: activity.task ? { id: activity.task.id, title: activity.task.title } : null,
    }))} />

    <ProjectTeamManager projectId={project.id} initialMembers={project.members} candidates={candidateRows} canManage={canManageTeam} currentUserId={currentUserId} />
  </div>;
}
