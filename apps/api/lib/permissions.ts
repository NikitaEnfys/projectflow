import {
  OrganizationRole,
  ProjectRole,
} from "@/lib/domain/enums";
import {
  clientContactRepository,
  clientRepository,
  organizationMemberRepository,
  projectClientContactRepository,
  projectMemberRepository,
  projectRepository,
  taskRepository,
} from "@/lib/repositories";

const ORGANIZATION_MANAGERS =
  new Set<OrganizationRole>([
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
  ]);

const ORGANIZATION_CONTENT_MANAGERS =
  new Set<OrganizationRole>([
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.PROJECT_MANAGER,
  ]);

const ORGANIZATION_PROJECT_OVERSIGHT =
  ORGANIZATION_CONTENT_MANAGERS;

export class PermissionError extends Error {
  constructor(
    message = "Nincs jogosultságod ehhez a művelethez.",
  ) {
    super(message);
    this.name = "PermissionError";
  }
}

export async function getOrganizationMembership(
  userId: string,
  organizationId: string,
) {
  return organizationMemberRepository.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
  });
}

export async function getProjectMembership(
  userId: string,
  projectId: string,
) {
  return projectMemberRepository.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId,
      },
    },
  });
}

export async function canManageOrganization(
  userId: string,
  organizationId: string,
) {
  const membership =
    await getOrganizationMembership(
      userId,
      organizationId,
    );

  return Boolean(
    membership &&
      ORGANIZATION_MANAGERS.has(
        membership.role,
      ),
  );
}

export async function canManageOrganizationContent(
  userId: string,
  organizationId: string,
) {
  const membership =
    await getOrganizationMembership(
      userId,
      organizationId,
    );

  return Boolean(
    membership &&
      ORGANIZATION_CONTENT_MANAGERS.has(
        membership.role,
      ),
  );
}

export async function canCreateClient(
  userId: string,
  organizationId: string,
) {
  return canManageOrganizationContent(
    userId,
    organizationId,
  );
}

export async function canManageClients(
  userId: string,
  organizationId: string,
) {
  return canManageOrganizationContent(
    userId,
    organizationId,
  );
}

export async function canCreateProject(
  userId: string,
  organizationId: string,
) {
  return canManageOrganizationContent(
    userId,
    organizationId,
  );
}

export async function canViewClient(
  userId: string,
  clientId: string,
) {
  const client =
    await clientRepository.findUnique({
      where: { id: clientId },
      select: { organizationId: true },
    });

  if (!client) return false;

  const linkedContact =
    await clientContactRepository.findFirst({
      where: {
        clientId,
        userId,
      },
      select: { id: true },
    });

  if (linkedContact) return true;

  if (!client.organizationId) return false;

  const membership =
    await getOrganizationMembership(
      userId,
      client.organizationId,
    );

  return Boolean(
    membership &&
      ORGANIZATION_PROJECT_OVERSIGHT.has(
        membership.role,
      ),
  );
}

export async function canViewProject(
  userId: string,
  projectId: string,
) {
  const project =
    await projectRepository.findUnique({
      where: { id: projectId },
      select: {
        organizationId: true,
      },
    });

  if (!project) return false;

  const projectMembership =
    await getProjectMembership(
      userId,
      projectId,
    );

  if (projectMembership) return true;

  // Ügyfél-kapcsolattartó csak azt a projektet láthatja,
  // amelyhez ProjectClientContact kapcsolattal ki lett jelölve.
  const linkedProjectContact =
    await projectClientContactRepository.findFirst({
      where: {
        projectId,
        clientContact: {
          userId,
        },
      },
      select: { id: true },
    });

  if (linkedProjectContact) return true;

  if (!project.organizationId) return false;

  const organizationMembership =
    await getOrganizationMembership(
      userId,
      project.organizationId,
    );

  return Boolean(
    organizationMembership &&
      ORGANIZATION_PROJECT_OVERSIGHT.has(
        organizationMembership.role,
      ),
  );
}

export async function canManageProject(
  userId: string,
  projectId: string,
) {
  const project =
    await projectRepository.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });

  if (!project) return false;

  const projectMembership =
    await getProjectMembership(
      userId,
      projectId,
    );

  if (
    projectMembership?.role ===
    ProjectRole.PROJECT_MANAGER
  ) {
    return true;
  }

  if (!project.organizationId) return false;

  return canManageOrganizationContent(
    userId,
    project.organizationId,
  );
}

export async function canManageProjectMembers(
  userId: string,
  projectId: string,
) {
  return canManageProject(userId, projectId);
}

export async function requireProjectAccess(
  userId: string,
  projectId: string,
) {
  if (
    !(await canViewProject(
      userId,
      projectId,
    ))
  ) {
    throw new PermissionError(
      "Ehhez a projekthez nincs hozzáférésed.",
    );
  }
}

export async function requireProjectManagement(
  userId: string,
  projectId: string,
) {
  if (
    !(await canManageProject(
      userId,
      projectId,
    ))
  ) {
    throw new PermissionError(
      "Nincs jogosultságod a projekt kezeléséhez.",
    );
  }
}

export async function isClientProjectViewer(
  userId: string,
  projectId: string,
) {
  const project =
    await projectRepository.findUnique({
      where: { id: projectId },
      select: {
        organizationId: true,
      },
    });

  if (!project) return false;

  const [
    membership,
    linkedProjectContact,
    organizationMembership,
  ] = await Promise.all([
    getProjectMembership(userId, projectId),
    projectClientContactRepository.findFirst({
      where: {
        projectId,
        clientContact: {
          userId,
        },
      },
      select: { id: true },
    }),
    project.organizationId
      ? getOrganizationMembership(
          userId,
          project.organizationId,
        )
      : Promise.resolve(null),
  ]);

  if (
    membership &&
    membership.role !== ProjectRole.CLIENT
  ) {
    return false;
  }

  if (
    organizationMembership &&
    ORGANIZATION_PROJECT_OVERSIGHT.has(
      organizationMembership.role,
    )
  ) {
    return false;
  }

  return (
    membership?.role === ProjectRole.CLIENT ||
    Boolean(linkedProjectContact)
  );
}

export async function canUpdateAssignedTask(
  userId: string,
  taskId: string,
) {
  const task =
    await taskRepository.findUnique({
      where: { id: taskId },
      select: {
        projectId: true,
        assigneeId: true,
      },
    });

  if (
    !task ||
    task.assigneeId !== userId
  ) {
    return false;
  }

  const membership =
    await getProjectMembership(
      userId,
      task.projectId,
    );

  return (
    membership?.role === ProjectRole.MEMBER ||
    membership?.role ===
      ProjectRole.CONTRACTOR ||
    membership?.role ===
      ProjectRole.PROJECT_MANAGER
  );
}
