import {
  OrganizationRole,
  ProjectRole,
  TaskApprovalDecision,
  TaskStatus,
} from "@/lib/domain/enums";
import {
  clientContactRepository,
  organizationMemberRepository,
  projectMemberRepository,
  projectRepository,
  taskApprovalRepository,
  taskRepository,
} from "@/lib/repositories";

export type TaskPermissions = {
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

export type TaskAccessContext = {
  userId: string;
  projectId: string;
  manager: boolean;
  internalMember: boolean;
  clientViewer: boolean;
  projectRole: ProjectRole | null;
};

type TaskForAccess = {
  id: string;
  assigneeId: string | null;
  clientVisible: boolean;
  requiresApproval: boolean;
  status: string;
};

type ApprovalForAccess = {
  id: string;
  approverId: string;
  decision: string;
} | null;

const ORGANIZATION_CONTENT_MANAGERS = new Set<OrganizationRole>([
  OrganizationRole.OWNER,
  OrganizationRole.ADMIN,
  OrganizationRole.PROJECT_MANAGER,
]);

export async function getProjectTaskAccessContext(
  userId: string,
  projectId: string,
): Promise<TaskAccessContext | null> {
  const project = await projectRepository.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      organizationId: true,
      clientId: true,
    },
  });

  if (!project) return null;

  const [projectMembership, organizationMembership, clientContact] =
    await Promise.all([
      projectMemberRepository.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId,
          },
        },
      }),
      project.organizationId
        ? organizationMemberRepository.findUnique({
            where: {
              organizationId_userId: {
                organizationId: project.organizationId,
                userId,
              },
            },
          })
        : Promise.resolve(null),
      clientContactRepository.findFirst({
        where: {
          clientId: project.clientId,
          userId,
        },
        select: { id: true },
      }),
    ]);

  const manager =
    projectMembership?.role === ProjectRole.PROJECT_MANAGER ||
    Boolean(
      organizationMembership &&
        ORGANIZATION_CONTENT_MANAGERS.has(
          organizationMembership.role,
        ),
    );

  const internalMember =
    manager ||
    projectMembership?.role === ProjectRole.MEMBER ||
    projectMembership?.role === ProjectRole.CONTRACTOR;

  const clientViewer =
    !manager &&
    !internalMember &&
    (projectMembership?.role === ProjectRole.CLIENT ||
      Boolean(clientContact));

  return {
    userId,
    projectId,
    manager,
    internalMember,
    clientViewer,
    projectRole: projectMembership?.role ?? null,
  };
}

export function buildTaskPermissions(
  context: TaskAccessContext,
  task: TaskForAccess,
  myApproval: ApprovalForAccess,
): TaskPermissions {
  const assignedInternal =
    context.internalMember &&
    task.assigneeId === context.userId;

  const canView =
    context.manager ||
    context.internalMember ||
    (context.clientViewer && task.clientVisible);

  const canEdit =
    context.manager &&
    task.status !== TaskStatus.AWAITING_APPROVAL;

  const canDelete = context.manager;

  const canChangeStatus =
    canView &&
    task.status !== TaskStatus.AWAITING_APPROVAL &&
    (context.manager || assignedInternal);

  const canSubmitForApproval =
    canView &&
    task.requiresApproval &&
    task.status !== TaskStatus.AWAITING_APPROVAL &&
    task.status !== TaskStatus.DONE &&
    (context.manager || assignedInternal);

  const canDecideApproval =
    canView &&
    task.status === TaskStatus.AWAITING_APPROVAL &&
    myApproval?.decision === TaskApprovalDecision.PENDING;

  return {
    canView,
    canEdit,
    canDelete,
    canChangeStatus,
    canComment: canView,
    canModerateComments: context.manager,
    canConfigureApproval:
      context.manager &&
      task.status !== TaskStatus.AWAITING_APPROVAL,
    canSubmitForApproval,
    canDecideApproval,
  };
}

export async function resolveTaskAccess(
  userId: string,
  projectId: string,
  taskId: string,
) {
  const context = await getProjectTaskAccessContext(
    userId,
    projectId,
  );

  if (!context) {
    return null;
  }

  const [task, myApproval] = await Promise.all([
    taskRepository.findFirst({
      where: {
        id: taskId,
        projectId,
      },
      select: {
        id: true,
        assigneeId: true,
        clientVisible: true,
        requiresApproval: true,
        status: true,
      },
    }),
    taskApprovalRepository.findFirst({
      where: {
        taskId,
        approverId: userId,
      },
      select: {
        id: true,
        approverId: true,
        decision: true,
      },
    }),
  ]);

  if (!task) return null;

  return {
    context,
    task,
    myApproval,
    permissions: buildTaskPermissions(
      context,
      task,
      myApproval,
    ),
  };
}
