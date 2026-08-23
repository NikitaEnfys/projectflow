import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAccessContext, projectVisibilityWhere } from "@/lib/auth/access";
import { isClientProjectViewer, requireProjectManagement } from "@/lib/permissions";

export async function GET() {
  const { user, oversightOrganizationIds, linkedClientIds } = await getCurrentAccessContext();
  const projects = await prisma.project.findMany({
    where: projectVisibilityWhere(user.id, oversightOrganizationIds, linkedClientIds),
    select: { id: true },
  });
  const visibleProjectIds = projects.map(p => p.id);
  const clientProjectIds: string[] = [];
  for (const id of visibleProjectIds) if (await isClientProjectViewer(user.id, id)) clientProjectIds.push(id);

  const tasks = await prisma.task.findMany({
    where: {
      projectId: { in: visibleProjectIds },
      OR: [
        { projectId: { notIn: clientProjectIds } },
        { projectId: { in: clientProjectIds }, clientVisible: true },
      ],
    },
    include: { project: true, assignee: true, milestone: true },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(tasks);
}

export async function POST(req: Request) {
  try {
    const { user } = await getCurrentAccessContext();
    const body = await req.json();
    if (!body.projectId) return NextResponse.json({ error: "A projekt kötelező." }, { status: 400 });
    await requireProjectManagement(user.id, body.projectId);
    return NextResponse.json({ error: "Feladat létrehozásához használd a projekt feladatkezelőjét." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: "Nem sikerült feldolgozni a kérést.", details: error instanceof Error ? error.message : "Ismeretlen hiba" }, { status: 500 });
  }
}
