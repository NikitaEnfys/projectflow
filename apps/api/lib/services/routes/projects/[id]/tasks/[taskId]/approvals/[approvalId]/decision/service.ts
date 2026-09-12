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
import { refreshProjectProgress } from "@/lib/tasks/progress";
import { logActivity } from "@/lib/activity/log";

type Context = {
  params: Promise<{
    id: string;
    taskId: string;
    approvalId: string;
  }>;
};

export async function POST(request: Request, { params }: Context) {
  const { id: projectId, taskId, approvalId } = await params;
  const user = await requireCurrentUser();

  const approval = await taskApprovalRepository.findFirst({
    where: {
      id: approvalId,
      taskId,
      approverId: user.id,
      task: { projectId },
    },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          status: true,
          clientVisible: true,
        },
      },
    },
  });

  if (!approval) {
    return json(
      { error: "Nincs ilyen jóváhagyási feladatod." },
      { status: 404 },
    );
  }

  if (approval.task.status !== TaskStatus.AWAITING_APPROVAL) {
    return json(
      { error: "Ez a feladat jelenleg nem vár jóváhagyásra." },
      { status: 409 },
    );
  }

  const body = await request.json();

  const decision =
    body.decision === TaskApprovalDecision.APPROVED ||
    body.decision === TaskApprovalDecision.REJECTED
      ? body.decision
      : null;

  if (!decision) {
    return json(
      { error: "Érvénytelen jóváhagyási döntés." },
      { status: 400 },
    );
  }

  const comment =
    typeof body.comment === "string" && body.comment.trim()
      ? body.comment.trim()
      : null;

  if (
    decision === TaskApprovalDecision.REJECTED &&
    !comment
  ) {
    return json(
      { error: "Elutasításkor indoklás szükséges." },
      { status: 400 },
    );
  }

  const result = await runInTransaction(async (tx) => {
    await tx.taskApproval.update({
      where: { id: approvalId },
      data: {
        decision,
        comment,
        decidedAt: new Date(),
      },
    });

    if (decision === TaskApprovalDecision.REJECTED) {
      await tx.task.update({
        where: { id: taskId },
        data: {
          status: TaskStatus.IN_PROGRESS,
        },
      });

      return { taskStatus: TaskStatus.IN_PROGRESS };
    }

    const remaining = await tx.taskApproval.count({
      where: {
        taskId,
        decision: {
          not: TaskApprovalDecision.APPROVED,
        },
      },
    });

    if (remaining === 0) {
      await tx.task.update({
        where: { id: taskId },
        data: {
          status: TaskStatus.DONE,
        },
      });

      return { taskStatus: TaskStatus.DONE };
    }

    return { taskStatus: TaskStatus.AWAITING_APPROVAL };
  });

  await Promise.all([
    refreshProjectProgress(projectId),
    logActivity({
      projectId,
      taskId,
      userId: user.id,
      action:
        decision === TaskApprovalDecision.APPROVED
          ? "TASK_APPROVED"
          : "TASK_REJECTED",
      entityType: "TaskApproval",
      entityId: approvalId,
      message:
        decision === TaskApprovalDecision.APPROVED
          ? `Jóváhagyta a(z) „${approval.task.title}” feladatot.`
          : `Elutasította a(z) „${approval.task.title}” feladatot: ${comment}`,
      metadata: {
        decision,
        comment,
        resultingStatus: result.taskStatus,
      },
      clientVisible: approval.task.clientVisible,
    }),
  ]);

  const updatedTask = await taskRepository.findUnique({
    where: { id: taskId },
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
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return json(updatedTask);
}
