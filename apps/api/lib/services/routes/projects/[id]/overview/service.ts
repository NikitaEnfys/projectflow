import { json } from "@/lib/http/response";
import { ProjectRole } from "@/lib/domain/enums";
import { activityLogRepository, organizationMemberRepository, projectMemberRepository, projectRepository } from "@/lib/repositories";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { canManageProject, canManageProjectMembers, isClientProjectViewer, requireProjectAccess } from "@/lib/permissions";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const currentUser = await requireCurrentUser();
  try {
    await requireProjectAccess(currentUser.id, id);
  } catch {
    return json({ error: "Ehhez a projekthez nincs hozzáférésed." }, { status: 403 });
  }
  const [canManageTeam, canManage, clientViewer] = await Promise.all([
    canManageProjectMembers(currentUser.id, id),
    canManageProject(currentUser.id, id),
    isClientProjectViewer(currentUser.id, id),
  ]);
  const project = await projectRepository.findUnique({
    where: { id },
    include: {
      client: true,
      owner: true,
      tasks: {
        where: clientViewer ? { clientVisible: true } : undefined,
        include: {
          assignee: true,
          creator: true,
          milestone: true,
          comments: {
            where: clientViewer ? { visibility: "CLIENT_VISIBLE" } : undefined,
            include: { author: true },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      },
      members: { include: { user: true }, orderBy: { createdAt: "asc" } },
      milestones: { orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!project) return json({ error: "Projekt nem található." }, { status: 404 });

  const [candidates, assignableMemberships, activities] = await Promise.all([
    canManageTeam && project.organizationId
      ? organizationMemberRepository.findMany({
          where: {
            organizationId: project.organizationId,
            user: { projectMemberships: { none: { projectId: project.id } } },
            OR: [
              { role: { not: "CLIENT" } },
              { role: "CLIENT", user: { clientContacts: { some: { clientId: project.clientId } } } },
            ],
          },
          include: { user: true },
          orderBy: { user: { name: "asc" } },
        })
      : Promise.resolve([]),
    projectMemberRepository.findMany({
      where: { projectId: project.id, role: { in: [ProjectRole.PROJECT_MANAGER, ProjectRole.MEMBER, ProjectRole.CONTRACTOR] } },
      include: { user: true },
      orderBy: { user: { name: "asc" } },
    }),
    activityLogRepository.findMany({
      where: { projectId: project.id, ...(clientViewer ? { clientVisible: true } : {}) },
      include: { user: true, task: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const taskMembers = assignableMemberships.map((member) => ({ id: member.user.id, name: member.user.name, email: member.user.email, role: member.role }));
  if (!taskMembers.some((member) => member.id === project.owner.id)) {
    taskMembers.unshift({ id: project.owner.id, name: project.owner.name, email: project.owner.email, role: ProjectRole.PROJECT_MANAGER });
  }
  return json({
    project,
    currentUserId: currentUser.id,
    canManage,
    canManageTeam,
    clientViewer,
    candidates: candidates.map((m) => ({ userId: m.userId, name: m.user.name, email: m.user.email, organizationRole: m.role })),
    taskMembers,
    activities,
  });
}
