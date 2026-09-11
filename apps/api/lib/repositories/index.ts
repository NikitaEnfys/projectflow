import { prisma } from "@/lib/prisma";

// Persistence adapters. Application services import these names rather than Prisma.
// Replacing the ORM is isolated to this directory: keep the repository contracts
// stable and translate their criteria in the new adapter.
export const organizationRepository = prisma.organization;
export const organizationMemberRepository = prisma.organizationMember;
export const organizationInvitationRepository = prisma.organizationInvitation;
export const userRepository = prisma.user;
export const clientRepository = prisma.client;
export const clientContactRepository = prisma.clientContact;
export const projectRepository = prisma.project;
export const projectMemberRepository = prisma.projectMember;
export const milestoneRepository = prisma.milestone;
export const taskRepository = prisma.task;
export const taskCommentRepository = prisma.taskComment;
export const activityLogRepository = prisma.activityLog;

export const runInTransaction = prisma.$transaction.bind(prisma);
