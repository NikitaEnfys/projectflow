import { activityLogRepository } from "@/lib/repositories";

type ActivityInput = {
  projectId: string;
  taskId?: string | null;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  message: string;
  metadata?: unknown;
  clientVisible?: boolean;
};

export async function logActivity(input: ActivityInput) {
  return activityLogRepository.create({
    data: {
      projectId: input.projectId,
      taskId: input.taskId ?? null,
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      message: input.message,
      ...(input.metadata !== undefined ? { metadata: input.metadata as never } : {}),
      clientVisible: input.clientVisible ?? false,
    },
  });
}
