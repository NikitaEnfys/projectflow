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
  return <main>
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-bold">{project.name}</h1><p className="mt-2 text-sm text-gray-600">{project.description||"Nincs leírás."}</p></div><div className="flex gap-2"><span className="rounded-full border px-3 py-1 text-sm">{STATUS_LABELS[project.status]}</span><span className="rounded-full border px-3 py-1 text-sm">{PRIORITY_LABELS[project.priority]}</span></div></div>
    <section className="mb-8 rounded-xl border p-6"><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4"><div><p className="text-xs text-gray-500">Ügyfél</p><p className="mt-1 font-medium">{project.client.name}</p></div><div><p className="text-xs text-gray-500">Projektvezető</p><p className="mt-1 font-medium">{project.owner.name}</p></div><div><p className="text-xs text-gray-500">Kezdés</p><p className="mt-1 font-medium">{project.startDate?new Date(project.startDate).toLocaleDateString("hu-HU"):"Nincs megadva"}</p></div><div><p className="text-xs text-gray-500">Határidő</p><p className="mt-1 font-medium">{project.dueDate?new Date(project.dueDate).toLocaleDateString("hu-HU"):"Nincs megadva"}</p></div></div><div className="mt-6"><div className="mb-2 flex justify-between text-sm"><span>Előrehaladás</span><span>{project.progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-gray-800"><div className="h-full bg-white" style={{width:`${project.progress}%`}} /></div><p className="mt-2 text-xs text-gray-500">Automatikusan a kész feladatok arányából számolva.</p></div></section>

    <MilestoneManager projectId={project.id} initialMilestones={project.milestones.map((m) => ({ ...m, dueDate: m.dueDate ?? null }))} canManage={canManage} />

    <TaskKanban
      projectId={project.id}
      tasks={project.tasks.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate ?? null,
        clientVisible: task.clientVisible,
        assigneeId: task.assigneeId,
        creatorId: task.creatorId,
        milestoneId: task.milestoneId,
        assignee: task.assignee ? { id: task.assignee.id, name: task.assignee.name, email: task.assignee.email } : null,
        creator: { id: task.creator.id, name: task.creator.name, email: task.creator.email },
        milestone: task.milestone ? { id: task.milestone.id, name: task.milestone.name } : null,
        comments: task.comments.map(comment => ({
          id:comment.id,
          content:comment.content,
          visibility:comment.visibility,
          createdAt:comment.createdAt,
          authorId:comment.authorId,
          author:{id:comment.author.id,name:comment.author.name,email:comment.author.email},
        })),
      }))}
      members={taskMembers}
      milestones={project.milestones.map(m => ({id:m.id,name:m.name}))}
      canManage={canManage}
      clientViewer={clientViewer}
      currentUserId={currentUserId}
    />

    <ActivityFeed activities={activities.map(activity=>({
      id:activity.id,
      action:activity.action,
      message:activity.message,
      clientVisible:activity.clientVisible,
      createdAt:activity.createdAt,
      user:activity.user?{id:activity.user.id,name:activity.user.name,email:activity.user.email}:null,
      task:activity.task?{id:activity.task.id,title:activity.task.title}:null,
    }))}/>

    <ProjectTeamManager projectId={project.id} initialMembers={project.members} candidates={candidateRows} canManage={canManageTeam} currentUserId={currentUserId} />
  </main>;
}
