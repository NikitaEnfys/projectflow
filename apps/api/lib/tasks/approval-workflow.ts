import {
  TaskApprovalDecision,
  TaskStatus,
} from "@/lib/domain/enums";
import {
  runSerializableTransaction,
} from "@/lib/repositories";

export type ApprovalWorkflowErrorCode =
  | "NO_APPROVERS"
  | "TASK_STATE_CONFLICT"
  | "APPROVAL_ALREADY_DECIDED";

export class ApprovalWorkflowError extends Error {
  constructor(
    public readonly code:
      ApprovalWorkflowErrorCode,
    message: string,
  ) {
    super(message);
    this.name =
      "ApprovalWorkflowError";
  }
}

export async function submitTaskForApproval(
  input: {
    projectId: string;
    taskId: string;
  },
) {
  return runSerializableTransaction(
    async (tx) => {
      const approvalCount =
        await tx.taskApproval.count({
          where: {
            taskId:
              input.taskId,
          },
        });

      if (!approvalCount) {
        throw new ApprovalWorkflowError(
          "NO_APPROVERS",
          "A feladathoz nincs jóváhagyó beállítva.",
        );
      }

      const taskUpdate =
        await tx.task.updateMany({
          where: {
            id: input.taskId,
            projectId:
              input.projectId,
            requiresApproval:
              true,
            status: {
              notIn: [
                TaskStatus.AWAITING_APPROVAL,
                TaskStatus.DONE,
              ],
            },
          },
          data: {
            status:
              TaskStatus.AWAITING_APPROVAL,
          },
        });

      if (
        taskUpdate.count !== 1
      ) {
        throw new ApprovalWorkflowError(
          "TASK_STATE_CONFLICT",
          "A feladat állapota közben megváltozott. Frissítsd az oldalt és próbáld újra.",
        );
      }

      await tx.taskApproval.updateMany({
        where: {
          taskId:
            input.taskId,
        },
        data: {
          decision:
            TaskApprovalDecision.PENDING,
          comment: null,
          decidedAt: null,
        },
      });

      return {
        taskStatus:
          TaskStatus.AWAITING_APPROVAL,
      };
    },
  );
}

export async function decideTaskApproval(
  input: {
    projectId: string;
    taskId: string;
    approvalId: string;
    approverId: string;
    decision:
      | typeof TaskApprovalDecision.APPROVED
      | typeof TaskApprovalDecision.REJECTED;
    comment: string | null;
  },
) {
  return runSerializableTransaction(
    async (tx) => {
      const task =
        await tx.task.findFirst({
          where: {
            id: input.taskId,
            projectId:
              input.projectId,
          },
          select: {
            status: true,
          },
        });

      if (
        !task ||
        task.status !==
          TaskStatus.AWAITING_APPROVAL
      ) {
        throw new ApprovalWorkflowError(
          "TASK_STATE_CONFLICT",
          "A feladat már nincs jóváhagyásra váró állapotban.",
        );
      }

      const approvalUpdate =
        await tx.taskApproval.updateMany({
          where: {
            id:
              input.approvalId,
            taskId:
              input.taskId,
            approverId:
              input.approverId,
            decision:
              TaskApprovalDecision.PENDING,
          },
          data: {
            decision:
              input.decision,
            comment:
              input.comment,
            decidedAt:
              new Date(),
          },
        });

      if (
        approvalUpdate.count !== 1
      ) {
        throw new ApprovalWorkflowError(
          "APPROVAL_ALREADY_DECIDED",
          "Ehhez a jóváhagyáshoz már született döntés.",
        );
      }

      if (
        input.decision ===
        TaskApprovalDecision.REJECTED
      ) {
        const taskUpdate =
          await tx.task.updateMany({
            where: {
              id:
                input.taskId,
              projectId:
                input.projectId,
              status:
                TaskStatus.AWAITING_APPROVAL,
            },
            data: {
              status:
                TaskStatus.IN_PROGRESS,
            },
          });

        if (
          taskUpdate.count !== 1
        ) {
          throw new ApprovalWorkflowError(
            "TASK_STATE_CONFLICT",
            "A feladat állapota közben megváltozott.",
          );
        }

        return {
          taskStatus:
            TaskStatus.IN_PROGRESS,
        };
      }

      const remaining =
        await tx.taskApproval.count({
          where: {
            taskId:
              input.taskId,
            decision: {
              not:
                TaskApprovalDecision.APPROVED,
            },
          },
        });

      if (
        remaining === 0
      ) {
        const taskUpdate =
          await tx.task.updateMany({
            where: {
              id:
                input.taskId,
              projectId:
                input.projectId,
              status:
                TaskStatus.AWAITING_APPROVAL,
            },
            data: {
              status:
                TaskStatus.DONE,
            },
          });

        if (
          taskUpdate.count !== 1
        ) {
          throw new ApprovalWorkflowError(
            "TASK_STATE_CONFLICT",
            "A feladat állapota közben megváltozott.",
          );
        }

        return {
          taskStatus:
            TaskStatus.DONE,
        };
      }

      return {
        taskStatus:
          TaskStatus.AWAITING_APPROVAL,
      };
    },
  );
}
