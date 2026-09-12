import { json } from "@/lib/http/response";
import {
  OrganizationRole,
  ProjectPriority,
  ProjectStatus,
} from "@/lib/domain/enums";
import {
  clientContactRepository,
  clientRepository,
  organizationMemberRepository,
  projectRepository,
} from "@/lib/repositories";
import {
  getCurrentAccessContext,
  projectVisibilityWhere,
} from "@/lib/auth/access";
import { canCreateProject } from "@/lib/permissions";

const PROJECT_OWNER_ROLES = new Set([
  OrganizationRole.OWNER,
  OrganizationRole.ADMIN,
  OrganizationRole.PROJECT_MANAGER,
]);

const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  email: true,
} as const;

function parseDate(value: unknown) {
  if (
    typeof value !== "string" ||
    !value
  ) {
    return null;
  }

  const date = new Date(
    `${value}T00:00:00`,
  );

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

export async function GET() {
  const {
    user,
    oversightOrganizationIds,
    linkedProjectIds,
  } = await getCurrentAccessContext();

  const projects =
    await projectRepository.findMany({
      where: projectVisibilityWhere(
        user.id,
        oversightOrganizationIds,
        linkedProjectIds,
      ),
      include: {
        client: true,
        owner: {
          select: PUBLIC_USER_SELECT,
        },
        clientContacts: {
          include: {
            clientContact: true,
          },
          orderBy: [
            { isPrimary: "desc" },
            { createdAt: "asc" },
          ],
        },
        members: {
          include: {
            user: {
              select: PUBLIC_USER_SELECT,
            },
          },
        },
        milestones: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

  return json(projects);
}

export async function POST(
  req: Request,
) {
  try {
    const { user } =
      await getCurrentAccessContext();

    const body = await req.json();

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    if (
      !name ||
      !body.clientId ||
      !body.ownerId
    ) {
      return json(
        {
          error:
            "A projekt neve, ügyfele és felelőse kötelező.",
        },
        { status: 400 },
      );
    }

    const client =
      await clientRepository.findUnique({
        where: {
          id: body.clientId,
        },
        select: {
          organizationId: true,
        },
      });

    if (!client?.organizationId) {
      return json(
        {
          error:
            "A kiválasztott ügyfél nem található vagy nincs szervezethez rendelve.",
        },
        { status: 404 },
      );
    }

    if (
      !(await canCreateProject(
        user.id,
        client.organizationId,
      ))
    ) {
      return json(
        {
          error:
            "Nincs jogosultságod projektet létrehozni.",
        },
        { status: 403 },
      );
    }

    const ownerMembership =
      await organizationMemberRepository.findUnique({
        where: {
          organizationId_userId: {
            organizationId:
              client.organizationId,
            userId: body.ownerId,
          },
        },
      });

    if (!ownerMembership) {
      return json(
        {
          error:
            "A kiválasztott felelős nem tagja az ügyfél szervezetének.",
        },
        { status: 400 },
      );
    }

    if (
      !PROJECT_OWNER_ROLES.has(
        ownerMembership.role,
      )
    ) {
      return json(
        {
          error:
            "Projektvezetőnek csak tulajdonos, adminisztrátor vagy projektvezető szerepkörű szervezeti tag választható.",
        },
        { status: 400 },
      );
    }

    const requestedContactIds =
      Array.isArray(
        body.clientContactIds,
      )
        ? [
            ...new Set(
              body.clientContactIds.filter(
                (
                  id: unknown,
                ): id is string =>
                  typeof id === "string" &&
                  Boolean(id),
              ),
            ),
          ]
        : [];

    const primaryClientContactId =
      typeof body.primaryClientContactId ===
      "string"
        ? body.primaryClientContactId
        : null;

    if (
      primaryClientContactId &&
      !requestedContactIds.includes(
        primaryClientContactId,
      )
    ) {
      return json(
        {
          error:
            "Az elsődleges kapcsolattartónak a kijelölt kapcsolattartók között kell lennie.",
        },
        { status: 400 },
      );
    }

    if (requestedContactIds.length) {
      const selectedContacts =
        await clientContactRepository.findMany({
          where: {
            clientId: body.clientId,
            id: {
              in: requestedContactIds,
            },
          },
          select: { id: true },
        });

      if (
        selectedContacts.length !==
        requestedContactIds.length
      ) {
        return json(
          {
            error:
              "Legalább egy kiválasztott kapcsolattartó nem ehhez az ügyfélhez tartozik.",
          },
          { status: 400 },
        );
      }
    }

    const startDate =
      parseDate(body.startDate);
    const dueDate =
      parseDate(body.dueDate);

    if (
      startDate &&
      dueDate &&
      dueDate < startDate
    ) {
      return json(
        {
          error:
            "A határidő nem lehet korábbi a kezdési dátumnál.",
        },
        { status: 400 },
      );
    }

    const status =
      Object.values(
        ProjectStatus,
      ).includes(body.status)
        ? body.status
        : ProjectStatus.PLANNING;

    const priority =
      Object.values(
        ProjectPriority,
      ).includes(body.priority)
        ? body.priority
        : ProjectPriority.MEDIUM;

    const progress =
      Number.isInteger(body.progress)
        ? Math.min(
            100,
            Math.max(
              0,
              body.progress,
            ),
          )
        : 0;

    const effectivePrimary =
      primaryClientContactId ??
      requestedContactIds[0] ??
      null;

    const project =
      await projectRepository.create({
        data: {
          name,
          description:
            typeof body.description ===
              "string" &&
            body.description.trim()
              ? body.description.trim()
              : null,
          clientId: body.clientId,
          ownerId: body.ownerId,
          organizationId:
            client.organizationId,
          status,
          priority,
          startDate,
          dueDate,
          progress,
          members: {
            create: {
              userId: body.ownerId,
              role: "PROJECT_MANAGER",
            },
          },
          clientContacts:
            requestedContactIds.length
              ? {
                  create:
                    requestedContactIds.map(
                      (
                        clientContactId,
                      ) => ({
                        clientContactId,
                        isPrimary:
                          clientContactId ===
                          effectivePrimary,
                      }),
                    ),
                }
              : undefined,
        },
        include: {
          client: true,
          owner: {
            select:
              PUBLIC_USER_SELECT,
          },
          clientContacts: {
            include: {
              clientContact: true,
            },
          },
          members: {
            include: {
              user: {
                select:
                  PUBLIC_USER_SELECT,
              },
            },
          },
          milestones: true,
        },
      });

    return json(project, {
      status: 201,
    });
  } catch (error) {
    console.error(
      "PROJECT_CREATE_ERROR:",
      error,
    );

    return json(
      {
        error:
          "Nem sikerült létrehozni a projektet.",
        details:
          error instanceof Error
            ? error.message
            : "Ismeretlen hiba",
      },
      { status: 500 },
    );
  }
}
