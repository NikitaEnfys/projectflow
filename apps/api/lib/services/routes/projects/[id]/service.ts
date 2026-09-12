import { json } from "@/lib/http/response";
import {
  ProjectPriority,
  ProjectStatus,
} from "@/lib/domain/enums";
import { projectRepository } from "@/lib/repositories";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { canManageProject } from "@/lib/permissions";

type Ctx = { params: Promise<{ id: string }> };

function parseDate(value: unknown) {
  if (value === "" || value === null) return null;
  if (typeof value !== "string") return undefined;

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const currentUser = await requireCurrentUser();

  if (!(await canManageProject(currentUser.id, id))) {
    return json(
      { error: "Nincs jogosultságod a projekt módosításához." },
      { status: 403 },
    );
  }

  const existing = await projectRepository.findUnique({
    where: { id },
  });

  if (!existing) {
    return json({ error: "Projekt nem található." }, { status: 404 });
  }

  const body = await request.json();

  const data: {
    name?: string;
    description?: string | null;
    status?: ProjectStatus;
    priority?: ProjectPriority;
    startDate?: Date | null;
    dueDate?: Date | null;
  } = {};

  if ("name" in body) {
    const name =
      typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return json(
        { error: "A projekt neve kötelező." },
        { status: 400 },
      );
    }

    data.name = name;
  }

  if ("description" in body) {
    data.description =
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : null;
  }

  if ("status" in body) {
    if (!Object.values(ProjectStatus).includes(body.status)) {
      return json(
        { error: "Érvénytelen projektstátusz." },
        { status: 400 },
      );
    }

    data.status = body.status;
  }

  if ("priority" in body) {
    if (!Object.values(ProjectPriority).includes(body.priority)) {
      return json(
        { error: "Érvénytelen prioritás." },
        { status: 400 },
      );
    }

    data.priority = body.priority;
  }

  const startDate =
    "startDate" in body ? parseDate(body.startDate) : existing.startDate;
  const dueDate =
    "dueDate" in body ? parseDate(body.dueDate) : existing.dueDate;

  if (startDate === undefined) {
    return json(
      { error: "Érvénytelen kezdési dátum." },
      { status: 400 },
    );
  }

  if (dueDate === undefined) {
    return json(
      { error: "Érvénytelen határidő." },
      { status: 400 },
    );
  }

  if (startDate && dueDate && dueDate < startDate) {
    return json(
      { error: "A határidő nem lehet korábbi a kezdési dátumnál." },
      { status: 400 },
    );
  }

  if ("startDate" in body) data.startDate = startDate;
  if ("dueDate" in body) data.dueDate = dueDate;

  const updated = await projectRepository.update({
    where: { id },
    data,
    include: {
      client: true,
      owner: true,
    },
  });

  return json(updated);
}

export async function DELETE(_: Request, { params }: Ctx) {
  const { id } = await params;
  const currentUser = await requireCurrentUser();

  if (!(await canManageProject(currentUser.id, id))) {
    return json(
      { error: "Nincs jogosultságod a projekt törléséhez." },
      { status: 403 },
    );
  }

  const project = await projectRepository.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!project) {
    return json({ error: "Projekt nem található." }, { status: 404 });
  }

  await projectRepository.delete({ where: { id } });

  return json({ success: true });
}
