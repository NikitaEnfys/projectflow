import { NextResponse } from "next/server";
import { MilestoneStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { requireProjectAccess, requireProjectManagement } from "@/lib/permissions";
import { logActivity } from "@/lib/activity/log";

type Context = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Context) {
  const { id } = await params;
  const user = await requireCurrentUser();
  await requireProjectAccess(user.id, id);
  const milestones = await prisma.milestone.findMany({ where: { projectId: id }, orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }] });
  return NextResponse.json(milestones);
}

export async function POST(req: Request, { params }: Context) {
  try {
    const { id } = await params;
    const user = await requireCurrentUser();
    await requireProjectManagement(user.id, id);
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "A mérföldkő neve kötelező." }, { status: 400 });
    const dueDate = typeof body.dueDate === "string" && body.dueDate ? new Date(`${body.dueDate}T00:00:00`) : null;
    const status = Object.values(MilestoneStatus).includes(body.status) ? body.status : MilestoneStatus.PLANNED;
    const milestone = await prisma.milestone.create({
      data: { projectId: id, name, description: typeof body.description === "string" && body.description.trim() ? body.description.trim() : null, dueDate, status },
    });
    await logActivity({ projectId:id, userId:user.id, action:"MILESTONE_CREATED", entityType:"Milestone", entityId:milestone.id, message:`Létrehozta a(z) „${milestone.name}” mérföldkövet.` });
    return NextResponse.json(milestone, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Nem sikerült létrehozni a mérföldkövet.", details: error instanceof Error ? error.message : "Ismeretlen hiba" }, { status: 500 });
  }
}
