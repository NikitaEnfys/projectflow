import { CommentVisibility } from "@/lib/domain/enums";
import { json } from "@/lib/http/response";
import { taskCommentRepository } from "@/lib/repositories";
import { requireCurrentUser } from "@/lib/auth/current-user";
import {
  canManageProject,
  isClientProjectViewer,
  requireProjectAccess,
} from "@/lib/permissions";

type Context = {
  params: Promise<{
    id: string;
    taskId: string;
    commentId: string;
  }>;
};

async function getCommentAccess(
  userId: string,
  projectId: string,
  taskId: string,
  commentId: string,
) {
  try {
    await requireProjectAccess(userId, projectId);
  } catch {
    return { error: "FORBIDDEN" as const, comment: null, manager: false };
  }

  const [comment, manager, clientViewer] = await Promise.all([
    taskCommentRepository.findFirst({
      where: {
        id: commentId,
        taskId,
        task: { projectId },
      },
      select: {
        id: true,
        authorId: true,
        visibility: true,
        task: {
          select: { clientVisible: true },
        },
      },
    }),
    canManageProject(userId, projectId),
    isClientProjectViewer(userId, projectId),
  ]);

  if (!comment) {
    return { error: "NOT_FOUND" as const, comment: null, manager };
  }

  if (clientViewer) {
    const allowed =
      comment.authorId === userId &&
      comment.visibility === CommentVisibility.CLIENT_VISIBLE &&
      comment.task.clientVisible;

    return allowed
      ? { error: null, comment, manager: false }
      : { error: "FORBIDDEN" as const, comment: null, manager: false };
  }

  if (!manager && comment.authorId !== userId) {
    return { error: "FORBIDDEN" as const, comment: null, manager };
  }

  return { error: null, comment, manager };
}

export async function PATCH(request: Request, { params }: Context) {
  const { id: projectId, taskId, commentId } = await params;
  const user = await requireCurrentUser();

  const access = await getCommentAccess(
    user.id,
    projectId,
    taskId,
    commentId,
  );

  if (access.error === "NOT_FOUND") {
    return json({ error: "A komment nem található." }, { status: 404 });
  }

  if (access.error === "FORBIDDEN") {
    return json(
      { error: "Nincs jogosultságod ennek a kommentnek a szerkesztéséhez." },
      { status: 403 },
    );
  }

  const body = await request.json();
  const content =
    typeof body.content === "string" ? body.content.trim() : "";

  if (!content) {
    return json({ error: "A komment nem lehet üres." }, { status: 400 });
  }

  if (content.length > 5000) {
    return json(
      { error: "A komment legfeljebb 5000 karakter lehet." },
      { status: 400 },
    );
  }

  const updated = await taskCommentRepository.update({
    where: { id: commentId },
    data: { content },
    include: { author: true },
  });

  return json(updated);
}

export async function DELETE(_: Request, { params }: Context) {
  const { id: projectId, taskId, commentId } = await params;
  const user = await requireCurrentUser();

  const access = await getCommentAccess(
    user.id,
    projectId,
    taskId,
    commentId,
  );

  if (access.error === "NOT_FOUND") {
    return json({ error: "A komment nem található." }, { status: 404 });
  }

  if (access.error === "FORBIDDEN") {
    return json(
      { error: "Nincs jogosultságod ennek a kommentnek a törléséhez." },
      { status: 403 },
    );
  }

  await taskCommentRepository.delete({
    where: { id: commentId },
  });

  return json({ success: true });
}
