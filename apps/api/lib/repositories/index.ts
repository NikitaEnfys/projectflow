import {
  Prisma,
} from "@prisma/client";
import {
  prisma,
} from "@/lib/prisma";
import {
  isRetryableTransactionError,
} from "@/lib/repositories/transaction-retry";


// Persistence adapters. Application services import these names rather than Prisma.
export const organizationRepository =
  prisma.organization;
export const organizationMemberRepository =
  prisma.organizationMember;
export const organizationInvitationRepository =
  prisma.organizationInvitation;
export const userRepository =
  prisma.user;
export const clientRepository =
  prisma.client;
export const clientContactRepository =
  prisma.clientContact;
export const projectRepository =
  prisma.project;
export const projectClientContactRepository =
  prisma.projectClientContact;
export const projectMemberRepository =
  prisma.projectMember;
export const milestoneRepository =
  prisma.milestone;
export const taskRepository =
  prisma.task;
export const taskCommentRepository =
  prisma.taskComment;
export const taskApprovalRepository =
  prisma.taskApproval;
export const taskAttachmentRepository =
  prisma.taskAttachment;
export const activityLogRepository =
  prisma.activityLog;

export const runInTransaction =
  prisma.$transaction.bind(
    prisma,
  );

export async function runSerializableTransaction<T>(
  work: (
    tx: Prisma.TransactionClient,
  ) => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt += 1
  ) {
    try {
      return await prisma.$transaction(
        work,
        {
          isolationLevel:
            Prisma.TransactionIsolationLevel
              .Serializable,
        },
      );
    } catch (error) {
      if (
        !isRetryableTransactionError(
          error,
        ) ||
        attempt === maxAttempts
      ) {
        throw error;
      }
    }
  }

  throw new Error(
    "A tranzakció nem fejeződött be.",
  );
}
