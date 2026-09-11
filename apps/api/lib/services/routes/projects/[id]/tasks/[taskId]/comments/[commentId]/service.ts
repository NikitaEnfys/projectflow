import { json } from "@/lib/http/response";
import { taskCommentRepository } from "@/lib/repositories";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { canManageProject } from "@/lib/permissions";

type Context = { params: Promise<{ id: string; taskId: string; commentId: string }> };

export async function DELETE(_req: Request, { params }: Context) {
  const { id: projectId, taskId, commentId } = await params;
  const user = await requireCurrentUser();
  const comment = await taskCommentRepository.findFirst({
    where: { id: commentId, taskId, task: { projectId } },
    select: { id: true, authorId: true },
  });
  if (!comment) return json({ error: "A komment nem található." }, { status: 404 });
  const manager = await canManageProject(user.id, projectId);
  if (!manager && comment.authorId !== user.id) {
    return json({ error: "Csak a saját kommentedet törölheted." }, { status: 403 });
  }
  await taskCommentRepository.delete({ where: { id: commentId } });
  return json({ success: true });
}
