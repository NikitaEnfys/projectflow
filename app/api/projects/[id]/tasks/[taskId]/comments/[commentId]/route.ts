import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { canManageProject } from "@/lib/permissions";

type Context = { params: Promise<{ id: string; taskId: string; commentId: string }> };

export async function DELETE(_req: Request, { params }: Context) {
  const { id: projectId, taskId, commentId } = await params;
  const user = await requireCurrentUser();
  const comment = await prisma.taskComment.findFirst({
    where: { id: commentId, taskId, task: { projectId } },
    select: { id: true, authorId: true },
  });
  if (!comment) return NextResponse.json({ error: "A komment nem található." }, { status: 404 });
  const manager = await canManageProject(user.id, projectId);
  if (!manager && comment.authorId !== user.id) {
    return NextResponse.json({ error: "Csak a saját kommentedet törölheted." }, { status: 403 });
  }
  await prisma.taskComment.delete({ where: { id: commentId } });
  return NextResponse.json({ success: true });
}
