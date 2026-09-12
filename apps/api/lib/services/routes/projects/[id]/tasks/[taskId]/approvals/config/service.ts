import { json } from "@/lib/http/response";
import {
  projectClientContactRepository,
  projectMemberRepository,
  taskApprovalRepository,
  taskRepository,
  runInTransaction,
} from "@/lib/repositories";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { canManageProject } from "@/lib/permissions";
import { TaskStatus } from "@/lib/domain/enums";

type Context = {
  params: Promise<{ id: string; taskId: string }>;
};

export async function PUT(request: Request, { params }: Context) {
  const { id: projectId, taskId } = await params;
  const user = await requireCurrentUser();

  if (!(await canManageProject(user.id, projectId))) {
    return json(
      { error: "Nincs jogosultságod a jóváhagyási beállítások módosításához." },
      { status: 403 },
    );
  }

  const task = await taskRepository.findFirst({
    where: { id: taskId, projectId },
    select: {
      id: true,
      status: true,
    },
  });

  if (!task) {
    return json({ error: "A feladat nem található." }, { status: 404 });
  }

  if (task.status === TaskStatus.AWAITING_APPROVAL) {
    return json(
      {
        error:
          "Jóváhagyásra váró feladatnál előbb fejezd be vagy szakítsd meg a jóváhagyási kört.",
      },
      { status: 409 },
    );
  }

  const body = await request.json();
  const requiresApproval = Boolean(body.requiresApproval);

  const approverIds = Array.isArray(body.approverIds)
    ? [
        ...new Set(
          body.approverIds.filter(
            (value: unknown): value is string =>
              typeof value === "string" && Boolean(value),
          ),
        ),
      ]
    : [];

  if (requiresApproval && approverIds.length === 0) {
    return json(
      { error: "Jóváhagyásköteles feladathoz válassz legalább egy jóváhagyót." },
      { status: 400 },
    );
  }

  const [projectMembers, projectContacts] = await Promise.all([
    projectMemberRepository.findMany({
      where: {
        projectId,
        userId: { in: approverIds },
      },
      select: { userId: true },
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
          select: { userId: true },
        },
      },
    }),
  ]);

  const allowed = new Set<string>([
    ...projectMembers.map((member) => member.userId),
    ...projectContacts
      .map((link) => link.clientContact.userId)
      .filter((value): value is string => Boolean(value)),
  ]);

  const invalidApprover = approverIds.find((id) => !allowed.has(id));

  if (invalidApprover) {
    return json(
      {
        error:
          "A kiválasztott jóváhagyó nem tagja a projektnek és nem kijelölt ügyfél-kapcsolattartó.",
      },
      { status: 400 },
    );
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
        approverId: { notIn: approverIds },
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

  const approvals = await taskApprovalRepository.findMany({
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
