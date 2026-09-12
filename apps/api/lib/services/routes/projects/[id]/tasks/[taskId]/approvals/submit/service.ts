import { json } from "@/lib/http/response";
import {
  taskApprovalRepository,
  taskRepository,
  runInTransaction,
} from "@/lib/repositories";
import { requireCurrentUser } from "@/lib/auth/current-user";
import {
  canManageProject,
  canUpdateAssignedTask,
} from "@/lib/permissions";
import {
  TaskApprovalDecision,
  TaskStatus,
} from "@/lib/domain/enums";
import { refreshProjectProgress } from "@/lib/tasks/progress";
import { logActivity } from "@/lib/activity/log";

type Context = {
  params: Promise<{ id: string; taskId: string }>;
};

export async function POST(_: Request, { params }: Context) {
  const { id: projectId, taskId } = await params;
  const user = await requireCurrentUser();

  const [manager, assignedEditor, task] = await Promise.all([
    canManageProject(user.id, projectId),
    canUpdateAssignedTask(user.id, taskId),
    taskRepository.findFirst({
      where: { id: taskId, projectId },
      select: {
        id: true,
        title: true,
        status: true,
        requiresApproval: true,
        clientVisible: true,
      },
    }),
  ]);

  if (!task) {
    return json({ error: "A feladat nem található." }, { status: 404 });
  }

  if (!manager && !assignedEditor) {
    return json(
      { error: "Nincs jogosultságod jóváhagyásra küldeni ezt a feladatot." },
      { status: 403 },
    );
  }

  if (!task.requiresApproval) {
    return json(
      { error: "Ehhez a feladathoz nincs jóváhagyás beállítva." },
      { status: 400 },
    );
  }

  const approvalCount = await taskApprovalRepository.count({
    where: { taskId },
  });

  if (!approvalCount) {
    return json(
      { error: "A feladathoz nincs jóváhagyó beállítva." },
      { status: 400 },
    );
  }

  await runInTransaction(async (tx) => {
    await tx.taskApproval.updateMany({
      where: { taskId },
      data: {
        decision: TaskApprovalDecision.PENDING,
        comment: null,
        decidedAt: null,
      },
    });

    await tx.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.AWAITING_APPROVAL,
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
      message: `Jóváhagyásra küldte a(z) „${task.title}” feladatot.`,
      clientVisible: task.clientVisible,
    }),
  ]);

  return json({ success: true });
}
