import { json } from "@/lib/http/response";
import { taskCommentRepository } from "@/lib/repositories";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { canManageProject } from "@/lib/permissions";

type Context = {
  params: Promise<{ id: string; taskId: string; commentId: string }>;
};

async function getEditableComment(
  userId: string,
  projectId: string,
  taskId: string,
  commentId: string,
) {
  const comment = await taskCommentRepository.findFirst({
    where: { id: commentId, taskId, task: { projectId } },
    select: { id: true, authorId: true },
  });

  if (!comment) return { error: "NOT_FOUND" as const, comment: null };

  const manager = await canManageProject(userId, projectId);
  if (!manager && comment.authorId !== userId) {
    return { error: "FORBIDDEN" as const, comment: null };
  }

  return { error: null, comment };
}

export async function PATCH(request: Request, { params }: Context) {
  const { id: projectId, taskId, commentId } = await params;
  const user = await requireCurrentUser();

  const access = await getEditableComment(user.id, projectId, taskId, commentId);
  if (access.error === "NOT_FOUND") {
    return json({ error: "A komment nem található." }, { status: 404 });
  }
  if (access.error === "FORBIDDEN") {
    return json({ error: "Csak a saját kommentedet szerkesztheted." }, { status: 403 });
  }

  const body = await request.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return json({ error: "A komment nem lehet üres." }, { status: 400 });

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

  const access = await getEditableComment(user.id, projectId, taskId, commentId);
  if (access.error === "NOT_FOUND") {
    return json({ error: "A komment nem található." }, { status: 404 });
  }
  if (access.error === "FORBIDDEN") {
    return json({ error: "Csak a saját kommentedet törölheted." }, { status: 403 });
  }

  await taskCommentRepository.delete({ where: { id: commentId } });
  return json({ success: true });
}
