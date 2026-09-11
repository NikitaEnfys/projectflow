import { CommentVisibility } from "@/lib/domain/enums";
import { json } from "@/lib/http/response";
import { taskCommentRepository, taskRepository } from "@/lib/repositories";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { canManageProject, isClientProjectViewer, requireProjectAccess } from "@/lib/permissions";
import { logActivity } from "@/lib/activity/log";

type Context = { params: Promise<{ id: string; taskId: string }> };

async function getVisibleTask(userId: string, projectId: string, taskId: string) {
  await requireProjectAccess(userId, projectId);
  const clientViewer = await isClientProjectViewer(userId, projectId);
  const task = await taskRepository.findFirst({
    where: { id: taskId, projectId, ...(clientViewer ? { clientVisible: true } : {}) },
    select: { id: true, title: true, clientVisible: true },
  });
  return { task, clientViewer };
}

export async function GET(_req: Request, { params }: Context) {
  const { id: projectId, taskId } = await params;
  const user = await requireCurrentUser();
  const { task, clientViewer } = await getVisibleTask(user.id, projectId, taskId);
  if (!task) return json({ error: "A feladat nem található." }, { status: 404 });

  const comments = await taskCommentRepository.findMany({
    where: { taskId, ...(clientViewer ? { visibility: CommentVisibility.CLIENT_VISIBLE } : {}) },
    include: { author: true },
    orderBy: { createdAt: "asc" },
  });
  return json(comments);
}

export async function POST(req: Request, { params }: Context) {
  const { id: projectId, taskId } = await params;
  const user = await requireCurrentUser();
  const { task, clientViewer } = await getVisibleTask(user.id, projectId, taskId);
  if (!task) return json({ error: "A feladat nem található vagy nem látható számodra." }, { status: 404 });

  const body = await req.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return json({ error: "A komment nem lehet üres." }, { status: 400 });
  if (content.length > 5000) return json({ error: "A komment legfeljebb 5000 karakter lehet." }, { status: 400 });

  let visibility = CommentVisibility.INTERNAL;
  if (clientViewer) {
    visibility = CommentVisibility.CLIENT_VISIBLE;
  } else if (body.visibility === CommentVisibility.CLIENT_VISIBLE) {
    if (!task.clientVisible) return json({ error: "Csak ügyfél számára látható feladathoz írható ügyfélnek látható komment." }, { status: 400 });
    visibility = CommentVisibility.CLIENT_VISIBLE;
  }

  const comment = await taskCommentRepository.create({
    data: { taskId, authorId: user.id, content, visibility },
    include: { author: true },
  });

  await logActivity({
    projectId,
    taskId,
    userId: user.id,
    action: "TASK_COMMENT_ADDED",
    entityType: "TaskComment",
    entityId: comment.id,
    message: `Kommentet írt a(z) „${task.title}” feladathoz.`,
    metadata: { visibility },
    clientVisible: visibility === CommentVisibility.CLIENT_VISIBLE && task.clientVisible,
  });

  return json(comment, { status: 201 });
}
