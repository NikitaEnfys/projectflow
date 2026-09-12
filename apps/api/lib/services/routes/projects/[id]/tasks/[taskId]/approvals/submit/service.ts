import { json } from "@/lib/http/response";
import {
  taskApprovalRepository,
  taskRepository,
  runInTransaction,
} from "@/lib/repositories";
import { requireCurrentUser } from "@/lib/auth/current-user";
import {
  TaskApprovalDecision,
  TaskStatus,
} from "@/lib/domain/enums";
import { resolveTaskAccess } from "@/lib/tasks/access";
import { refreshProjectProgress } from "@/lib/tasks/progress";
import { logActivity } from "@/lib/activity/log";

type Context = {
  params: Promise<{ id: string; taskId: string }>;
};

export async function POST(
  _: Request,
  { params }: Context,
) {
  const { id: projectId, taskId } = await params;
  const user = await requireCurrentUser();

  const access = await resolveTaskAccess(
    user.id,
    projectId,
    taskId,
  );

  if (!access || !access.permissions.canView) {
    return json(
      { error: "A feladat nem található." },
      { status: 404 },
    );
  }

  if (
    !access.permissions.canSubmitForApproval
  ) {
    return json(
      {
        error:
          "Ezt a feladatot jelenleg nem küldheted jóváhagyásra.",
      },
      { status: 403 },
    );
  }

  const task = await taskRepository.findUnique({
    where: { id: taskId },
    select: {
      title: true,
      clientVisible: true,
    },
  });

  const approvalCount =
    await taskApprovalRepository.count({
      where: { taskId },
    });

  if (!approvalCount) {
    return json(
      {
        error:
          "A feladathoz nincs jóváhagyó beállítva.",
      },
      { status: 400 },
    );
  }

  await runInTransaction(async (tx) => {
    await tx.taskApproval.updateMany({
      where: { taskId },
      data: {
        decision:
          TaskApprovalDecision.PENDING,
        comment: null,
        decidedAt: null,
      },
    });

    await tx.task.update({
      where: { id: taskId },
      data: {
        status:
          TaskStatus.AWAITING_APPROVAL,
      },
    });
  });

  await Promise.all([
    refreshProjectProgress(projectId),
    logActivity({
      projectId,
      taskId,
      userId: user.id,
      action: "TASK_APPROVAL_REQUESTED",
      entityType: "Task",
      entityId: taskId,
      message: `Jóváhagyásra küldte a(z) „${task?.title ?? "feladat"}” feladatot.`,
      clientVisible:
        task?.clientVisible ?? false,
    }),
  ]);

  return json({ success: true });
}
