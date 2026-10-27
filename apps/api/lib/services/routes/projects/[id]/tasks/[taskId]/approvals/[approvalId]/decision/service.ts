import {
  json,
} from "@/lib/http/response";
import {
  taskApprovalRepository,
  taskRepository,
} from "@/lib/repositories";
import {
  requireCurrentUser,
} from "@/lib/auth/current-user";
import {
  TaskApprovalDecision,
} from "@/lib/domain/enums";
import {
  resolveTaskAccess,
} from "@/lib/tasks/access";
import {
  ApprovalWorkflowError,
  decideTaskApproval,
} from "@/lib/tasks/approval-workflow";
import {
  refreshProjectProgress,
} from "@/lib/tasks/progress";
import {
  logActivity,
} from "@/lib/activity/log";
import {
  runBestEffortSideEffects,
} from "@/lib/side-effects/best-effort";

type Context = {
  params: Promise<{
    id: string;
    taskId: string;
    approvalId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: Context,
) {
  const {
    id: projectId,
    taskId,
    approvalId,
  } = await params;

  const user =
    await requireCurrentUser();

  const access =
    await resolveTaskAccess(
      user.id,
      projectId,
      taskId,
    );

  if (
    !access ||
    !access.permissions.canView ||
    !access.permissions
      .canDecideApproval ||
    access.myApproval?.id !==
      approvalId
  ) {
    return json(
      {
        error:
          "Ehhez a jóváhagyáshoz nincs döntési jogosultságod.",
      },
      {
        status: 403,
      },
    );
  }

  const approval =
    await taskApprovalRepository.findUnique({
      where: {
        id: approvalId,
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            clientVisible:
              true,
          },
        },
      },
    });

  if (!approval) {
    return json(
      {
        error:
          "A jóváhagyás nem található.",
      },
      {
        status: 404,
      },
    );
  }

  const body =
    await request.json();

  const decision =
    body.decision ===
      TaskApprovalDecision.APPROVED ||
    body.decision ===
      TaskApprovalDecision.REJECTED
      ? body.decision
      : null;

  if (!decision) {
    return json(
      {
        error:
          "Érvénytelen jóváhagyási döntés.",
      },
      {
        status: 400,
      },
    );
  }

  const comment =
    typeof body.comment ===
      "string" &&
    body.comment.trim()
      ? body.comment.trim()
      : null;

  if (
    decision ===
      TaskApprovalDecision.REJECTED &&
    !comment
  ) {
    return json(
      {
        error:
          "Elutasításkor indoklás szükséges.",
      },
      {
        status: 400,
      },
    );
  }

  let result;

  try {
    result =
      await decideTaskApproval({
        projectId,
        taskId,
        approvalId,
        approverId:
          user.id,
        decision,
        comment,
      });
  } catch (error) {
    if (
      error instanceof
      ApprovalWorkflowError
    ) {
      return json(
        {
          error:
            error.message,
        },
        {
          status: 409,
        },
      );
    }

    throw error;
  }

  await runBestEffortSideEffects(
    "TASK_APPROVAL_DECISION",
    [
      {
        name:
          "refreshProjectProgress",
        run: () =>
          refreshProjectProgress(
            projectId,
          ),
      },
      {
        name:
          "logActivity",
        run: () =>
          logActivity({
            projectId,
            taskId,
            userId:
              user.id,
            action:
              decision ===
              TaskApprovalDecision.APPROVED
                ? "TASK_APPROVED"
                : "TASK_REJECTED",
            entityType:
              "TaskApproval",
            entityId:
              approvalId,
            message:
              decision ===
              TaskApprovalDecision.APPROVED
                ? `Jóváhagyta a(z) „${approval.task.title}” feladatot.`
                : `Elutasította a(z) „${approval.task.title}” feladatot: ${comment}`,
            metadata: {
              decision,
              comment,
              resultingStatus:
                result.taskStatus,
            },
            clientVisible:
              approval.task
                .clientVisible,
          }),
      },
    ],
  );

  const updatedTask =
    await taskRepository.findUnique({
      where: {
        id: taskId,
      },
      include: {
        approvals: {
          include: {
            approver: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt:
              "asc",
          },
        },
      },
    });

  return json(
    updatedTask,
  );
}
