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
  isClientProjectViewer,
  requireProjectAccess,
} from "@/lib/permissions";
import { refreshProjectProgress } from "@/lib/tasks/progress";
import { logActivity } from "@/lib/activity/log";

type Context = {
  params: Promise<{
    id: string;
  }>;
};

const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  email: true,
} as const;

function parseDate(value: unknown) {
  if (
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value !== "string"
  ) {
    return undefined;
  }

  const date = new Date(
    `${value}T00:00:00`,
  );

  return Number.isNaN(date.getTime())
    ? undefined
    : date;
}

const taskInclude = {
  assignee: {
    select: PUBLIC_USER_SELECT,
  },
  creator: {
    select: PUBLIC_USER_SELECT,
  },
  milestone: true,
  approvals: {
    include: {
      approver: {
        select: PUBLIC_USER_SELECT,
      },
    },
    orderBy: {
      createdAt:
        "asc" as const,
    },
  },
  comments: {
    include: {
      author: {
        select: PUBLIC_USER_SELECT,
      },
    },
    orderBy: {
      createdAt:
        "asc" as const,
    },
  },
};

export async function GET(
  _req: Request,
  { params }: Context,
) {
  const { id: projectId } =
    await params;

  const user =
    await requireCurrentUser();

  await requireProjectAccess(
    user.id,
    projectId,
  );

  const clientViewer =
    await isClientProjectViewer(
      user.id,
      projectId,
    );

  const tasks =
    await taskRepository.findMany({
      where: {
        projectId,
        ...(clientViewer
          ? {
              clientVisible: true,
            }
          : {}),
      },
      include: {
        ...taskInclude,
        approvals: clientViewer
          ? {
              where: {
                approverId: user.id,
              },
              include: {
                approver: {
                  select:
                    PUBLIC_USER_SELECT,
                },
              },
              orderBy: {
                createdAt:
                  "asc",
              },
            }
          : taskInclude.approvals,
        comments: {
          where: clientViewer
            ? {
                visibility:
                  "CLIENT_VISIBLE",
              }
            : undefined,
          include: {
            author: {
              select:
                PUBLIC_USER_SELECT,
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
      orderBy: [
        { dueDate: "asc" },
        { createdAt: "asc" },
      ],
    });

  return json(tasks);
}

export async function POST(
  req: Request,
  { params }: Context,
) {
  try {
    const { id: projectId } =
      await params;

    const user =
      await requireCurrentUser();

    if (
      !(await canManageProject(
        user.id,
        projectId,
      ))
    ) {
      return json(
        {
          error:
            "Nincs jogosultságod feladat létrehozásához.",
        },
        { status: 403 },
      );
    }

    const body = await req.json();

    const title =
      typeof body.title === "string"
        ? body.title.trim()
        : "";

    if (!title) {
      return json(
        {
          error:
            "A feladat címe kötelező.",
        },
        { status: 400 },
      );
    }

    const status =
      Object.values(
        TaskStatus,
      ).includes(body.status)
        ? body.status
        : TaskStatus.TODO;

    if (
      status ===
      TaskStatus.AWAITING_APPROVAL
    ) {
      return json(
        {
          error:
            "Új feladat nem hozható létre közvetlenül jóváhagyásra váró állapotban.",
        },
        { status: 400 },
      );
    }

    const priority =
      Object.values(
        TaskPriority,
      ).includes(body.priority)
        ? body.priority
        : TaskPriority.MEDIUM;

    const dueDate =
      parseDate(body.dueDate);

    if (
      dueDate === undefined
    ) {
      return json(
        {
          error:
            "Érvénytelen határidő.",
        },
        { status: 400 },
      );
    }

    let assigneeId:
      | string
      | null = null;

    if (
      typeof body.assigneeId ===
        "string" &&
      body.assigneeId
    ) {
      const member =
        await projectMemberRepository.findUnique({
          where: {
            projectId_userId: {
              projectId,
              userId:
                body.assigneeId,
            },
          },
        });

      if (
        !member ||
        member.role ===
          ProjectRole.CLIENT
      ) {
        return json(
          {
            error:
              "A felelősnek a projekt belső tagjának kell lennie.",
          },
          { status: 400 },
        );
      }

      assigneeId =
        body.assigneeId;
    }

    let milestoneId:
      | string
      | null = null;

    if (
      typeof body.milestoneId ===
        "string" &&
      body.milestoneId
    ) {
      const milestone =
        await milestoneRepository.findFirst({
          where: {
            id: body.milestoneId,
            projectId,
          },
          select: {
            id: true,
          },
        });

      if (!milestone) {
        return json(
          {
            error:
              "A kiválasztott mérföldkő nem ehhez a projekthez tartozik.",
          },
          { status: 400 },
        );
      }

      milestoneId =
        milestone.id;
    }

    const task =
      await taskRepository.create({
        data: {
          projectId,
          title,
          description:
            typeof body.description ===
              "string" &&
            body.description.trim()
              ? body.description.trim()
              : null,
          status,
          priority,
          dueDate,
          clientVisible: Boolean(
            body.clientVisible,
          ),
          assigneeId,
          milestoneId,
          creatorId: user.id,
        },
        include: taskInclude,
      });

    await Promise.all([
      refreshProjectProgress(
        projectId,
      ),
      logActivity({
        projectId,
        taskId: task.id,
        userId: user.id,
        action:
          "TASK_CREATED",
        entityType: "Task",
        entityId: task.id,
        message: `Létrehozta a(z) „${task.title}” feladatot.`,
        metadata: {
          status: task.status,
          priority:
            task.priority,
          assigneeId:
            task.assigneeId,
        },
        clientVisible:
          task.clientVisible,
      }),
    ]);

    return json(task, {
      status: 201,
    });
  } catch (error) {
    return json(
      {
        error:
          "Nem sikerült létrehozni a feladatot.",
        details:
          error instanceof Error
            ? error.message
            : "Ismeretlen hiba",
      },
      { status: 500 },
    );
  }
}
