import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type ActivityInput = {
  projectId: string;
  taskId?: string | null;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  message: string;
  metadata?: Prisma.InputJsonValue;
  clientVisible?: boolean;
};

export async function logActivity(input: ActivityInput) {
  return prisma.activityLog.create({
    data: {
      projectId: input.projectId,
      taskId: input.taskId ?? null,
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      message: input.message,
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      clientVisible: input.clientVisible ?? false,
    },
  });
}
