import { json } from "@/lib/http/response";
import { MilestoneStatus } from "@/lib/domain/enums";
import { milestoneRepository } from "@/lib/repositories";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { canManageProject } from "@/lib/permissions";
import { logActivity } from "@/lib/activity/log";

type Ctx = { params: Promise<{ id: string; milestoneId: string }> };

function parseDate(value: unknown) {
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id: projectId, milestoneId } = await params;
  const currentUser = await requireCurrentUser();
  if (!(await canManageProject(currentUser.id, projectId))) {
    return json({ error: "Nincs jogosultságod a mérföldkő módosításához." }, { status: 403 });
  }

  const existing = await milestoneRepository.findFirst({ where: { id: milestoneId, projectId } });
  if (!existing) return json({ error: "A mérföldkő nem található." }, { status: 404 });

  const body = await request.json();
  const data: {
    name?: string;
    description?: string | null;
    status?: MilestoneStatus;
    dueDate?: Date | null;
  } = {};

  if ("name" in body) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return json({ error: "A mérföldkő neve kötelező." }, { status: 400 });
    data.name = name;
  }
  if ("description" in body) data.description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
  if ("status" in body) {
    if (!Object.values(MilestoneStatus).includes(body.status)) return json({ error: "Érvénytelen státusz." }, { status: 400 });
    data.status = body.status;
  }
  if ("dueDate" in body) {
    const dueDate = parseDate(body.dueDate);
    if (dueDate === undefined) return json({ error: "Érvénytelen határidő." }, { status: 400 });
    data.dueDate = dueDate;
  }

  const updated = await milestoneRepository.update({ where: { id: existing.id }, data });
  await logActivity({ projectId, userId:currentUser.id, action:"MILESTONE_UPDATED", entityType:"Milestone", entityId:updated.id, message:`Módosította a(z) „${updated.name}” mérföldkövet.`, metadata:{fromStatus:existing.status,toStatus:updated.status} });
  return json(updated);
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { id: projectId, milestoneId } = await params;
  const currentUser = await requireCurrentUser();
  if (!(await canManageProject(currentUser.id, projectId))) {
    return json({ error: "Nincs jogosultságod a mérföldkő törléséhez." }, { status: 403 });
  }
  const existing = await milestoneRepository.findFirst({ where: { id: milestoneId, projectId } });
  if (!existing) return json({ error: "A mérföldkő nem található." }, { status: 404 });
  await milestoneRepository.delete({ where: { id: existing.id } });
  await logActivity({ projectId, userId:currentUser.id, action:"MILESTONE_DELETED", entityType:"Milestone", entityId:existing.id, message:`Törölte a(z) „${existing.name}” mérföldkövet.` });
  return json({ success: true });
}
