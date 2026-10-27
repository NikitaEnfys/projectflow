import {
  OrganizationRole,
  ProjectRole,
} from "@/lib/domain/enums";
import type {
  TaskAccessContext,
} from "@/lib/tasks/permission-policy";

const ORGANIZATION_CONTENT_MANAGERS =
  new Set<OrganizationRole>([
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.PROJECT_MANAGER,
  ]);

export type TaskAccessInputs = {
  userId: string;
  projectId: string;
  projectRole: ProjectRole | null;
  organizationRole: OrganizationRole | null;
  linkedProjectContact: boolean;
};

export function deriveTaskAccessContext({
  userId,
  projectId,
  projectRole,
  organizationRole,
  linkedProjectContact,
}: TaskAccessInputs): TaskAccessContext {
  const manager =
    projectRole === ProjectRole.PROJECT_MANAGER ||
    Boolean(
      organizationRole &&
        ORGANIZATION_CONTENT_MANAGERS.has(organizationRole),
    );

  const internalMember =
    manager ||
    projectRole === ProjectRole.MEMBER ||
    projectRole === ProjectRole.CONTRACTOR;

  const clientViewer =
    !manager &&
    !internalMember &&
    (projectRole === ProjectRole.CLIENT || linkedProjectContact);

  return {
    userId,
    projectId,
    manager,
    internalMember,
    clientViewer,
    projectRole,
  };
}
