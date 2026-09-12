import { randomUUID } from "crypto";
import { json } from "@/lib/http/response";
import {
  OrganizationRole,
  ProjectPriority,
  ProjectStatus,
} from "@/lib/domain/enums";
import {
  organizationMemberRepository,
  organizationInvitationRepository,
  organizationRepository,
  runInTransaction,
  userRepository,
} from "@/lib/repositories";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { sendOrganizationInvitationEmail } from "@/lib/email/invitation";

const CONTENT_MANAGER_ROLES = [
  OrganizationRole.OWNER,
  OrganizationRole.ADMIN,
  OrganizationRole.PROJECT_MANAGER,
] as const;

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET() {
  const currentUser = await requireCurrentUser();

  const memberships = await organizationMemberRepository.findMany({
    where: {
      userId: currentUser.id,
      role: { in: [...CONTENT_MANAGER_ROLES] },
    },
    include: {
      organization: {
        include: {
          clients: {
            include: {
              contacts: {
                include: { user: true },
                orderBy: [{ name: "asc" }, { email: "asc" }],
              },
            },
            orderBy: { name: "asc" },
          },
          members: {
            where: {
              role: { in: [...CONTENT_MANAGER_ROLES] },
            },
            include: { user: true },
            orderBy: { user: { name: "asc" } },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return json({
    currentUser: {
      id: currentUser.id,
      name: currentUser.name,
      email: currentUser.email,
    },
    organizations: memberships.map((membership) => ({
      id: membership.organization.id,
      name: membership.organization.name,
      currentUserRole: membership.role,
      canInvite:
        membership.role === OrganizationRole.OWNER ||
        membership.role === OrganizationRole.ADMIN,
      clients: membership.organization.clients.map((client) => ({
        id: client.id,
        name: client.name,
        contacts: client.contacts.map((contact) => ({
          id: contact.id,
          name: contact.name,
          email: contact.email,
          position: contact.position,
          userId: contact.userId,
        })),
      })),
      managers: membership.organization.members.map((member) => ({
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
        role: member.role,
      })),
    })),
  });
}

export async function POST(request: Request) {
  const currentUser = await requireCurrentUser();
  const body = await request.json();

  const organizationId =
    typeof body.organizationId === "string" ? body.organizationId : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!organizationId || !name) {
    return json(
      { error: "A szervezet és a projekt neve kötelező." },
      { status: 400 },
    );
  }

  const actorMembership = await organizationMemberRepository.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: currentUser.id,
      },
    },
  });

  if (
    !actorMembership ||
    !CONTENT_MANAGER_ROLES.includes(actorMembership.role as any)
  ) {
    return json(
      { error: "Nincs jogosultságod projektet létrehozni ebben a szervezetben." },
      { status: 403 },
    );
  }

  const ownerId =
    typeof body.ownerId === "string" && body.ownerId
      ? body.ownerId
      : currentUser.id;

  const ownerMembership = await organizationMemberRepository.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: ownerId,
      },
    },
  });

  if (
    !ownerMembership ||
    !CONTENT_MANAGER_ROLES.includes(ownerMembership.role as any)
  ) {
    return json(
      {
        error:
          "Projektvezetőnek tulajdonos, adminisztrátor vagy projektvezető választható.",
      },
      { status: 400 },
    );
  }

  const clientMode = body.client?.mode;
  const contactMode = body.contact?.mode ?? "none";

  if (clientMode !== "existing" && clientMode !== "new") {
    return json({ error: "Válassz ügyfelet." }, { status: 400 });
  }

  const startDate = parseDate(body.startDate);
  const dueDate = parseDate(body.dueDate);

  if (startDate && dueDate && dueDate < startDate) {
    return json(
      { error: "A határidő nem lehet korábbi a kezdési dátumnál." },
      { status: 400 },
    );
  }

  const status = Object.values(ProjectStatus).includes(body.status)
    ? body.status
    : ProjectStatus.PLANNING;

  const priority = Object.values(ProjectPriority).includes(body.priority)
    ? body.priority
    : ProjectPriority.MEDIUM;

  const organization = await organizationRepository.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  });

  if (!organization) {
    return json({ error: "A szervezet nem található." }, { status: 404 });
  }

  try {
    const result = await runInTransaction(async (tx) => {
      let client: { id: string; name: string };

      if (clientMode === "existing") {
        const clientId =
          typeof body.client.id === "string" ? body.client.id : "";

        const found = await tx.client.findFirst({
          where: { id: clientId, organizationId },
          select: { id: true, name: true },
        });

        if (!found) {
          throw new Error("A kiválasztott ügyfél nem található.");
        }

        client = found;
      } else {
        const clientName =
          typeof body.client.name === "string"
            ? body.client.name.trim()
            : "";

        if (!clientName) {
          throw new Error("Az új ügyfél neve kötelező.");
        }

        const existingClients = await tx.client.findMany({
          where: { organizationId },
          select: { id: true, name: true },
        });

        const duplicate = existingClients.find(
          (item) =>
            item.name.trim().toLocaleLowerCase("hu-HU") ===
            clientName.toLocaleLowerCase("hu-HU"),
        );

        if (duplicate) {
          throw new Error(
            `Már létezik „${duplicate.name}” nevű ügyfél. Válaszd ki a listából.`,
          );
        }

        client = await tx.client.create({
          data: {
            name: clientName,
            organizationId,
          },
          select: { id: true, name: true },
        });
      }

      let contact:
        | {
            id: string;
            name: string;
            email: string;
            userId: string | null;
          }
        | null = null;

      if (contactMode === "existing") {
        const contactId =
          typeof body.contact.id === "string" ? body.contact.id : "";

        contact = await tx.clientContact.findFirst({
          where: {
            id: contactId,
            clientId: client.id,
          },
          select: {
            id: true,
            name: true,
            email: true,
            userId: true,
          },
        });

        if (!contact) {
          throw new Error(
            "A kiválasztott kapcsolattartó nem ehhez az ügyfélhez tartozik.",
          );
        }
      } else if (contactMode === "new") {
        const contactName =
          typeof body.contact.name === "string"
            ? body.contact.name.trim()
            : "";
        const contactEmail =
          typeof body.contact.email === "string"
            ? body.contact.email.trim().toLowerCase()
            : "";
        const position =
          typeof body.contact.position === "string" &&
          body.contact.position.trim()
            ? body.contact.position.trim()
            : null;

        if (!contactName || !contactEmail || !contactEmail.includes("@")) {
          throw new Error(
            "Új kapcsolattartónál név és érvényes e-mail cím szükséges.",
          );
        }

        const duplicate = await tx.clientContact.findUnique({
          where: {
            clientId_email: {
              clientId: client.id,
              email: contactEmail,
            },
          },
        });

        if (duplicate) {
          throw new Error(
            "Ez az e-mail cím már kapcsolattartó ennél az ügyfélnél. Válaszd ki a listából.",
          );
        }

        const linkedUser = await tx.user.findUnique({
          where: { email: contactEmail },
          select: { id: true },
        });

        contact = await tx.clientContact.create({
          data: {
            clientId: client.id,
            name: contactName,
            email: contactEmail,
            position,
            userId: linkedUser?.id ?? null,
          },
          select: {
            id: true,
            name: true,
            email: true,
            userId: true,
          },
        });
      }

      const project = await tx.project.create({
        data: {
          name,
          description:
            typeof body.description === "string" && body.description.trim()
              ? body.description.trim()
              : null,
          organizationId,
          clientId: client.id,
          ownerId,
          status,
          priority,
          startDate,
          dueDate,
          progress: 0,
          members: {
            create: {
              userId: ownerId,
              role: "PROJECT_MANAGER",
            },
          },
          clientContacts: contact
            ? {
                create: {
                  clientContactId: contact.id,
                  isPrimary: true,
                },
              }
            : undefined,
        },
        select: {
          id: true,
          name: true,
        },
      });

      let invitation:
        | {
            id: string;
            email: string;
            token: string;
          }
        | null = null;

      const wantsInvitation = Boolean(body.sendInvitation);

      if (wantsInvitation && contact) {
        if (
          actorMembership.role !== OrganizationRole.OWNER &&
          actorMembership.role !== OrganizationRole.ADMIN
        ) {
          throw new Error(
            "Meghívót csak tulajdonos vagy adminisztrátor küldhet.",
          );
        }

        const existingUser = await tx.user.findUnique({
          where: { email: contact.email },
          select: { id: true },
        });

        const existingMembership = existingUser
          ? await tx.organizationMember.findUnique({
              where: {
                organizationId_userId: {
                  organizationId,
                  userId: existingUser.id,
                },
              },
            })
          : null;

        if (!existingMembership) {
          invitation = await tx.organizationInvitation.upsert({
            where: {
              organizationId_email: {
                organizationId,
                email: contact.email,
              },
            },
            update: {
              role: OrganizationRole.CLIENT,
              clientId: client.id,
              token: randomUUID(),
              invitedById: currentUser.id,
              expiresAt: new Date(
                Date.now() + 7 * 24 * 60 * 60 * 1000,
              ),
            },
            create: {
              organizationId,
              email: contact.email,
              role: OrganizationRole.CLIENT,
              clientId: client.id,
              token: randomUUID(),
              invitedById: currentUser.id,
              expiresAt: new Date(
                Date.now() + 7 * 24 * 60 * 60 * 1000,
              ),
            },
            select: {
              id: true,
              email: true,
              token: true,
            },
          });
        }
      }

      return {
        project,
        client,
        contact,
        invitation,
      };
    });

    let invitationResult:
      | {
          requested: boolean;
          created: boolean;
          emailSent: boolean;
          warning: string | null;
        }
      | undefined;

    if (body.sendInvitation) {
      if (result.invitation) {
        const delivery = await sendOrganizationInvitationEmail({
          invitationId: result.invitation.id,
          email: result.invitation.email,
          token: result.invitation.token,
          organizationName: organization.name,
          invitedByName: currentUser.name,
          roleLabel: "Ügyfél",
        });

        invitationResult = {
          requested: true,
          created: true,
          emailSent: delivery.sent,
          warning: delivery.warning,
        };
      } else {
        invitationResult = {
          requested: true,
          created: false,
          emailSent: false,
          warning:
            "A kapcsolattartó már tagja a szervezetnek, ezért nem készült új meghívó.",
        };
      }
    }

    return json(
      {
        projectId: result.project.id,
        projectName: result.project.name,
        clientId: result.client.id,
        clientName: result.client.name,
        contact: result.contact,
        invitation: invitationResult,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("PROJECT_SETUP_ERROR:", error);

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nem sikerült létrehozni a projektet.",
      },
      { status: 400 },
    );
  }
}
