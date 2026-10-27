import {
  json,
} from "@/lib/http/response";
import {
  taskRepository,
} from "@/lib/repositories";
import {
  requireCurrentUser,
} from "@/lib/auth/current-user";
import {
  resolveTaskAccess,
} from "@/lib/tasks/access";
import {
  ApprovalWorkflowError,
  submitTaskForApproval,
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
  }>;
};

export async function POST(
  _: Request,
  { params }: Context,
) {
  const {
    id: projectId,
    taskId,
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
    !access.permissions.canView
  ) {
    return json(
      {
        error:
          "A feladat nem található.",
      },
      {
        status: 404,
      },
    );
  }

  if (
    !access.permissions
      .canSubmitForApproval
  ) {
    return json(
      {
        error:
          "Ezt a feladatot jelenleg nem küldheted jóváhagyásra.",
      },
      {
        status: 403,
      },
    );
  }

  const task =
    await taskRepository.findUnique({
      where: {
        id: taskId,
      },
      select: {
        title: true,
        clientVisible:
          true,
      },
    });

  try {
    await submitTaskForApproval({
      projectId,
      taskId,
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
          status:
            error.code ===
            "NO_APPROVERS"
              ? 400
              : 409,
        },
      );
    }

    throw error;
  }

  await runBestEffortSideEffects(
    "TASK_APPROVAL_REQUESTED",
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
              "TASK_APPROVAL_REQUESTED",
            entityType:
              "Task",
            entityId:
              taskId,
            message:
              `Jóváhagyásra küldte a(z) „${task?.title ?? "feladat"}” feladatot.`,
            clientVisible:
              task?.clientVisible ??
              false,
          }),
      },
    ],
  );

  return json({
    success: true,
  });
}
