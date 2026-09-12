import { json } from "@/lib/http/response";
import { ProjectRole } from "@/lib/domain/enums";
import {
  activityLogRepository,
  organizationMemberRepository,
  projectMemberRepository,
  projectRepository,
} from "@/lib/repositories";
import { requireCurrentUser } from "@/lib/auth/current-user";
import {
  canManageProject,
  canManageProjectMembers,
  isClientProjectViewer,
  requireProjectAccess,
} from "@/lib/permissions";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const currentUser = await requireCurrentUser();

  try {
    await requireProjectAccess(currentUser.id, id);
  } catch {
    return json(
      { error: "Ehhez a projekthez nincs hozzáférésed." },
      { status: 403 },
    );
  }

  const [canManageTeam, canManage, clientViewer] =
    await Promise.all([
      canManageProjectMembers(currentUser.id, id),
      canManageProject(currentUser.id, id),
      isClientProjectViewer(currentUser.id, id),
    ]);

  const project = await projectRepository.findUnique({
    where: { id },
    include: {
      client: {
        include: {
          contacts: {
            orderBy: [{ name: "asc" }, { email: "asc" }],
          },
        },
      },
      clientContacts: {
        include: {
          clientContact: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: [
          { isPrimary: "desc" },
          { createdAt: "asc" },
        ],
      },
      owner: true,
      tasks: {
        where: clientViewer
          ? { clientVisible: true }
          : undefined,
        include: {
          assignee: true,
          creator: true,
          milestone: true,
          approvals: {
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
          },
          comments: {
            where: clientViewer
              ? { visibility: "CLIENT_VISIBLE" }
              : undefined,
            include: { author: true },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: [
          { dueDate: "asc" },
          { createdAt: "asc" },
        ],
      },
      members: {
        include: { user: true },
        orderBy: { createdAt: "asc" },
      },
      milestones: {
        orderBy: [
          { dueDate: "asc" },
          { createdAt: "asc" },
        ],
      },
    },
  });

  if (!project) {
    return json(
      { error: "Projekt nem található." },
      { status: 404 },
    );
  }

  const [candidates, assignableMemberships, activities] =
    await Promise.all([
      canManageTeam && project.organizationId
        ? organizationMemberRepository.findMany({
            where: {
              organizationId: project.organizationId,
              user: {
                projectMemberships: {
                  none: { projectId: project.id },
                },
              },
              OR: [
                { role: { not: "CLIENT" } },
                {
                  role: "CLIENT",
                  user: {
                    clientContacts: {
                      some: {
                        clientId: project.clientId,
                      },
                    },
                  },
                },
              ],
            },
            include: { user: true },
            orderBy: {
              user: { name: "asc" },
            },
          })
        : Promise.resolve([]),

      projectMemberRepository.findMany({
        where: {
          projectId: project.id,
          role: {
            in: [
              ProjectRole.PROJECT_MANAGER,
              ProjectRole.MEMBER,
              ProjectRole.CONTRACTOR,
            ],
          },
        },
        include: { user: true },
        orderBy: {
          user: { name: "asc" },
        },
      }),

      activityLogRepository.findMany({
        where: {
          projectId: project.id,
          ...(clientViewer
            ? { clientVisible: true }
            : {}),
        },
        include: {
          user: true,
          task: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

  const taskMembers = assignableMemberships.map(
    (member) => ({
      id: member.user.id,
      name: member.user.name,
      email: member.user.email,
      role: member.role,
    }),
  );

  if (
    !taskMembers.some(
      (member) => member.id === project.owner.id,
    )
  ) {
    taskMembers.unshift({
      id: project.owner.id,
      name: project.owner.name,
      email: project.owner.email,
      role: ProjectRole.PROJECT_MANAGER,
    });
  }

  const approvalCandidateMap = new Map<
    string,
    {
      id: string;
      name: string;
      email: string;
      source: string;
    }
  >();

  for (const member of project.members) {
    approvalCandidateMap.set(member.user.id, {
      id: member.user.id,
      name: member.user.name,
      email: member.user.email,
      source:
        member.role === ProjectRole.CLIENT
          ? "Ügyfél"
          : "Projektcsapat",
    });
  }

  approvalCandidateMap.set(project.owner.id, {
    id: project.owner.id,
    name: project.owner.name,
    email: project.owner.email,
    source: "Projektvezető",
  });

  for (const link of project.clientContacts) {
    const contactUser = link.clientContact.user;

    if (!contactUser) continue;

    approvalCandidateMap.set(contactUser.id, {
      id: contactUser.id,
      name: contactUser.name,
      email: contactUser.email,
      source: "Ügyfél-kapcsolattartó",
    });
  }

  const approvalCandidates = [
    ...approvalCandidateMap.values(),
  ].sort((a, b) =>
    a.name.localeCompare(b.name, "hu"),
  );

  return json({
    project,
    currentUserId: currentUser.id,
    canManage,
    canManageTeam,
    clientViewer,
    candidates: candidates.map((member) => ({
      userId: member.userId,
      name: member.user.name,
      email: member.user.email,
      organizationRole: member.role,
    })),
    taskMembers,
    approvalCandidates,
    activities,
  });
}
