import {
  projectClientContactRepository,
  projectMemberRepository,
  projectRepository,
  organizationMemberRepository,
  taskApprovalRepository,
  taskRepository,
} from "@/lib/repositories";
import {
  deriveTaskAccessContext,
} from "@/lib/tasks/access-policy";
import {
  buildTaskPermissions,
  type TaskAccessContext,
} from "@/lib/tasks/permission-policy";

export {
  buildTaskPermissions,
};
export type {
  TaskAccessContext,
  TaskPermissions,
} from "@/lib/tasks/permission-policy";

export async function getProjectTaskAccessContext(
  userId: string,
  projectId: string,
): Promise<TaskAccessContext | null> {
  const project =
    await projectRepository.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        organizationId: true,
      },
    });

  if (!project) return null;

  const [
    projectMembership,
    organizationMembership,
    linkedProjectContact,
  ] = await Promise.all([
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
    projectClientContactRepository.findFirst({
      where: {
        projectId,
        clientContact: {
          userId,
        },
      },
      select: { id: true },
    }),
  ]);

  return deriveTaskAccessContext({
    userId,
    projectId,
    projectRole: projectMembership?.role ?? null,
    organizationRole: organizationMembership?.role ?? null,
    linkedProjectContact: Boolean(linkedProjectContact),
  });
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
        creatorId: true,
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
