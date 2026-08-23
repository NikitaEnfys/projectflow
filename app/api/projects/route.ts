import { NextResponse } from "next/server";
import { ProjectPriority, ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentAccessContext, projectVisibilityWhere } from "@/lib/auth/access";
import { canCreateProject } from "@/lib/permissions";

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET() {
  const { user, oversightOrganizationIds, linkedClientIds } = await getCurrentAccessContext();
  const projects = await prisma.project.findMany({
    where: projectVisibilityWhere(user.id, oversightOrganizationIds, linkedClientIds),
    include: { client: true, owner: true, members: { include: { user: true } }, milestones: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(projects);
}

export async function POST(req: Request) {
  try {
    const { user } = await getCurrentAccessContext();
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || !body.clientId || !body.ownerId) {
      return NextResponse.json({ error: "A projekt neve, ügyfele és felelőse kötelező." }, { status: 400 });
    }

    const client = await prisma.client.findUnique({ where: { id: body.clientId }, select: { organizationId: true } });
    if (!client?.organizationId) return NextResponse.json({ error: "A kiválasztott ügyfél nem található vagy nincs szervezethez rendelve." }, { status: 404 });
    if (!(await canCreateProject(user.id, client.organizationId))) return NextResponse.json({ error: "Nincs jogosultságod projektet létrehozni." }, { status: 403 });

    const ownerMembership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: client.organizationId, userId: body.ownerId } },
    });
    if (!ownerMembership) return NextResponse.json({ error: "A kiválasztott felelős nem tagja az ügyfél szervezetének." }, { status: 400 });

    const startDate = parseDate(body.startDate);
    const dueDate = parseDate(body.dueDate);
    if (startDate && dueDate && dueDate < startDate) {
      return NextResponse.json({ error: "A határidő nem lehet korábbi a kezdési dátumnál." }, { status: 400 });
    }
    const status = Object.values(ProjectStatus).includes(body.status) ? body.status : ProjectStatus.PLANNING;
    const priority = Object.values(ProjectPriority).includes(body.priority) ? body.priority : ProjectPriority.MEDIUM;
    const progress = Number.isInteger(body.progress) ? Math.min(100, Math.max(0, body.progress)) : 0;

    const project = await prisma.project.create({
      data: {
        name,
        description: typeof body.description === "string" && body.description.trim() ? body.description.trim() : null,
        clientId: body.clientId,
        ownerId: body.ownerId,
        organizationId: client.organizationId,
        status,
        priority,
        startDate,
        dueDate,
        progress,
        members: { create: { userId: body.ownerId, role: "PROJECT_MANAGER" } },
      },
      include: { members: { include: { user: true } }, milestones: true },
    });
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("PROJECT_CREATE_ERROR:", error);
    return NextResponse.json({ error: "Nem sikerült létrehozni a projektet.", details: error instanceof Error ? error.message : "Ismeretlen hiba" }, { status: 500 });
  }
}
