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
import {
  buildTaskPermissions,
  getProjectTaskAccessContext,
} from "@/lib/tasks/access";

const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  email: true,
} as const;

export async function GET(
  _: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  const { id } = await params;
  const currentUser =
    await requireCurrentUser();

  try {
    await requireProjectAccess(
      currentUser.id,
      id,
    );
  } catch {
    return json(
      {
        error:
          "Ehhez a projekthez nincs hozzáférésed.",
      },
      { status: 403 },
    );
  }

  const [
    canManageTeam,
    canManage,
    clientViewer,
    taskAccessContext,
  ] = await Promise.all([
    canManageProjectMembers(
      currentUser.id,
      id,
    ),
    canManageProject(
      currentUser.id,
      id,
    ),
    isClientProjectViewer(
      currentUser.id,
      id,
    ),
    getProjectTaskAccessContext(
      currentUser.id,
      id,
    ),
  ]);

  const project =
    await projectRepository.findUnique({
      where: { id },
      include: {
        client: {
          include: {
            contacts: {
              orderBy: [
                { name: "asc" },
                { email: "asc" },
              ],
            },
          },
        },
        clientContacts: {
          include: {
            clientContact: {
              include: {
                user: {
                  select:
                    PUBLIC_USER_SELECT,
                },
              },
            },
          },
          orderBy: [
            { isPrimary: "desc" },
            { createdAt: "asc" },
          ],
        },
        owner: {
          select: PUBLIC_USER_SELECT,
        },
        tasks: {
          where: clientViewer
            ? {
                clientVisible: true,
              }
            : undefined,
          include: {
            assignee: {
              select:
                PUBLIC_USER_SELECT,
            },
            creator: {
              select:
                PUBLIC_USER_SELECT,
            },
            milestone: true,
            approvals: {
              include: {
                approver: {
                  select:
                    PUBLIC_USER_SELECT,
                },
              },
              orderBy: {
                createdAt: "asc",
              },
            },
            comments: {
              where: clientViewer
                ? {
                    visibility:
                      "CLIENT_VISIBLE",
                  }
                : undefined,
              include: {
                author: {
                  select:
                    PUBLIC_USER_SELECT,
                },
              },
              orderBy: {
                createdAt: "asc",
              },
            },
          },
          orderBy: [
            { dueDate: "asc" },
            { createdAt: "asc" },
          ],
        },
        members: {
          include: {
            user: {
              select:
                PUBLIC_USER_SELECT,
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        milestones: {
          orderBy: [
            { dueDate: "asc" },
            { createdAt: "asc" },
          ],
        },
      },
    });

  if (
    !project ||
    !taskAccessContext
  ) {
    return json(
      {
        error:
          "Projekt nem található.",
      },
      { status: 404 },
    );
  }

  const [
    candidates,
    assignableMemberships,
    activities,
  ] = await Promise.all([
    canManageTeam &&
    project.organizationId
      ? organizationMemberRepository.findMany({
          where: {
            organizationId:
              project.organizationId,
            user: {
              projectMemberships: {
                none: {
                  projectId:
                    project.id,
                },
              },
            },
            OR: [
              {
                role: {
                  not: "CLIENT",
                },
              },
              {
                role: "CLIENT",
                user: {
                  clientContacts: {
                    some: {
                      clientId:
                        project.clientId,
                    },
                  },
                },
              },
            ],
          },
          include: {
            user: {
              select:
                PUBLIC_USER_SELECT,
            },
          },
          orderBy: {
            user: {
              name: "asc",
            },
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
      include: {
        user: {
          select: PUBLIC_USER_SELECT,
        },
      },
      orderBy: {
        user: {
          name: "asc",
        },
      },
    }),

    activityLogRepository.findMany({
      where: {
        projectId: project.id,
        ...(clientViewer
          ? {
              clientVisible: true,
            }
          : {}),
      },
      include: {
        user: {
          select: PUBLIC_USER_SELECT,
        },
        task: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    }),
  ]);

  const taskMembers =
    assignableMemberships.map(
      (member) => ({
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
        role: member.role,
      }),
    );

  if (
    !taskMembers.some(
      (member) =>
        member.id ===
        project.owner.id,
    )
  ) {
    taskMembers.unshift({
      id: project.owner.id,
      name: project.owner.name,
      email: project.owner.email,
      role:
        ProjectRole.PROJECT_MANAGER,
    });
  }

  const approvalCandidateMap =
    new Map<
      string,
      {
        id: string;
        name: string;
        email: string;
        source: string;
        clientApprover: boolean;
      }
    >();

  if (!clientViewer) {
    for (const member of project.members) {
      approvalCandidateMap.set(
        member.user.id,
        {
          id: member.user.id,
          name: member.user.name,
          email:
            member.user.email,
          source:
            member.role ===
            ProjectRole.CLIENT
              ? "Ügyfél"
              : "Projektcsapat",
          clientApprover:
            member.role ===
            ProjectRole.CLIENT,
        },
      );
    }

    approvalCandidateMap.set(
      project.owner.id,
      {
        id: project.owner.id,
        name: project.owner.name,
        email:
          project.owner.email,
        source:
          "Projektvezető",
        clientApprover: false,
      },
    );

    for (const link of project.clientContacts) {
      const contactUser =
        link.clientContact.user;

      if (!contactUser) continue;

      approvalCandidateMap.set(
        contactUser.id,
        {
          id: contactUser.id,
          name: contactUser.name,
          email:
            contactUser.email,
          source:
            "Ügyfél-kapcsolattartó",
          clientApprover: true,
        },
      );
    }
  }

  const approvalCandidates = [
    ...approvalCandidateMap.values(),
  ].sort((a, b) =>
    a.name.localeCompare(
      b.name,
      "hu",
    ),
  );

  const projectForUser = {
    ...project,

    // Ügyfélnek nincs szüksége a teljes projektcsapat listájára.
    members: clientViewer
      ? []
      : project.members,

    // Ügyfélnek nem küldjük vissza a többi approver részletes
    // adatait. A saját approval külön myApproval mezőben érkezik.
    tasks: project.tasks
      .map((task) => {
        const myApproval =
          task.approvals.find(
            (approval) =>
              approval.approverId ===
              currentUser.id,
          ) ?? null;

        const permissions =
          buildTaskPermissions(
            taskAccessContext,
            task,
            myApproval,
          );

        return {
          ...task,
          approvals: clientViewer
            ? myApproval
              ? [myApproval]
              : []
            : task.approvals,
          myApproval,
          permissions,
        };
      })
      .filter(
        (task) =>
          task.permissions.canView,
      ),
  };

  return json({
    project: projectForUser,
    currentUserId:
      currentUser.id,
    canManage,
    canManageTeam,
    clientViewer,
    candidates:
      clientViewer
        ? []
        : candidates.map(
            (member) => ({
              userId:
                member.userId,
              name:
                member.user.name,
              email:
                member.user.email,
              organizationRole:
                member.role,
            }),
          ),
    taskMembers:
      clientViewer
        ? []
        : taskMembers,
    approvalCandidates,
    activities,
  });
}
