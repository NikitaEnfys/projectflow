import { json } from "@/lib/http/response";
import {
  ProjectRole,
  TaskPriority,
  TaskStatus,
} from "@/lib/domain/enums";
import {
  milestoneRepository,
  projectMemberRepository,
  taskRepository,
} from "@/lib/repositories";
import { requireCurrentUser } from "@/lib/auth/current-user";
import {
  canManageProject,
  canUpdateAssignedTask,
} from "@/lib/permissions";
import { refreshProjectProgress } from "@/lib/tasks/progress";
import { logActivity } from "@/lib/activity/log";

type Context = {
  params: Promise<{ id: string; taskId: string }>;
};

function parseDate(value: unknown) {
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

const taskInclude = {
  assignee: true,
  creator: true,
  milestone: true,
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
    orderBy: { createdAt: "asc" as const },
  },
  comments: {
    include: { author: true },
    orderBy: { createdAt: "asc" as const },
  },
};

export async function PATCH(req: Request, { params }: Context) {
  const { id: projectId, taskId } = await params;
  const user = await requireCurrentUser();

  const existing = await taskRepository.findFirst({
    where: { id: taskId, projectId },
  });

  if (!existing) {
    return json(
      { error: "A feladat nem található." },
      { status: 404 },
    );
  }

  const manager = await canManageProject(user.id, projectId);
  const assignedEditor =
    !manager && (await canUpdateAssignedTask(user.id, taskId));

  if (!manager && !assignedEditor) {
    return json(
      { error: "Nincs jogosultságod a feladat módosításához." },
      { status: 403 },
    );
  }

  const body = await req.json();

  if (assignedEditor) {
    if (!Object.values(TaskStatus).includes(body.status)) {
      return json(
        { error: "Érvénytelen státusz." },
        { status: 400 },
      );
    }

    if (body.status === TaskStatus.AWAITING_APPROVAL) {
      return json(
        {
          error:
            "A jóváhagyási folyamatot a „Jóváhagyásra küldés” művelettel indítsd.",
        },
        { status: 400 },
      );
    }

    if (
      existing.requiresApproval &&
      body.status === TaskStatus.DONE
    ) {
      return json(
        {
          error:
            "Jóváhagyásköteles feladat csak a jóváhagyási folyamat végén kerülhet Kész állapotba.",
        },
        { status: 409 },
      );
    }

    const updated = await taskRepository.update({
      where: { id: taskId },
      data: { status: body.status },
      include: taskInclude,
    });

    await Promise.all([
      refreshProjectProgress(projectId),
      existing.status !== updated.status
        ? logActivity({
            projectId,
            taskId,
            userId: user.id,
            action: "TASK_STATUS_CHANGED",
            entityType: "Task",
            entityId: taskId,
            message: `A(z) „${updated.title}” feladat állapota ${existing.status} → ${updated.status} értékre változott.`,
            metadata: {
              from: existing.status,
              to: updated.status,
            },
            clientVisible: updated.clientVisible,
          })
        : Promise.resolve(null),
    ]);

    return json(updated);
  }

  const data: {
    title?: string;
    description?: string | null;
    status?: TaskStatus;
    priority?: TaskPriority;
    dueDate?: Date | null;
    clientVisible?: boolean;
    assigneeId?: string | null;
    milestoneId?: string | null;
  } = {};

  if ("title" in body) {
    const title =
      typeof body.title === "string" ? body.title.trim() : "";

    if (!title) {
      return json(
        { error: "A feladat címe kötelező." },
        { status: 400 },
      );
    }

    data.title = title;
  }

  if ("description" in body) {
    data.description =
      typeof body.description === "string" &&
      body.description.trim()
        ? body.description.trim()
        : null;
  }

  if ("status" in body) {
    if (!Object.values(TaskStatus).includes(body.status)) {
      return json(
        { error: "Érvénytelen státusz." },
        { status: 400 },
      );
    }

    if (body.status === TaskStatus.AWAITING_APPROVAL) {
      return json(
        {
          error:
            "A jóváhagyási folyamatot a „Jóváhagyásra küldés” művelettel indítsd.",
        },
        { status: 400 },
      );
    }

    if (
      existing.requiresApproval &&
      body.status === TaskStatus.DONE
    ) {
      return json(
        {
          error:
            "Jóváhagyásköteles feladat nem állítható közvetlenül Kész állapotba.",
        },
        { status: 409 },
      );
    }

    data.status = body.status;
  }

  if ("priority" in body) {
    if (!Object.values(TaskPriority).includes(body.priority)) {
      return json(
        { error: "Érvénytelen prioritás." },
        { status: 400 },
      );
    }

    data.priority = body.priority;
  }

  if ("dueDate" in body) {
    const dueDate = parseDate(body.dueDate);

    if (dueDate === undefined) {
      return json(
        { error: "Érvénytelen határidő." },
        { status: 400 },
      );
    }

    data.dueDate = dueDate;
  }

  if ("clientVisible" in body) {
    data.clientVisible = Boolean(body.clientVisible);
  }

  if ("assigneeId" in body) {
    if (!body.assigneeId) {
      data.assigneeId = null;
    } else {
      const member = await projectMemberRepository.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId: body.assigneeId,
          },
        },
      });

      if (!member || member.role === ProjectRole.CLIENT) {
        return json(
          {
            error:
              "A felelősnek a projekt belső tagjának kell lennie.",
          },
          { status: 400 },
        );
      }

      data.assigneeId = body.assigneeId;
    }
  }

  if ("milestoneId" in body) {
    if (!body.milestoneId) {
      data.milestoneId = null;
    } else {
      const milestone = await milestoneRepository.findFirst({
        where: {
          id: body.milestoneId,
          projectId,
        },
        select: { id: true },
      });

      if (!milestone) {
        return json(
          {
            error:
              "A mérföldkő nem ehhez a projekthez tartozik.",
          },
          { status: 400 },
        );
      }

      data.milestoneId = milestone.id;
    }
  }

  const updated = await taskRepository.update({
    where: { id: taskId },
    data,
    include: taskInclude,
  });

  const changes: Record<string, unknown> = {};

  for (const key of [
    "title",
    "status",
    "priority",
    "assigneeId",
    "milestoneId",
    "clientVisible",
  ] as const) {
    if (existing[key] !== updated[key]) {
      changes[key] = {
        from: existing[key],
        to: updated[key],
      };
    }
  }

  await Promise.all([
    refreshProjectProgress(projectId),
    Object.keys(changes).length
      ? logActivity({
          projectId,
          taskId,
          userId: user.id,
          action:
            existing.status !== updated.status
              ? "TASK_STATUS_CHANGED"
              : "TASK_UPDATED",
          entityType: "Task",
          entityId: taskId,
          message:
            existing.status !== updated.status
              ? `A(z) „${updated.title}” feladat állapota ${existing.status} → ${updated.status} értékre változott.`
              : `Módosította a(z) „${updated.title}” feladatot.`,
          metadata: changes,
          clientVisible: updated.clientVisible,
        })
      : Promise.resolve(null),
  ]);

  return json(updated);
}

export async function DELETE(_req: Request, { params }: Context) {
  const { id: projectId, taskId } = await params;
  const user = await requireCurrentUser();

  if (!(await canManageProject(user.id, projectId))) {
    return json(
      { error: "Nincs jogosultságod a feladat törléséhez." },
      { status: 403 },
    );
  }

  const existing = await taskRepository.findFirst({
    where: { id: taskId, projectId },
    select: {
      id: true,
      title: true,
      clientVisible: true,
    },
  });

  if (!existing) {
    return json(
      { error: "A feladat nem található." },
      { status: 404 },
    );
  }

  await logActivity({
    projectId,
    userId: user.id,
    action: "TASK_DELETED",
    entityType: "Task",
    entityId: taskId,
    message: `Törölte a(z) „${existing.title}” feladatot.`,
    clientVisible: false,
  });

  await taskRepository.delete({
    where: { id: taskId },
  });

  await refreshProjectProgress(projectId);

  return json({ success: true });
}
