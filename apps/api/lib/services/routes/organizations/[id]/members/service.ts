import { json } from "@/lib/http/response";
import { OrganizationRole } from "@/lib/domain/enums";
import {
  clientRepository,
  organizationMemberRepository,
  projectMemberRepository,
  runInTransaction,
  userRepository,
} from "@/lib/repositories";
import { requireCurrentUser } from "@/lib/auth/current-user";

type Ctx = {
  params: Promise<{ id: string }>;
};

const EDITABLE =
  new Set<OrganizationRole>([
    OrganizationRole.ADMIN,
    OrganizationRole.PROJECT_MANAGER,
    OrganizationRole.MEMBER,
    OrganizationRole.CONTRACTOR,
    OrganizationRole.CLIENT,
  ]);

const ORGANIZATION_MANAGERS = new Set<OrganizationRole>([
  OrganizationRole.OWNER,
  OrganizationRole.ADMIN,
]);

const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  email: true,
} as const;

async function actor(
  userId: string,
  organizationId: string,
) {
  return organizationMemberRepository.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
  });
}

function parseRole(value: unknown) {
  return (
    typeof value === "string" &&
    EDITABLE.has(
      value as OrganizationRole,
    )
  )
    ? (value as OrganizationRole)
    : null;
}

function canManageRole(
  actorRole: OrganizationRole,
  role: OrganizationRole,
) {
  return !(
    actorRole ===
      OrganizationRole.ADMIN &&
    role ===
      OrganizationRole.ADMIN
  );
}

async function validateClient(
  organizationId: string,
  clientId: unknown,
) {
  if (
    typeof clientId !== "string" ||
    !clientId
  ) {
    return null;
  }

  return clientRepository.findFirst({
    where: {
      id: clientId,
      organizationId,
    },
    select: {
      id: true,
      name: true,
    },
  });
}

async function getProjectRemovalPlan(
  userId: string,
  organizationId: string,
) {
  const memberships =
    await projectMemberRepository.findMany({
      where: {
        userId,
        project: {
          organizationId,
        },
      },
      select: {
        projectId: true,
        role: true,
        project: {
          select: {
            ownerId: true,
          },
        },
      },
    });

  const projectIds = [
    ...new Set(
      memberships.map(
        (membership) =>
          membership.projectId,
      ),
    ),
  ];

  const replacementByProject =
    new Map<string, string>();

  for (const membership of memberships) {
    const needsReplacement =
      membership.role ===
        "PROJECT_MANAGER" ||
      membership.project
        .ownerId === userId;

    if (!needsReplacement) {
      continue;
    }

    const replacement =
      await projectMemberRepository.findFirst({
        where: {
          projectId:
            membership.projectId,
          role:
            "PROJECT_MANAGER",
          userId: {
            not: userId,
          },
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          userId: true,
        },
      });

    if (!replacement) {
      return {
        ok: false as const,
        projectIds,
        replacementByProject,
      };
    }

    replacementByProject.set(
      membership.projectId,
      replacement.userId,
    );
  }

  return {
    ok: true as const,
    projectIds,
    replacementByProject,
  };
}

export async function POST(
  request: Request,
  { params }: Ctx,
) {
  const {
    id: organizationId,
  } = await params;

  const currentUser =
    await requireCurrentUser();

  const a = await actor(
    currentUser.id,
    organizationId,
  );

  if (
    !a ||
    !ORGANIZATION_MANAGERS.has(a.role)
  ) {
    return json(
      {
        error:
          "Nincs jogosultságod tagot hozzáadni.",
      },
      { status: 403 },
    );
  }

  const body =
    await request.json();

  const email =
    typeof body.email === "string"
      ? body.email
          .trim()
          .toLowerCase()
      : "";

  const role = parseRole(
    body.role,
  );

  if (!email || !role) {
    return json(
      {
        error:
          "Érvényes e-mail és szerepkör szükséges.",
      },
      { status: 400 },
    );
  }

  if (
    !canManageRole(a.role, role)
  ) {
    return json(
      {
        error:
          "Adminisztrátori szerepkört csak a tulajdonos adhat.",
      },
      { status: 403 },
    );
  }

  const user =
    await userRepository.findUnique({
      where: { email },
      select:
        PUBLIC_USER_SELECT,
    });

  if (!user) {
    return json(
      {
        error:
          "Ezzel az e-mail címmel még nincs regisztrált felhasználó. Küldj neki meghívót.",
      },
      { status: 404 },
    );
  }

  const existing =
    await organizationMemberRepository.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: user.id,
        },
      },
    });

  if (existing) {
    return json(
      {
        error:
          "Ez a felhasználó már tagja a szervezetnek.",
      },
      { status: 409 },
    );
  }

  let client:
    | {
        id: string;
        name: string;
      }
    | null = null;

  if (
    role ===
    OrganizationRole.CLIENT
  ) {
    client = await validateClient(
      organizationId,
      body.clientId,
    );

    if (!client) {
      return json(
        {
          error:
            "Ügyfél szerepkörnél válassz a szervezethez tartozó ügyfélcéget.",
        },
        { status: 400 },
      );
    }
  }

  const membership =
    await runInTransaction(
      async (tx) => {
        const created =
          await tx.organizationMember.create({
            data: {
              organizationId,
              userId: user.id,
              role,
            },
            include: {
              user: {
                select:
                  PUBLIC_USER_SELECT,
              },
            },
          });

        if (
          role ===
            OrganizationRole.CLIENT &&
          client
        ) {
          await tx.clientContact.upsert({
            where: {
              clientId_email: {
                clientId:
                  client.id,
                email:
                  user.email.toLowerCase(),
              },
            },
            update: {
              userId:
                user.id,
            },
            create: {
              clientId:
                client.id,
              userId:
                user.id,
              name: user.name,
              email:
                user.email.toLowerCase(),
            },
          });
        }

        return created;
      },
    );

  return json(
    {
      ...membership,
      clientId:
        client?.id ?? null,
      clientName:
        client?.name ?? null,
    },
    { status: 201 },
  );
}

export async function PATCH(
  request: Request,
  { params }: Ctx,
) {
  const {
    id: organizationId,
  } = await params;

  const currentUser =
    await requireCurrentUser();

  const a = await actor(
    currentUser.id,
    organizationId,
  );

  if (
    !a ||
    !ORGANIZATION_MANAGERS.has(a.role)
  ) {
    return json(
      {
        error:
          "Nincs jogosultságod.",
      },
      { status: 403 },
    );
  }

  const body =
    await request.json();

  const memberId =
    typeof body.memberId ===
    "string"
      ? body.memberId
      : "";

  const role = parseRole(
    body.role,
  );

  if (!memberId || !role) {
    return json(
      {
        error:
          "Érvénytelen kérés.",
      },
      { status: 400 },
    );
  }

  const target =
    await organizationMemberRepository.findFirst({
      where: {
        id: memberId,
        organizationId,
      },
      include: {
        user: {
          select:
            PUBLIC_USER_SELECT,
        },
      },
    });

  if (!target) {
    return json(
      {
        error:
          "Tag nem található.",
      },
      { status: 404 },
    );
  }

  if (
    target.role ===
    OrganizationRole.OWNER
  ) {
    return json(
      {
        error:
          "A tulajdonos szerepköre itt nem módosítható.",
      },
      { status: 400 },
    );
  }

  if (
    a.role ===
      OrganizationRole.ADMIN &&
    (target.role ===
      OrganizationRole.ADMIN ||
      role ===
        OrganizationRole.ADMIN)
  ) {
    return json(
      {
        error:
          "Adminisztrátori szerepkört csak a tulajdonos kezelhet.",
      },
      { status: 403 },
    );
  }

  let client:
    | {
        id: string;
        name: string;
      }
    | null = null;

  if (
    role ===
    OrganizationRole.CLIENT
  ) {
    client = await validateClient(
      organizationId,
      body.clientId,
    );

    if (!client) {
      return json(
        {
          error:
            "Ügyfél szerepkörre váltáskor válassz ügyfélcéget.",
        },
        { status: 400 },
      );
    }
  }

  const crossingToClient =
    target.role !==
      OrganizationRole.CLIENT &&
    role ===
      OrganizationRole.CLIENT;

  const leavingClient =
    target.role ===
      OrganizationRole.CLIENT &&
    role !==
      OrganizationRole.CLIENT;

  let removalPlan:
    | Awaited<
        ReturnType<
          typeof getProjectRemovalPlan
        >
      >
    | null = null;

  if (crossingToClient) {
    removalPlan =
      await getProjectRemovalPlan(
        target.userId,
        organizationId,
      );

    if (!removalPlan.ok) {
      return json(
        {
          error:
            "A felhasználó nem állítható ügyfél szerepkörre, mert legalább egy projektben ő az egyetlen projektvezető. Előbb adj hozzá másik projektvezetőt.",
        },
        { status: 409 },
      );
    }
  }

  const updated =
    await runInTransaction(
      async (tx) => {
        if (
          crossingToClient &&
          removalPlan
        ) {
          for (const [
            projectId,
            replacementUserId,
          ] of removalPlan.replacementByProject) {
            await tx.project.updateMany({
              where: {
                id: projectId,
                ownerId:
                  target.userId,
              },
              data: {
                ownerId:
                  replacementUserId,
              },
            });
          }

          if (
            removalPlan.projectIds
              .length
          ) {
            await tx.task.updateMany({
              where: {
                assigneeId:
                  target.userId,
                projectId: {
                  in: removalPlan.projectIds,
                },
              },
              data: {
                assigneeId: null,
              },
            });
          }

          await tx.projectMember.deleteMany({
            where: {
              userId:
                target.userId,
              project: {
                organizationId,
              },
            },
          });
        }

        if (leavingClient) {
          // CRM-adatot nem törlünk. Csak a ProjectFlow user-linket oldjuk fel.
          await tx.clientContact.updateMany({
            where: {
              userId:
                target.userId,
              client: {
                organizationId,
              },
            },
            data: {
              userId: null,
            },
          });
        }

        if (
          role ===
            OrganizationRole.CLIENT &&
          client
        ) {
          // Ha másik ügyfélcégre kerül át, a régi user-linkeket bontjuk,
          // de a CRM kapcsolattartó rekordokat megtartjuk.
          await tx.clientContact.updateMany({
            where: {
              userId:
                target.userId,
              client: {
                organizationId,
              },
              clientId: {
                not: client.id,
              },
            },
            data: {
              userId: null,
            },
          });

          await tx.clientContact.upsert({
            where: {
              clientId_email: {
                clientId:
                  client.id,
                email:
                  target.user.email.toLowerCase(),
              },
            },
            update: {
              userId:
                target.userId,
            },
            create: {
              clientId:
                client.id,
              userId:
                target.userId,
              name:
                target.user.name,
              email:
                target.user.email.toLowerCase(),
            },
          });
        }

        const membership =
          await tx.organizationMember.update({
            where: {
              id: target.id,
            },
            data: { role },
            include: {
              user: {
                select:
                  PUBLIC_USER_SELECT,
              },
            },
          });

        return membership;
      },
    );

  return json({
    ...updated,
    clientId:
      client?.id ?? null,
    clientName:
      client?.name ?? null,
  });
}

export async function DELETE(
  request: Request,
  { params }: Ctx,
) {
  const {
    id: organizationId,
  } = await params;

  const currentUser =
    await requireCurrentUser();

  const a = await actor(
    currentUser.id,
    organizationId,
  );

  if (
    !a ||
    !ORGANIZATION_MANAGERS.has(a.role)
  ) {
    return json(
      {
        error:
          "Nincs jogosultságod.",
      },
      { status: 403 },
    );
  }

  const body =
    await request.json();

  const memberId =
    typeof body.memberId ===
    "string"
      ? body.memberId
      : "";

  const target =
    await organizationMemberRepository.findFirst({
      where: {
        id: memberId,
        organizationId,
      },
      include: {
        user: {
          select:
            PUBLIC_USER_SELECT,
        },
      },
    });

  if (!target) {
    return json(
      {
        error:
          "Tag nem található.",
      },
      { status: 404 },
    );
  }

  if (
    target.role ===
    OrganizationRole.OWNER
  ) {
    return json(
      {
        error:
          "A szervezet tulajdonosa nem távolítható el.",
      },
      { status: 400 },
    );
  }

  if (
    a.role ===
      OrganizationRole.ADMIN &&
    target.role ===
      OrganizationRole.ADMIN
  ) {
    return json(
      {
        error:
          "Adminisztrátort csak a tulajdonos távolíthat el.",
      },
      { status: 403 },
    );
  }

  const removalPlan =
    await getProjectRemovalPlan(
      target.userId,
      organizationId,
    );

  if (!removalPlan.ok) {
    return json(
      {
        error:
          "A tag nem távolítható el, mert legalább egy projektben ő az egyetlen projektvezető. Előbb adj hozzá másik projektvezetőt.",
      },
      { status: 409 },
    );
  }

  await runInTransaction(
    async (tx) => {
      for (const [
        projectId,
        replacementUserId,
      ] of removalPlan.replacementByProject) {
        await tx.project.updateMany({
          where: {
            id: projectId,
            ownerId:
              target.userId,
          },
          data: {
            ownerId:
              replacementUserId,
          },
        });
      }

      if (
        removalPlan.projectIds.length
      ) {
        await tx.task.updateMany({
          where: {
            assigneeId:
              target.userId,
            projectId: {
              in:
                removalPlan.projectIds,
            },
          },
          data: {
            assigneeId: null,
          },
        });
      }

      await tx.projectMember.deleteMany({
        where: {
          userId:
            target.userId,
          project: {
            organizationId,
          },
        },
      });

      // A CRM kapcsolattartó rekord megmarad, csak a belépési kapcsolat szűnik meg.
      await tx.clientContact.updateMany({
        where: {
          userId:
            target.userId,
          client: {
            organizationId,
          },
        },
        data: {
          userId: null,
        },
      });

      await tx.organizationMember.delete({
        where: {
          id: target.id,
        },
      });
    },
  );

  return json({
    success: true,
  });
}
