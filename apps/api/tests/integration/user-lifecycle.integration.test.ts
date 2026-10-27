import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import {
  CommentVisibility,
  OrganizationRole,
  ProjectRole,
  TaskApprovalDecision,
  TaskStatus,
} from "@/lib/domain/enums";

const runId =
  `life-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

const lifecycleEmail =
  `${runId}@integration.projectflow.test`;

type Fixture = {
  ownerId: string;
  lifecycleUserId: string;
  organizationId: string;
  clientId: string;
  projectId: string;
  contactId: string;
  taskId: string;
  approvalId: string;
};

const fixture: Partial<Fixture> = {};
let prismaModule:
  typeof import("@/lib/prisma");
let accessModule:
  typeof import("@/lib/tasks/access");
let invitationModule:
  typeof import("@/lib/invitations/apply-membership");

describe(
  "teljes ügyfél-felhasználói lifecycle – PostgreSQL integration",
  () => {
    beforeAll(async () => {
      if (
        !process.env.TEST_DATABASE_URL
      ) {
        throw new Error(
          "TEST_DATABASE_URL szükséges az integration teszthez.",
        );
      }

      prismaModule =
        await import("@/lib/prisma");
      accessModule =
        await import("@/lib/tasks/access");
      invitationModule =
        await import(
          "@/lib/invitations/apply-membership"
        );

      const { prisma } = prismaModule;

      const owner =
        await prisma.user.create({
          data: {
            name:
              "Lifecycle Owner",
            email:
              `${runId}-owner@integration.projectflow.test`,
          },
        });
      fixture.ownerId = owner.id;

      const organization =
        await prisma.organization.create({
          data: {
            name:
              `Lifecycle Organization ${runId}`,
            members: {
              create: {
                userId: owner.id,
                role:
                  OrganizationRole.OWNER,
              },
            },
          },
        });
      fixture.organizationId =
        organization.id;

      const client =
        await prisma.client.create({
          data: {
            name:
              `Lifecycle Client ${runId}`,
            organizationId:
              organization.id,
          },
        });
      fixture.clientId = client.id;

      const existingCrmContact =
        await prisma.clientContact.create({
          data: {
            clientId: client.id,
            name:
              "CRM-ben tárolt név",
            email:
              lifecycleEmail,
            position:
              "Kapcsolattartó",
          },
        });
      fixture.contactId =
        existingCrmContact.id;

      const project =
        await prisma.project.create({
          data: {
            name:
              `Lifecycle Project ${runId}`,
            clientId: client.id,
            ownerId: owner.id,
            organizationId:
              organization.id,
            members: {
              create: {
                userId: owner.id,
                role:
                  ProjectRole.PROJECT_MANAGER,
              },
            },
          },
        });
      fixture.projectId = project.id;
    });

    afterAll(async () => {
      if (!prismaModule) return;

      const { prisma } = prismaModule;

      if (fixture.projectId) {
        await prisma.project.deleteMany({
          where: {
            id: fixture.projectId,
          },
        });
      }

      if (fixture.clientId) {
        await prisma.client.deleteMany({
          where: {
            id: fixture.clientId,
          },
        });
      }

      if (fixture.organizationId) {
        await prisma.organization.deleteMany({
          where: {
            id:
              fixture.organizationId,
          },
        });
      }

      await prisma.organizationInvitation.deleteMany({
        where: {
          email: lifecycleEmail,
        },
      });

      await prisma.user.deleteMany({
        where: {
          email: {
            startsWith: runId,
          },
        },
      });

      await prisma.$disconnect();
    });

    it("1. létrehozható CLIENT meghívás konkrét ügyfélcéghez", async () => {
      const { prisma } = prismaModule;

      const invitation =
        await prisma.organizationInvitation.create({
          data: {
            organizationId:
              fixture.organizationId!,
            email:
              lifecycleEmail,
            role:
              OrganizationRole.CLIENT,
            token:
              `${runId}-token`,
            invitedById:
              fixture.ownerId!,
            clientId:
              fixture.clientId!,
            expiresAt:
              new Date(
                Date.now() +
                  7 * 24 * 60 * 60 * 1000,
              ),
          },
        });

      expect(invitation.email).toBe(
        lifecycleEmail,
      );
      expect(invitation.role).toBe(
        OrganizationRole.CLIENT,
      );
      expect(invitation.clientId).toBe(
        fixture.clientId,
      );
    });

    it("2. meghívott User létrehozható, majd a production invitation helper tagságot és ClientContact linket hoz létre", async () => {
      const { prisma } = prismaModule;

      const invitation =
        await prisma.organizationInvitation.findUniqueOrThrow({
          where: {
            token:
              `${runId}-token`,
          },
        });

      const user =
        await prisma.user.create({
          data: {
            name:
              "Meghívott Teszt Ügyfél",
            email:
              lifecycleEmail,
            authUserId:
              `${runId}-auth`,
          },
        });
      fixture.lifecycleUserId =
        user.id;

      await invitationModule.applyOrganizationInvitationMembership({
        invitation,
        user,
        preserveExistingClientContactName:
          true,
      });

      const membership =
        await prisma.organizationMember.findUnique({
          where: {
            organizationId_userId: {
              organizationId:
                fixture.organizationId!,
              userId: user.id,
            },
          },
        });

      expect(membership?.role).toBe(
        OrganizationRole.CLIENT,
      );

      const contact =
        await prisma.clientContact.findUniqueOrThrow({
          where: {
            id: fixture.contactId!,
          },
        });

      expect(contact.userId).toBe(
        user.id,
      );
      expect(contact.name).toBe(
        "CRM-ben tárolt név",
      );

      const consumedInvitation =
        await prisma.organizationInvitation.findUnique({
          where: {
            token:
              `${runId}-token`,
          },
        });

      expect(consumedInvitation).toBeNull();
    });

    it("3. projekthez rendelt ClientContact után a user clientViewer hozzáférést kap", async () => {
      const { prisma } = prismaModule;

      await prisma.projectClientContact.create({
        data: {
          projectId:
            fixture.projectId!,
          clientContactId:
            fixture.contactId!,
          isPrimary: true,
        },
      });

      const access =
        await accessModule.getProjectTaskAccessContext(
          fixture.lifecycleUserId!,
          fixture.projectId!,
        );

      expect(access).toMatchObject({
        manager: false,
        internalMember: false,
        clientViewer: true,
      });
    });

    it("4. clientVisible task, CLIENT_VISIBLE komment és pending approval együtt működik", async () => {
      const { prisma } = prismaModule;

      const task =
        await prisma.task.create({
          data: {
            title:
              "Lifecycle approval task",
            projectId:
              fixture.projectId!,
            creatorId:
              fixture.ownerId!,
            clientVisible: true,
            requiresApproval: true,
            status:
              TaskStatus.AWAITING_APPROVAL,
          },
        });
      fixture.taskId = task.id;

      const comment =
        await prisma.taskComment.create({
          data: {
            taskId: task.id,
            authorId:
              fixture.lifecycleUserId!,
            content:
              "Ügyfél integration komment",
            visibility:
              CommentVisibility.CLIENT_VISIBLE,
          },
        });

      const approval =
        await prisma.taskApproval.create({
          data: {
            taskId: task.id,
            approverId:
              fixture.lifecycleUserId!,
            decision:
              TaskApprovalDecision.PENDING,
          },
        });
      fixture.approvalId = approval.id;

      const resolved =
        await accessModule.resolveTaskAccess(
          fixture.lifecycleUserId!,
          fixture.projectId!,
          task.id,
        );

      expect(comment.visibility).toBe(
        CommentVisibility.CLIENT_VISIBLE,
      );
      expect(
        resolved?.permissions.canView,
      ).toBe(true);
      expect(
        resolved?.permissions.canComment,
      ).toBe(true);
      expect(
        resolved?.permissions.canDecideApproval,
      ).toBe(true);
    });

    it("5. CLIENT -> MEMBER váltáskor a CRM rekord megmaradhat, a user-link leválasztható", async () => {
      const { prisma } = prismaModule;

      await prisma.$transaction(
        async (tx) => {
          await tx.clientContact.updateMany({
            where: {
              userId:
                fixture.lifecycleUserId!,
              client: {
                organizationId:
                  fixture.organizationId!,
              },
            },
            data: {
              userId: null,
            },
          });

          await tx.organizationMember.update({
            where: {
              organizationId_userId: {
                organizationId:
                  fixture.organizationId!,
                userId:
                  fixture.lifecycleUserId!,
              },
            },
            data: {
              role:
                OrganizationRole.MEMBER,
            },
          });
        },
      );

      const contact =
        await prisma.clientContact.findUniqueOrThrow({
          where: {
            id: fixture.contactId!,
          },
        });

      expect(contact.email).toBe(
        lifecycleEmail,
      );
      expect(contact.userId).toBeNull();

      const accessBeforeProjectMembership =
        await accessModule.getProjectTaskAccessContext(
          fixture.lifecycleUserId!,
          fixture.projectId!,
        );

      expect(
        accessBeforeProjectMembership?.clientViewer,
      ).toBe(false);
      expect(
        accessBeforeProjectMembership?.internalMember,
      ).toBe(false);
    });

    it("6. MEMBER projekttagság után belső hozzáférést kap és task rendelhető hozzá", async () => {
      const { prisma } = prismaModule;

      await prisma.projectMember.create({
        data: {
          projectId:
            fixture.projectId!,
          userId:
            fixture.lifecycleUserId!,
          role:
            ProjectRole.MEMBER,
        },
      });

      await prisma.task.update({
        where: {
          id: fixture.taskId!,
        },
        data: {
          status:
            TaskStatus.IN_PROGRESS,
          assigneeId:
            fixture.lifecycleUserId!,
        },
      });

      const resolved =
        await accessModule.resolveTaskAccess(
          fixture.lifecycleUserId!,
          fixture.projectId!,
          fixture.taskId!,
        );

      expect(
        resolved?.context.internalMember,
      ).toBe(true);
      expect(
        resolved?.context.clientViewer,
      ).toBe(false);
      expect(
        resolved?.permissions.canChangeStatus,
      ).toBe(true);
    });

    it("7. projektből eltávolítás után megszűnik a task-hozzáférés", async () => {
      const { prisma } = prismaModule;

      await prisma.task.updateMany({
        where: {
          projectId:
            fixture.projectId!,
          assigneeId:
            fixture.lifecycleUserId!,
        },
        data: {
          assigneeId: null,
        },
      });

      await prisma.projectMember.deleteMany({
        where: {
          projectId:
            fixture.projectId!,
          userId:
            fixture.lifecycleUserId!,
        },
      });

      const access =
        await accessModule.getProjectTaskAccessContext(
          fixture.lifecycleUserId!,
          fixture.projectId!,
        );

      expect(access).toMatchObject({
        manager: false,
        internalMember: false,
        clientViewer: false,
      });
    });

    it("8. szervezetből eltávolítás után a User és CRM adat külön életcikluson marad", async () => {
      const { prisma } = prismaModule;

      await prisma.organizationMember.deleteMany({
        where: {
          organizationId:
            fixture.organizationId!,
          userId:
            fixture.lifecycleUserId!,
        },
      });

      const membership =
        await prisma.organizationMember.findUnique({
          where: {
            organizationId_userId: {
              organizationId:
                fixture.organizationId!,
              userId:
                fixture.lifecycleUserId!,
            },
          },
        });

      const user =
        await prisma.user.findUnique({
          where: {
            id:
              fixture.lifecycleUserId!,
          },
        });

      const contact =
        await prisma.clientContact.findUnique({
          where: {
            id: fixture.contactId!,
          },
        });

      expect(membership).toBeNull();
      expect(user).not.toBeNull();
      expect(contact).not.toBeNull();
      expect(contact?.userId).toBeNull();
      expect(contact?.email).toBe(
        lifecycleEmail,
      );
    });
  },
);
