export const OrganizationRole = {
  OWNER: "OWNER", ADMIN: "ADMIN", PROJECT_MANAGER: "PROJECT_MANAGER", MEMBER: "MEMBER", CONTRACTOR: "CONTRACTOR", CLIENT: "CLIENT",
} as const;
export type OrganizationRole = typeof OrganizationRole[keyof typeof OrganizationRole];

export const ProjectRole = {
  PROJECT_MANAGER: "PROJECT_MANAGER", MEMBER: "MEMBER", CONTRACTOR: "CONTRACTOR", CLIENT: "CLIENT",
} as const;
export type ProjectRole = typeof ProjectRole[keyof typeof ProjectRole];

export const ProjectStatus = { PLANNING: "PLANNING", ACTIVE: "ACTIVE", ON_HOLD: "ON_HOLD", COMPLETED: "COMPLETED", CANCELLED: "CANCELLED" } as const;
export type ProjectStatus = typeof ProjectStatus[keyof typeof ProjectStatus];

export const ProjectPriority = { LOW: "LOW", MEDIUM: "MEDIUM", HIGH: "HIGH", URGENT: "URGENT" } as const;
export type ProjectPriority = typeof ProjectPriority[keyof typeof ProjectPriority];

export const MilestoneStatus = { PLANNED: "PLANNED", IN_PROGRESS: "IN_PROGRESS", COMPLETED: "COMPLETED" } as const;
export type MilestoneStatus = typeof MilestoneStatus[keyof typeof MilestoneStatus];

export const TaskStatus = {
  TODO: "TODO",
  IN_PROGRESS: "IN_PROGRESS",
  REVIEW: "REVIEW",
  AWAITING_APPROVAL: "AWAITING_APPROVAL",
  BLOCKED: "BLOCKED",
  DONE: "DONE",
} as const;
export type TaskStatus = typeof TaskStatus[keyof typeof TaskStatus];

export const TaskPriority = { LOW: "LOW", MEDIUM: "MEDIUM", HIGH: "HIGH", URGENT: "URGENT" } as const;
export type TaskPriority = typeof TaskPriority[keyof typeof TaskPriority];

export const CommentVisibility = { INTERNAL: "INTERNAL", CLIENT_VISIBLE: "CLIENT_VISIBLE" } as const;
export type CommentVisibility = typeof CommentVisibility[keyof typeof CommentVisibility];

export const TaskApprovalDecision = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type TaskApprovalDecision = typeof TaskApprovalDecision[keyof typeof TaskApprovalDecision];
