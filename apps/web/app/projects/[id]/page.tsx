import { serverApi } from "@/lib/api/server";
import { ProjectTeamManager } from "@/components/project-team-manager";
import { MilestoneManager } from "@/components/milestone-manager";
import { TaskKanban } from "@/components/task-kanban";
import { ActivityFeed } from "@/components/activity-feed";
import { ProjectCrudManager } from "@/components/project-crud-manager";

type ProjectPageProps = {
  params: Promise<{ id: string }>;
};

type UserRef = {
  id: string;
  name: string;
  email: string;
};

type ProjectMember = {
  id: string;
  userId: string;
  role: "PROJECT_MANAGER" | "MEMBER" | "CONTRACTOR" | "CLIENT";
  user: UserRef;
};

type Candidate = {
  userId: string;
  name: string;
  email: string;
  organizationRole: string;
};

type Milestone = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  dueDate: string | null;
};

type TaskPermissions = {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canChangeStatus: boolean;
  canComment: boolean;
  canModerateComments: boolean;
  canConfigureApproval: boolean;
  canSubmitForApproval: boolean;
  canDecideApproval: boolean;
};

type TaskComment = {
  id: string;
  content: string;
  visibility: string;
  createdAt: string;
  authorId: string;
  author: UserRef;
};

type TaskApproval = {
  id: string;
  approverId: string;
  decision: "PENDING" | "APPROVED" | "REJECTED";
  comment: string | null;
  decidedAt: string | null;
  approver: UserRef;
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  clientVisible: boolean;
  requiresApproval: boolean;
  permissions: TaskPermissions;
  myApproval: TaskApproval | null;
  assigneeId: string | null;
  creatorId: string;
  milestoneId: string | null;
  assignee: UserRef | null;
  creator: UserRef;
  milestone: {
    id: string;
    name: string;
  } | null;
  comments: TaskComment[];
  approvals: TaskApproval[];
};

type TaskMember = UserRef & {
  role: string;
};

type ApprovalCandidate = UserRef & {
  source: string;
  clientApprover?: boolean;
};

type Activity = {
  id: string;
  action: string;
  message: string;
  clientVisible: boolean;
  createdAt: string;
  user: UserRef | null;
  task: {
    id: string;
    title: string;
  } | null;
};

type ProjectOverviewResponse = {
  project: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    priority: string;
    startDate: string | null;
    dueDate: string | null;
    client: {
      name: string;
    };
    owner: UserRef;
    milestones: Milestone[];
    tasks: Task[];
    members: ProjectMember[];
  };
  currentUserId: string;
  canManage: boolean;
  canManageTeam: boolean;
  clientViewer: boolean;
  candidates: Candidate[];
  taskMembers: TaskMember[];
  approvalCandidates: ApprovalCandidate[];
  activities: Activity[];
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

  const data = await serverApi<ProjectOverviewResponse>(
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
          (milestone) => ({
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
          (milestone) => ({
            id: milestone.id,
            name: milestone.name,
          }),
        )}
        canManage={canManage}
        clientViewer={clientViewer}
        currentUserId={currentUserId}
      />

      <ActivityFeed
        activities={activities.map((activity) => ({
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
