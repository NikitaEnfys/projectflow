import {
  ProjectRole,
  TaskApprovalDecision,
  TaskStatus,
} from "@/lib/domain/enums";

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
  creatorId: string;
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

export function buildTaskPermissions(
  context: TaskAccessContext,
  task: TaskForAccess,
  myApproval: ApprovalForAccess,
): TaskPermissions {
  const assignedInternal =
    context.internalMember &&
    task.assigneeId === context.userId;

  const createdInternal =
    context.internalMember &&
    task.creatorId === context.userId;

  const canView =
    context.manager ||
    context.internalMember ||
    (context.clientViewer && task.clientVisible);

  const canEdit =
    task.status !== TaskStatus.AWAITING_APPROVAL &&
    (context.manager || createdInternal);

  const canDelete = context.manager;

  const canChangeStatus =
    canView &&
    task.status !== TaskStatus.AWAITING_APPROVAL &&
    (
      context.manager ||
      assignedInternal ||
      createdInternal
    );

  const canSubmitForApproval =
    canView &&
    task.requiresApproval &&
    task.status !== TaskStatus.AWAITING_APPROVAL &&
    task.status !== TaskStatus.DONE &&
    (
      context.manager ||
      assignedInternal ||
      createdInternal
    );

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
      task.status !== TaskStatus.AWAITING_APPROVAL &&
      (
        context.manager ||
        createdInternal
      ),
    canSubmitForApproval,
    canDecideApproval,
  };
}
