import { json } from "@/lib/http/response";
import { activityLogRepository } from "@/lib/repositories";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { isClientProjectViewer, requireProjectAccess } from "@/lib/permissions";

type Context = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Context) {
  const { id: projectId } = await params;
  const user = await requireCurrentUser();
  await requireProjectAccess(user.id, projectId);
  const clientViewer = await isClientProjectViewer(user.id, projectId);
  const activities = await activityLogRepository.findMany({
    where: { projectId, ...(clientViewer ? { clientVisible: true } : {}) },
    include: { user: true, task: { select: { id: true, title: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return json(activities);
}
