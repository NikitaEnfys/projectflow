import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OrganizationRole, ProjectRole, TaskApprovalDecision, TaskStatus } from "@/lib/domain/enums";

const runId = `it-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

type Fixture = {
  organizationId: string;
  clientId: string;
  projectOneId: string;
  projectTwoId: string;
  ownerId: string;
  internalMemberId: string;
  clientUserId: string;
  outsiderClientUserId: string;
  visibleTaskId: string;
  hiddenTaskId: string;
  secondProjectTaskId: string;
  approvalTaskId: string;
};

let fixture: Fixture;
let prismaModule: typeof import("@/lib/prisma");
let accessModule: typeof import("@/lib/tasks/access");

function email(label: string) {
  return `${runId}-${label}@integration.projectflow.test`;
}

describe("task access – PostgreSQL integration", () => {
  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) {
      throw new Error("TEST_DATABASE_URL szükséges az integration teszthez.");
    }

    prismaModule = await import("@/lib/prisma");
    accessModule = await import("@/lib/tasks/access");
    const { prisma } = prismaModule;

    const [owner, internalMember, clientUser, outsiderClientUser] = await Promise.all([
      prisma.user.create({ data: { name: "Integration Owner", email: email("owner") } }),
      prisma.user.create({ data: { name: "Integration Member", email: email("member") } }),
      prisma.user.create({ data: { name: "Integration Client", email: email("client") } }),
      prisma.user.create({ data: { name: "Integration Other Client", email: email("other-client") } }),
    ]);

    const organization = await prisma.organization.create({
      data: {
        name: `Integration Organization ${runId}`,
        members: {
          create: [
            { userId: owner.id, role: OrganizationRole.OWNER },
            { userId: internalMember.id, role: OrganizationRole.MEMBER },
            { userId: clientUser.id, role: OrganizationRole.CLIENT },
            { userId: outsiderClientUser.id, role: OrganizationRole.CLIENT },
          ],
        },
      },
    });

    const client = await prisma.client.create({
      data: { name: `Integration Client Company ${runId}`, organizationId: organization.id },
    });

    const [linkedContact, otherContact] = await Promise.all([
      prisma.clientContact.create({ data: { clientId: client.id, userId: clientUser.id, name: "Linked Client Contact", email: email("linked-contact") } }),
      prisma.clientContact.create({ data: { clientId: client.id, userId: outsiderClientUser.id, name: "Other Client Contact", email: email("other-contact") } }),
    ]);

    const projectOne = await prisma.project.create({
      data: {
        name: `Integration Project One ${runId}`,
        clientId: client.id,
        ownerId: owner.id,
        organizationId: organization.id,
        members: { create: [
          { userId: owner.id, role: ProjectRole.PROJECT_MANAGER },
          { userId: internalMember.id, role: ProjectRole.MEMBER },
        ] },
        clientContacts: { create: { clientContactId: linkedContact.id, isPrimary: true } },
      },
    });

    const projectTwo = await prisma.project.create({
      data: {
        name: `Integration Project Two ${runId}`,
        clientId: client.id,
        ownerId: owner.id,
        organizationId: organization.id,
        members: { create: { userId: owner.id, role: ProjectRole.PROJECT_MANAGER } },
        clientContacts: { create: { clientContactId: otherContact.id, isPrimary: true } },
      },
    });

    const [visibleTask, hiddenTask, secondProjectTask, approvalTask] = await Promise.all([
      prisma.task.create({ data: { title: "Client visible integration task", projectId: projectOne.id, creatorId: owner.id, clientVisible: true, status: TaskStatus.REVIEW } }),
      prisma.task.create({ data: { title: "Internal integration task", projectId: projectOne.id, creatorId: owner.id, clientVisible: false, status: TaskStatus.REVIEW } }),
      prisma.task.create({ data: { title: "Second project task", projectId: projectTwo.id, creatorId: owner.id, clientVisible: true, status: TaskStatus.REVIEW } }),
      prisma.task.create({ data: { title: "Approval integration task", projectId: projectOne.id, creatorId: owner.id, clientVisible: true, requiresApproval: true, status: TaskStatus.AWAITING_APPROVAL } }),
    ]);

    await prisma.taskApproval.create({ data: { taskId: approvalTask.id, approverId: clientUser.id, decision: TaskApprovalDecision.PENDING } });

    fixture = {
      organizationId: organization.id,
      clientId: client.id,
      projectOneId: projectOne.id,
      projectTwoId: projectTwo.id,
      ownerId: owner.id,
      internalMemberId: internalMember.id,
      clientUserId: clientUser.id,
      outsiderClientUserId: outsiderClientUser.id,
      visibleTaskId: visibleTask.id,
      hiddenTaskId: hiddenTask.id,
      secondProjectTaskId: secondProjectTask.id,
      approvalTaskId: approvalTask.id,
    };
  });

  afterAll(async () => {
    if (!prismaModule) return;
    const { prisma } = prismaModule;
    if (fixture) {
      await prisma.project.deleteMany({ where: { id: { in: [fixture.projectOneId, fixture.projectTwoId] } } });
      await prisma.client.deleteMany({ where: { id: fixture.clientId } });
      await prisma.organization.deleteMany({ where: { id: fixture.organizationId } });
      await prisma.user.deleteMany({ where: { id: { in: [fixture.ownerId, fixture.internalMemberId, fixture.clientUserId, fixture.outsiderClientUserId] } } });
    }
    await prisma.$disconnect();
  });

  it("OWNER valódi adatokból manager hozzáférést kap", async () => {
    const access = await accessModule.getProjectTaskAccessContext(fixture.ownerId, fixture.projectOneId);
    expect(access).toMatchObject({ manager: true, internalMember: true, clientViewer: false, projectRole: ProjectRole.PROJECT_MANAGER });
  });

  it("MEMBER valódi ProjectMember rekordból belső tagként oldódik fel", async () => {
    const access = await accessModule.getProjectTaskAccessContext(fixture.internalMemberId, fixture.projectOneId);
    expect(access).toMatchObject({ manager: false, internalMember: true, clientViewer: false, projectRole: ProjectRole.MEMBER });
  });

  it("ProjectClientContact az adott projekten clientViewer hozzáférést ad", async () => {
    const access = await accessModule.getProjectTaskAccessContext(fixture.clientUserId, fixture.projectOneId);
    expect(access).toMatchObject({ manager: false, internalMember: false, clientViewer: true });
  });

  it("ugyanazon Client másik projektjéhez nem ad hozzáférést a kapcsolattartói státusz", async () => {
    const access = await accessModule.getProjectTaskAccessContext(fixture.clientUserId, fixture.projectTwoId);
    expect(access).toMatchObject({ manager: false, internalMember: false, clientViewer: false });
  });

  it("OrganizationRole.CLIENT ProjectClientContact nélkül nem ad projekt-hozzáférést", async () => {
    const access = await accessModule.getProjectTaskAccessContext(fixture.outsiderClientUserId, fixture.projectOneId);
    expect(access).toMatchObject({ manager: false, internalMember: false, clientViewer: false });
  });

  it("clientViewer valódi clientVisible taskot lát és kommentelhet", async () => {
    const resolved = await accessModule.resolveTaskAccess(fixture.clientUserId, fixture.projectOneId, fixture.visibleTaskId);
    expect(resolved?.permissions.canView).toBe(true);
    expect(resolved?.permissions.canComment).toBe(true);
    expect(resolved?.permissions.canEdit).toBe(false);
  });

  it("clientViewer valódi belső taskot nem lát", async () => {
    const resolved = await accessModule.resolveTaskAccess(fixture.clientUserId, fixture.projectOneId, fixture.hiddenTaskId);
    expect(resolved?.permissions.canView).toBe(false);
    expect(resolved?.permissions.canComment).toBe(false);
  });

  it("másik projekten nincs task-hozzáférés akkor sem, ha a task clientVisible", async () => {
    const resolved = await accessModule.resolveTaskAccess(fixture.clientUserId, fixture.projectTwoId, fixture.secondProjectTaskId);
    expect(resolved?.permissions.canView).toBe(false);
  });

  it("valódi pending TaskApproval rekord clientVisible taskon döntési jogosultságot ad", async () => {
    const resolved = await accessModule.resolveTaskAccess(fixture.clientUserId, fixture.projectOneId, fixture.approvalTaskId);
    expect(resolved?.myApproval?.decision).toBe(TaskApprovalDecision.PENDING);
    expect(resolved?.permissions.canDecideApproval).toBe(true);
  });
});
