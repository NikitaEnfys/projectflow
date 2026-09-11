import { json } from "@/lib/http/response";
import { projectRepository, taskRepository } from "@/lib/repositories";
import { getCurrentAccessContext, projectVisibilityWhere } from "@/lib/auth/access";
import { isClientProjectViewer, requireProjectManagement } from "@/lib/permissions";

export async function GET() {
  const { user, oversightOrganizationIds, linkedClientIds } = await getCurrentAccessContext();
  const projects = await projectRepository.findMany({
    where: projectVisibilityWhere(user.id, oversightOrganizationIds, linkedClientIds),
    select: { id: true },
  });
  const visibleProjectIds = projects.map(p => p.id);
  const clientProjectIds: string[] = [];
  for (const id of visibleProjectIds) if (await isClientProjectViewer(user.id, id)) clientProjectIds.push(id);

  const tasks = await taskRepository.findMany({
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
  return json(tasks);
}

export async function POST(req: Request) {
  try {
    const { user } = await getCurrentAccessContext();
    const body = await req.json();
    if (!body.projectId) return json({ error: "A projekt kötelező." }, { status: 400 });
    await requireProjectManagement(user.id, body.projectId);
    return json({ error: "Feladat létrehozásához használd a projekt feladatkezelőjét." }, { status: 400 });
  } catch (error) {
    return json({ error: "Nem sikerült feldolgozni a kérést.", details: error instanceof Error ? error.message : "Ismeretlen hiba" }, { status: 500 });
  }
}
