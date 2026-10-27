import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import {
  TaskApprovalDecision,
  TaskStatus,
} from "@/lib/domain/enums";
import {
  decideTaskApproval,
} from "@/lib/tasks/approval-workflow";

const runId =
  `approval-${Date.now()}`;

let prisma:
  typeof import("@/lib/prisma")["prisma"];

const ids: {
  organizationId?: string;
  clientId?: string;
  projectId?: string;
  ownerId?: string;
  approverOneId?: string;
  approverTwoId?: string;
  taskId?: string;
  approvalOneId?: string;
  approvalTwoId?: string;
} = {};

function email(
  label: string,
) {
  return `${runId}-${label}@integration.projectflow.test`;
}

describe(
  "approval concurrency – PostgreSQL integration",
  () => {
    beforeAll(async () => {
      if (
        !process.env.TEST_DATABASE_URL
      ) {
        throw new Error(
          "TEST_DATABASE_URL szükséges.",
        );
      }

      prisma =
        (
          await import(
            "@/lib/prisma"
          )
        ).prisma;

      const [
        owner,
        approverOne,
        approverTwo,
      ] =
        await Promise.all([
          prisma.user.create({
            data: {
              name:
                "Approval Owner",
              email:
                email("owner"),
            },
          }),
          prisma.user.create({
            data: {
              name:
                "Approver One",
              email:
                email("one"),
            },
          }),
          prisma.user.create({
            data: {
              name:
                "Approver Two",
              email:
                email("two"),
            },
          }),
        ]);

      ids.ownerId =
        owner.id;
      ids.approverOneId =
        approverOne.id;
      ids.approverTwoId =
        approverTwo.id;

      const organization =
        await prisma.organization.create({
          data: {
            name:
              `Approval Integration ${runId}`,
          },
        });

      ids.organizationId =
        organization.id;

      const client =
        await prisma.client.create({
          data: {
            name:
              `Approval Client ${runId}`,
            organizationId:
              organization.id,
          },
        });

      ids.clientId =
        client.id;

      const project =
        await prisma.project.create({
          data: {
            name:
              `Approval Project ${runId}`,
            clientId:
              client.id,
            ownerId:
              owner.id,
            organizationId:
              organization.id,
          },
        });

      ids.projectId =
        project.id;

      const task =
        await prisma.task.create({
          data: {
            title:
              "Concurrent approval task",
            projectId:
              project.id,
            creatorId:
              owner.id,
            clientVisible:
              true,
            requiresApproval:
              true,
            status:
              TaskStatus.AWAITING_APPROVAL,
          },
        });

      ids.taskId =
        task.id;

      const [
        approvalOne,
        approvalTwo,
      ] =
        await Promise.all([
          prisma.taskApproval.create({
            data: {
              taskId:
                task.id,
              approverId:
                approverOne.id,
              decision:
                TaskApprovalDecision.PENDING,
            },
          }),
          prisma.taskApproval.create({
            data: {
              taskId:
                task.id,
              approverId:
                approverTwo.id,
              decision:
                TaskApprovalDecision.PENDING,
            },
          }),
        ]);

      ids.approvalOneId =
        approvalOne.id;
      ids.approvalTwoId =
        approvalTwo.id;
    });

    afterAll(async () => {
      if (!prisma) {
        return;
      }

      if (ids.projectId) {
        await prisma.project.deleteMany({
          where: {
            id:
              ids.projectId,
          },
        });
      }

      if (ids.clientId) {
        await prisma.client.deleteMany({
          where: {
            id:
              ids.clientId,
          },
        });
      }

      if (
        ids.organizationId
      ) {
        await prisma.organization.deleteMany({
          where: {
            id:
              ids.organizationId,
          },
        });
      }

      await prisma.user.deleteMany({
        where: {
          id: {
            in: [
              ids.ownerId,
              ids.approverOneId,
              ids.approverTwoId,
            ].filter(
              (
                value,
              ): value is string =>
                Boolean(value),
            ),
          },
        },
      });

      await prisma.$disconnect();
    });

    it("két közel egyidejű APPROVED döntés után a task pontosan DONE lesz", async () => {
      await Promise.all([
        decideTaskApproval({
          projectId:
            ids.projectId!,
          taskId:
            ids.taskId!,
          approvalId:
            ids.approvalOneId!,
          approverId:
            ids.approverOneId!,
          decision:
            TaskApprovalDecision.APPROVED,
          comment: null,
        }),
        decideTaskApproval({
          projectId:
            ids.projectId!,
          taskId:
            ids.taskId!,
          approvalId:
            ids.approvalTwoId!,
          approverId:
            ids.approverTwoId!,
          decision:
            TaskApprovalDecision.APPROVED,
          comment: null,
        }),
      ]);

      const [
        task,
        approvals,
      ] =
        await Promise.all([
          prisma.task.findUnique({
            where: {
              id:
                ids.taskId!,
            },
          }),
          prisma.taskApproval.findMany({
            where: {
              taskId:
                ids.taskId!,
            },
          }),
        ]);

      expect(
        task?.status,
      ).toBe(
        TaskStatus.DONE,
      );

      expect(
        approvals.every(
          (approval) =>
            approval.decision ===
            TaskApprovalDecision.APPROVED,
        ),
      ).toBe(true);
    });

    it("ugyanaz az approval másodszor már nem dönthető el", async () => {
      await expect(
        decideTaskApproval({
          projectId:
            ids.projectId!,
          taskId:
            ids.taskId!,
          approvalId:
            ids.approvalOneId!,
          approverId:
            ids.approverOneId!,
          decision:
            TaskApprovalDecision.APPROVED,
          comment: null,
        }),
      ).rejects.toMatchObject({
        name:
          "ApprovalWorkflowError",
      });
    });
  },
);
