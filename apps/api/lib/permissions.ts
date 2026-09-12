import { OrganizationRole, ProjectRole } from "@/lib/domain/enums";
import {
  clientContactRepository,
  clientRepository,
  organizationMemberRepository,
  projectMemberRepository,
  projectRepository,
  taskRepository,
} from "@/lib/repositories";

const ORGANIZATION_MANAGERS = new Set<OrganizationRole>([
  OrganizationRole.OWNER,
  OrganizationRole.ADMIN,
]);

/**
 * Szervezeti tartalomkezelők:
 * - OWNER
 * - ADMIN
 * - PROJECT_MANAGER
 *
 * Ők a teljes szervezeten belül kezelhetik az ügyfeleket,
 * kapcsolattartókat és projekteket.
 */
const ORGANIZATION_CONTENT_MANAGERS = new Set<OrganizationRole>([
  OrganizationRole.OWNER,
  OrganizationRole.ADMIN,
  OrganizationRole.PROJECT_MANAGER,
]);

const ORGANIZATION_PROJECT_OVERSIGHT = ORGANIZATION_CONTENT_MANAGERS;
const PROJECT_CREATORS = ORGANIZATION_CONTENT_MANAGERS;

export class PermissionError extends Error {
  constructor(message = "Nincs jogosultságod ehhez a művelethez.") {
    super(message);
    this.name = "PermissionError";
  }
}

export async function getOrganizationMembership(userId: string, organizationId: string) {
  return organizationMemberRepository.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
}

export async function getProjectMembership(userId: string, projectId: string) {
  return projectMemberRepository.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
}

export async function canManageOrganization(userId: string, organizationId: string) {
  const membership = await getOrganizationMembership(userId, organizationId);
  return Boolean(membership && ORGANIZATION_MANAGERS.has(membership.role));
}

export async function canManageOrganizationContent(
  userId: string,
  organizationId: string,
) {
  const membership = await getOrganizationMembership(userId, organizationId);
  return Boolean(
    membership && ORGANIZATION_CONTENT_MANAGERS.has(membership.role),
  );
}

export async function canCreateClient(userId: string, organizationId: string) {
  return canManageOrganizationContent(userId, organizationId);
}

export async function canManageClients(userId: string, organizationId: string) {
  return canManageOrganizationContent(userId, organizationId);
}

export async function canCreateProject(userId: string, organizationId: string) {
  return canManageOrganizationContent(userId, organizationId);
}

export async function canViewClient(userId: string, clientId: string) {
  const client = await clientRepository.findUnique({
    where: { id: clientId },
    select: { organizationId: true },
  });
  if (!client) return false;

  const linkedContact = await clientContactRepository.findFirst({
    where: { clientId, userId },
    select: { id: true },
  });
  if (linkedContact) return true;

  if (!client.organizationId) return false;

  const membership = await getOrganizationMembership(
    userId,
    client.organizationId,
  );

  return Boolean(
    membership && ORGANIZATION_PROJECT_OVERSIGHT.has(membership.role),
  );
}

export async function canViewProject(userId: string, projectId: string) {
  const project = await projectRepository.findUnique({
    where: { id: projectId },
    select: { organizationId: true, clientId: true },
  });
  if (!project) return false;

  const projectMembership = await getProjectMembership(userId, projectId);
  if (projectMembership) return true;

  const linkedClient = await clientContactRepository.findFirst({
    where: { clientId: project.clientId, userId },
    select: { id: true },
  });
  if (linkedClient) return true;

  if (!project.organizationId) return false;

  const organizationMembership = await getOrganizationMembership(
    userId,
    project.organizationId,
  );

  return Boolean(
    organizationMembership &&
      ORGANIZATION_PROJECT_OVERSIGHT.has(organizationMembership.role),
  );
}

export async function canManageProject(userId: string, projectId: string) {
  const project = await projectRepository.findUnique({
    where: { id: projectId },
    select: { organizationId: true },
  });
  if (!project) return false;

  // A projekt saját PROJECT_MANAGER tagja továbbra is kezelheti.
  const projectMembership = await getProjectMembership(userId, projectId);
  if (projectMembership?.role === ProjectRole.PROJECT_MANAGER) return true;

  if (!project.organizationId) return false;

  // Szervezeti OWNER / ADMIN / PROJECT_MANAGER az összes szervezeti
  // projektet kezelheti.
  return canManageOrganizationContent(userId, project.organizationId);
}

export async function canManageProjectMembers(userId: string, projectId: string) {
  return canManageProject(userId, projectId);
}

export async function requireProjectAccess(userId: string, projectId: string) {
  if (!(await canViewProject(userId, projectId))) {
    throw new PermissionError("Ehhez a projekthez nincs hozzáférésed.");
  }
}

export async function requireProjectManagement(
  userId: string,
  projectId: string,
) {
  if (!(await canManageProject(userId, projectId))) {
    throw new PermissionError("Nincs jogosultságod a projekt kezeléséhez.");
  }
}

export async function isClientProjectViewer(userId: string, projectId: string) {
  const project = await projectRepository.findUnique({
    where: { id: projectId },
    select: { clientId: true, organizationId: true },
  });
  if (!project) return false;

  const [membership, clientContact, organizationMembership] = await Promise.all([
    getProjectMembership(userId, projectId),
    clientContactRepository.findFirst({
      where: { userId, clientId: project.clientId },
      select: { id: true },
    }),
    project.organizationId
      ? getOrganizationMembership(userId, project.organizationId)
      : Promise.resolve(null),
  ]);

  if (membership && membership.role !== ProjectRole.CLIENT) return false;

  if (
    organizationMembership &&
    ORGANIZATION_PROJECT_OVERSIGHT.has(organizationMembership.role)
  ) {
    return false;
  }

  return membership?.role === ProjectRole.CLIENT || Boolean(clientContact);
}

export async function canUpdateAssignedTask(userId: string, taskId: string) {
  const task = await taskRepository.findUnique({
    where: { id: taskId },
    select: { projectId: true, assigneeId: true },
  });

  if (!task || task.assigneeId !== userId) return false;

  const membership = await getProjectMembership(userId, task.projectId);

  return (
    membership?.role === ProjectRole.MEMBER ||
    membership?.role === ProjectRole.CONTRACTOR ||
    membership?.role === ProjectRole.PROJECT_MANAGER
  );
}
