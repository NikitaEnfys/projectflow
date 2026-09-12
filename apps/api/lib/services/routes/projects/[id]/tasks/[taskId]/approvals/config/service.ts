import { json } from "@/lib/http/response";
import {
  projectClientContactRepository,
  projectMemberRepository,
  taskApprovalRepository,
  taskRepository,
  runInTransaction,
} from "@/lib/repositories";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { resolveTaskAccess } from "@/lib/tasks/access";

type Context = {
  params: Promise<{ id: string; taskId: string }>;
};

export async function PUT(
  request: Request,
  { params }: Context,
) {
  const { id: projectId, taskId } = await params;
  const user = await requireCurrentUser();

  const access = await resolveTaskAccess(
    user.id,
    projectId,
    taskId,
  );

  if (!access) {
    return json(
      { error: "A feladat nem található." },
      { status: 404 },
    );
  }

  if (!access.permissions.canConfigureApproval) {
    return json(
      {
        error:
          "Nincs jogosultságod a jóváhagyási beállítások módosításához.",
      },
      { status: 403 },
    );
  }

  const body = await request.json();
  const requiresApproval = Boolean(
    body.requiresApproval,
  );

  const approverIds = Array.isArray(
    body.approverIds,
  )
    ? [
        ...new Set(
          body.approverIds.filter(
            (
              value: unknown,
            ): value is string =>
              typeof value === "string" &&
              Boolean(value),
          ),
        ),
      ]
    : [];

  if (
    requiresApproval &&
    approverIds.length === 0
  ) {
    return json(
      {
        error:
          "Jóváhagyásköteles feladathoz válassz legalább egy jóváhagyót.",
      },
      { status: 400 },
    );
  }

  const [
    projectMembers,
    projectContacts,
    task,
  ] = await Promise.all([
    projectMemberRepository.findMany({
      where: {
        projectId,
        userId: { in: approverIds },
      },
      select: {
        userId: true,
        role: true,
      },
    }),
    projectClientContactRepository.findMany({
      where: {
        projectId,
        clientContact: {
          userId: { in: approverIds },
        },
      },
      select: {
        clientContact: {
          select: {
            userId: true,
          },
        },
      },
    }),
    taskRepository.findUnique({
      where: { id: taskId },
      select: {
        clientVisible: true,
      },
    }),
  ]);

  const internalApprovers = new Set(
    projectMembers
      .filter(
        (member) => member.role !== "CLIENT",
      )
      .map((member) => member.userId),
  );

  const clientApprovers = new Set(
    projectContacts
      .map(
        (link) => link.clientContact.userId,
      )
      .filter(
        (value): value is string =>
          Boolean(value),
      ),
  );

  for (const approverId of approverIds) {
    const isInternal =
      internalApprovers.has(approverId);
    const isClient =
      clientApprovers.has(approverId);

    if (!isInternal && !isClient) {
      return json(
        {
          error:
            "A kiválasztott jóváhagyó nem jogosult ennél a projektnél.",
        },
        { status: 400 },
      );
    }

    if (
      isClient &&
      !task?.clientVisible
    ) {
      return json(
        {
          error:
            "Ügyfél csak ügyfél számára látható feladat jóváhagyója lehet.",
        },
        { status: 400 },
      );
    }
  }

  await runInTransaction(async (tx) => {
    await tx.task.update({
      where: { id: taskId },
      data: { requiresApproval },
    });

    if (!requiresApproval) {
      await tx.taskApproval.deleteMany({
        where: { taskId },
      });
      return;
    }

    await tx.taskApproval.deleteMany({
      where: {
        taskId,
        approverId: {
          notIn: approverIds,
        },
      },
    });

    for (const approverId of approverIds) {
      await tx.taskApproval.upsert({
        where: {
          taskId_approverId: {
            taskId,
            approverId,
          },
        },
        update: {},
        create: {
          taskId,
          approverId,
        },
      });
    }
  });

  const approvals =
    await taskApprovalRepository.findMany({
      where: { taskId },
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
    });

  return json({
    requiresApproval,
    approvals,
  });
}
