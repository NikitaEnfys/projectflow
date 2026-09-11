import { json } from "@/lib/http/response";
import { ProjectRole } from "@/lib/domain/enums";
import { clientContactRepository, organizationMemberRepository, projectMemberRepository, projectRepository, runInTransaction } from "@/lib/repositories";
import { requireCurrentUser } from "@/lib/auth/current-user";
import {
  PermissionError,
  canManageProjectMembers,
  requireProjectAccess,
  requireProjectManagement,
} from "@/lib/permissions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const PROJECT_ROLES = new Set<string>(Object.values(ProjectRole));

function parseRole(value: unknown): ProjectRole | null {
  return typeof value === "string" && PROJECT_ROLES.has(value)
    ? (value as ProjectRole)
    : null;
}

async function getProjectOrNull(projectId: string) {
  return projectRepository.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      organizationId: true,
      ownerId: true,
      clientId: true,
    },
  });
}

async function findReplacementManager(projectId: string, excludedUserId: string) {
  return projectMemberRepository.findFirst({
    where: {
      projectId,
      role: ProjectRole.PROJECT_MANAGER,
      userId: { not: excludedUserId },
    },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
}

function permissionResponse(error: unknown) {
  if (error instanceof PermissionError) {
    return json({ error: error.message }, { status: 403 });
  }

  console.error("PROJECT_MEMBER_ERROR:", error);
  return json(
    { error: "Nem sikerült végrehajtani a projektcsapat műveletet." },
    { status: 500 }
  );
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id: projectId } = await params;
    const currentUser = await requireCurrentUser();
    await requireProjectAccess(currentUser.id, projectId);

    const project = await projectRepository.findUnique({
      where: { id: projectId },
      select: {
        organizationId: true,
        clientId: true,
        members: {
          include: { user: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!project) {
      return json({ error: "Projekt nem található." }, { status: 404 });
    }

    const canManage = await canManageProjectMembers(currentUser.id, projectId);

    const candidates =
      canManage && project.organizationId
        ? await organizationMemberRepository.findMany({
            where: {
              organizationId: project.organizationId,
              user: { projectMemberships: { none: { projectId } } },
              OR: [
                { role: { not: "CLIENT" } },
                { role: "CLIENT", user: { clientContacts: { some: { clientId: project.clientId } } } },
              ],
            },
            include: { user: true },
            orderBy: { user: { name: "asc" } },
          })
        : [];

    return json({
      members: project.members,
      candidates: candidates.map((membership) => ({
        userId: membership.userId,
        name: membership.user.name,
        email: membership.user.email,
        organizationRole: membership.role,
      })),
      canManage,
      currentUserId: currentUser.id,
    });
  } catch (error) {
    return permissionResponse(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id: projectId } = await params;
    const currentUser = await requireCurrentUser();
    await requireProjectManagement(currentUser.id, projectId);

    const body = await request.json();
    const userId = typeof body.userId === "string" ? body.userId : "";
    const role = parseRole(body.role);

    if (!userId || !role) {
      return json(
        { error: "Felhasználó és érvényes projektszerepkör megadása kötelező." },
        { status: 400 }
      );
    }

    const project = await getProjectOrNull(projectId);
    if (!project) {
      return json({ error: "Projekt nem található." }, { status: 404 });
    }
    if (!project.organizationId) {
      return json(
        { error: "A projekt nincs szervezethez rendelve." },
        { status: 400 }
      );
    }

    const organizationMembership = await organizationMemberRepository.findUnique({
      where: {
        organizationId_userId: {
          organizationId: project.organizationId,
          userId,
        },
      },
      select: { id: true, role: true },
    });

    if (!organizationMembership) {
      return json(
        { error: "Csak a projekt szervezetének tagja adható a projekthez." },
        { status: 400 }
      );
    }

    if (organizationMembership.role === "CLIENT") {
      const linkedContact = await clientContactRepository.findFirst({ where: { userId, clientId: project.clientId }, select: { id: true } });
      if (!linkedContact) return json({ error: "Az ügyfélfelhasználó nem ehhez az ügyfélcéghez tartozik." }, { status: 400 });
      if (role !== ProjectRole.CLIENT) return json({ error: "Ügyfélfelhasználó csak CLIENT projektszerepkörrel adható hozzá." }, { status: 400 });
    }

    const existing = await projectMemberRepository.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (existing) {
      return json(
        { error: "Ez a felhasználó már tagja a projektnek." },
        { status: 409 }
      );
    }

    const member = await projectMemberRepository.create({
      data: { projectId, userId, role },
      include: { user: true },
    });

    return json(member, { status: 201 });
  } catch (error) {
    return permissionResponse(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id: projectId } = await params;
    const currentUser = await requireCurrentUser();
    await requireProjectManagement(currentUser.id, projectId);

    const body = await request.json();
    const memberId = typeof body.memberId === "string" ? body.memberId : "";
    const role = parseRole(body.role);

    if (!memberId || !role) {
      return json(
        { error: "Tagság és érvényes projektszerepkör megadása kötelező." },
        { status: 400 }
      );
    }

    const member = await projectMemberRepository.findFirst({
      where: { id: memberId, projectId },
      include: { project: { select: { ownerId: true, organizationId: true, clientId: true } } },
    });

    if (!member) {
      return json({ error: "Projekttag nem található." }, { status: 404 });
    }

    if (member.project.organizationId) {
      const organizationMembership = await organizationMemberRepository.findUnique({
        where: { organizationId_userId: { organizationId: member.project.organizationId, userId: member.userId } },
        select: { role: true },
      });
      if (organizationMembership?.role === "CLIENT" && role !== ProjectRole.CLIENT) {
        return json({ error: "Ügyfélfelhasználó projektszerepköre csak CLIENT lehet." }, { status: 400 });
      }
    }

    if (
      member.role === ProjectRole.PROJECT_MANAGER &&
      role !== ProjectRole.PROJECT_MANAGER
    ) {
      const replacement = await findReplacementManager(projectId, member.userId);
      if (!replacement) {
        return json(
          { error: "A projektnek legalább egy PROJECT_MANAGER szerepkörű taggal rendelkeznie kell." },
          { status: 400 }
        );
      }

      await runInTransaction(async (tx) => {
        await tx.projectMember.update({ where: { id: member.id }, data: { role } });
        if (member.project.ownerId === member.userId) {
          await tx.project.update({
            where: { id: projectId },
            data: { ownerId: replacement.userId },
          });
        }
      });
    } else {
      await projectMemberRepository.update({ where: { id: member.id }, data: { role } });
    }

    const updated = await projectMemberRepository.findUnique({
      where: { id: member.id },
      include: { user: true },
    });

    return json(updated);
  } catch (error) {
    return permissionResponse(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const { id: projectId } = await params;
    const currentUser = await requireCurrentUser();
    await requireProjectManagement(currentUser.id, projectId);

    const body = await request.json();
    const memberId = typeof body.memberId === "string" ? body.memberId : "";

    if (!memberId) {
      return json({ error: "A tagság azonosítója kötelező." }, { status: 400 });
    }

    const member = await projectMemberRepository.findFirst({
      where: { id: memberId, projectId },
      include: { project: { select: { ownerId: true } } },
    });

    if (!member) {
      return json({ error: "Projekttag nem található." }, { status: 404 });
    }

    let replacementManager: { userId: string } | null = null;
    if (member.role === ProjectRole.PROJECT_MANAGER) {
      replacementManager = await findReplacementManager(projectId, member.userId);
      if (!replacementManager) {
        return json(
          { error: "Az utolsó PROJECT_MANAGER nem távolítható el a projektből." },
          { status: 400 }
        );
      }
    }

    await runInTransaction(async (tx) => {
      await tx.projectMember.delete({ where: { id: member.id } });
      if (member.project.ownerId === member.userId && replacementManager) {
        await tx.project.update({
          where: { id: projectId },
          data: { ownerId: replacementManager.userId },
        });
      }
    });

    return json({ success: true });
  } catch (error) {
    return permissionResponse(error);
  }
}
