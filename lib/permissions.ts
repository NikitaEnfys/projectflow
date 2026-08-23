import { OrganizationRole, ProjectRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const ORGANIZATION_MANAGERS = new Set<OrganizationRole>([
  OrganizationRole.OWNER,
  OrganizationRole.ADMIN,
]);

const ORGANIZATION_PROJECT_OVERSIGHT = new Set<OrganizationRole>([
  OrganizationRole.OWNER,
  OrganizationRole.ADMIN,
  OrganizationRole.PROJECT_MANAGER,
]);

const PROJECT_CREATORS = new Set<OrganizationRole>([
  OrganizationRole.OWNER,
  OrganizationRole.ADMIN,
  OrganizationRole.PROJECT_MANAGER,
]);

export class PermissionError extends Error {
  constructor(message = "Nincs jogosultságod ehhez a művelethez.") {
    super(message);
    this.name = "PermissionError";
  }
}

export async function getOrganizationMembership(userId: string, organizationId: string) {
  return prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
}

export async function getProjectMembership(userId: string, projectId: string) {
  return prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
}

export async function canCreateClient(userId: string, organizationId: string) {
  const membership = await getOrganizationMembership(userId, organizationId);
  return Boolean(membership && ORGANIZATION_MANAGERS.has(membership.role));
}

export async function canCreateProject(userId: string, organizationId: string) {
  const membership = await getOrganizationMembership(userId, organizationId);
  return Boolean(membership && PROJECT_CREATORS.has(membership.role));
}

export async function canViewClient(userId: string, clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { organizationId: true },
  });
  if (!client) return false;

  const linkedContact = await prisma.clientContact.findFirst({
    where: { clientId, userId },
    select: { id: true },
  });
  if (linkedContact) return true;

  if (!client.organizationId) return false;
  const membership = await getOrganizationMembership(userId, client.organizationId);
  return Boolean(membership && ORGANIZATION_PROJECT_OVERSIGHT.has(membership.role));
}

export async function canViewProject(userId: string, projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { organizationId: true, clientId: true },
  });
  if (!project) return false;

  const projectMembership = await getProjectMembership(userId, projectId);
  if (projectMembership) return true;

  const linkedClient = await prisma.clientContact.findFirst({
    where: { clientId: project.clientId, userId },
    select: { id: true },
  });
  if (linkedClient) return true;

  if (!project.organizationId) return false;
  const organizationMembership = await getOrganizationMembership(userId, project.organizationId);
  return Boolean(organizationMembership && ORGANIZATION_PROJECT_OVERSIGHT.has(organizationMembership.role));
}

export async function canManageProject(userId: string, projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { organizationId: true } });
  if (!project) return false;
  const projectMembership = await getProjectMembership(userId, projectId);
  if (projectMembership?.role === ProjectRole.PROJECT_MANAGER) return true;
  if (!project.organizationId) return false;
  const organizationMembership = await getOrganizationMembership(userId, project.organizationId);
  return Boolean(organizationMembership && ORGANIZATION_MANAGERS.has(organizationMembership.role));
}

export async function canManageProjectMembers(userId: string, projectId: string) {
  return canManageProject(userId, projectId);
}

export async function canManageClients(userId: string, organizationId: string) {
  const membership = await getOrganizationMembership(userId, organizationId);
  return Boolean(membership && ORGANIZATION_PROJECT_OVERSIGHT.has(membership.role));
}

export async function requireProjectAccess(userId: string, projectId: string) {
  if (!(await canViewProject(userId, projectId))) throw new PermissionError("Ehhez a projekthez nincs hozzáférésed.");
}

export async function requireProjectManagement(userId: string, projectId: string) {
  if (!(await canManageProject(userId, projectId))) throw new PermissionError("Nincs jogosultságod a projekt kezeléséhez.");
}

export async function isClientProjectViewer(userId: string, projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { clientId: true, organizationId: true },
  });
  if (!project) return false;

  const [membership, clientContact, organizationMembership] = await Promise.all([
    getProjectMembership(userId, projectId),
    prisma.clientContact.findFirst({ where: { userId, clientId: project.clientId }, select: { id: true } }),
    project.organizationId ? getOrganizationMembership(userId, project.organizationId) : Promise.resolve(null),
  ]);

  if (membership && membership.role !== ProjectRole.CLIENT) return false;
  if (organizationMembership && ORGANIZATION_PROJECT_OVERSIGHT.has(organizationMembership.role)) return false;
  return membership?.role === ProjectRole.CLIENT || Boolean(clientContact);
}

export async function canUpdateAssignedTask(userId: string, taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true, assigneeId: true },
  });
  if (!task || task.assigneeId !== userId) return false;
  const membership = await getProjectMembership(userId, task.projectId);
  return membership?.role === ProjectRole.MEMBER || membership?.role === ProjectRole.CONTRACTOR || membership?.role === ProjectRole.PROJECT_MANAGER;
}
