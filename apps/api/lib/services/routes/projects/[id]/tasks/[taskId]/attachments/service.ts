import {
  createHash,
  randomUUID,
} from "node:crypto";
import {
  CommentVisibility,
} from "@/lib/domain/enums";
import {
  requireCurrentUser,
} from "@/lib/auth/current-user";
import {
  taskAttachmentRepository,
  taskRepository,
} from "@/lib/repositories";
import {
  resolveTaskAccess,
} from "@/lib/tasks/access";
import {
  AttachmentValidationError,
  MAX_ATTACHMENT_BYTES,
  validateAttachment,
} from "@/lib/files/validation";
import {
  removeStoredFile,
  writeStoredFile,
} from "@/lib/files/storage";
import {
  attachmentUploadVisibility,
} from "@/lib/files/attachment-policy";
import {
  logActivity,
} from "@/lib/activity/log";
import {
  runBestEffortSideEffects,
} from "@/lib/side-effects/best-effort";
import {
  json,
} from "@/lib/http/response";

type Context = {
  params: Promise<{
    id: string;
    taskId: string;
  }>;
};

const MAX_MULTIPART_BYTES =
  MAX_ATTACHMENT_BYTES +
  256 * 1024;

const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  email: true,
} as const;

async function visibleAccess(
  userId: string,
  projectId: string,
  taskId: string,
) {
  const access =
    await resolveTaskAccess(
      userId,
      projectId,
      taskId,
    );

  if (
    !access ||
    !access.permissions.canView
  ) {
    return null;
  }

  return access;
}

export async function GET(
  _request: Request,
  { params }: Context,
) {
  const {
    id: projectId,
    taskId,
  } = await params;

  const user =
    await requireCurrentUser();

  const access =
    await visibleAccess(
      user.id,
      projectId,
      taskId,
    );

  if (!access) {
    return json(
      {
        error:
          "A feladat nem található.",
      },
      {
        status: 404,
      },
    );
  }

  const attachments =
    await taskAttachmentRepository.findMany({
      where: {
        taskId,
        ...(access.context.clientViewer
          ? {
              visibility:
                CommentVisibility.CLIENT_VISIBLE,
            }
          : {}),
      },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        sha256: true,
        visibility: true,
        createdAt: true,
        uploadedById: true,
        uploadedBy: {
          select:
            PUBLIC_USER_SELECT,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

  return json(
    attachments,
  );
}

export async function POST(
  request: Request,
  { params }: Context,
) {
  const {
    id: projectId,
    taskId,
  } = await params;

  const user =
    await requireCurrentUser();

  const access =
    await visibleAccess(
      user.id,
      projectId,
      taskId,
    );

  if (
    !access ||
    !access.permissions.canComment
  ) {
    return json(
      {
        error:
          "Nincs jogosultságod fájlt feltölteni ehhez a feladathoz.",
      },
      {
        status: 403,
      },
    );
  }

  const contentLength =
    Number(
      request.headers.get(
        "content-length",
      ) ?? 0,
    );

  if (
    Number.isFinite(
      contentLength,
    ) &&
    contentLength >
      MAX_MULTIPART_BYTES
  ) {
    return json(
      {
        error:
          "A feltöltési kérés túl nagy.",
      },
      {
        status: 413,
      },
    );
  }

  const task =
    await taskRepository.findFirst({
      where: {
        id: taskId,
        projectId,
      },
      select: {
        id: true,
        title: true,
        clientVisible:
          true,
      },
    });

  if (!task) {
    return json(
      {
        error:
          "A feladat nem található.",
      },
      {
        status: 404,
      },
    );
  }

  let formData: FormData;

  try {
    formData =
      await request.formData();
  } catch {
    return json(
      {
        error:
          "Érvénytelen multipart feltöltés.",
      },
      {
        status: 400,
      },
    );
  }

  const file =
    formData.get("file");

  if (
    !(file instanceof File)
  ) {
    return json(
      {
        error:
          "A file mező kötelező.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    file.size >
    MAX_ATTACHMENT_BYTES
  ) {
    return json(
      {
        error:
          "A fájl legfeljebb 10 MB lehet.",
      },
      {
        status: 413,
      },
    );
  }

  const requestedVisibility =
    formData.get(
      "visibility",
    );

  const visibility =
    attachmentUploadVisibility({
      clientViewer:
        access.context
          .clientViewer,
      requested:
        requestedVisibility ===
          CommentVisibility.CLIENT_VISIBLE
          ? CommentVisibility.CLIENT_VISIBLE
          : requestedVisibility ===
              CommentVisibility.INTERNAL
            ? CommentVisibility.INTERNAL
            : null,
      taskClientVisible:
        task.clientVisible,
    });

  const bytes =
    new Uint8Array(
      await file.arrayBuffer(),
    );

  let validated;

  try {
    validated =
      validateAttachment({
        name: file.name,
        type: file.type,
        bytes,
      });
  } catch (error) {
    if (
      error instanceof
      AttachmentValidationError
    ) {
      return json(
        {
          error:
            error.message,
        },
        {
          status: 400,
        },
      );
    }

    throw error;
  }

  const storageKey =
    `${randomUUID()}${validated.extension}`;

  const sha256 =
    createHash("sha256")
      .update(bytes)
      .digest("hex");

  await writeStoredFile(
    storageKey,
    bytes,
    validated.mimeType,
  );

  try {
    const attachment =
      await taskAttachmentRepository.create({
        data: {
          taskId,
          uploadedById:
            user.id,
          originalName:
            file.name,
          storageKey,
          mimeType:
            validated.mimeType,
          sizeBytes:
            bytes.byteLength,
          sha256,
          visibility,
        },
        select: {
          id: true,
          originalName:
            true,
          mimeType: true,
          sizeBytes: true,
          sha256: true,
          visibility: true,
          createdAt: true,
          uploadedById:
            true,
          uploadedBy: {
            select:
              PUBLIC_USER_SELECT,
          },
        },
      });

    await runBestEffortSideEffects(
      "TASK_ATTACHMENT_UPLOADED",
      [
        {
          name:
            "logActivity",
          run: () =>
            logActivity({
              projectId,
              taskId,
              userId:
                user.id,
              action:
                "TASK_ATTACHMENT_UPLOADED",
              entityType:
                "TaskAttachment",
              entityId:
                attachment.id,
              message:
                `Fájlt töltött fel a(z) „${task.title}” feladathoz: ${attachment.originalName}.`,
              metadata: {
                mimeType:
                  attachment.mimeType,
                sizeBytes:
                  attachment.sizeBytes,
                sha256:
                  attachment.sha256,
                visibility:
                  attachment.visibility,
              },
              clientVisible:
                attachment.visibility ===
                  CommentVisibility.CLIENT_VISIBLE &&
                task.clientVisible,
            }),
        },
      ],
    );

    return json(
      attachment,
      {
        status: 201,
      },
    );
  } catch (error) {
    await removeStoredFile(
      storageKey,
    ).catch(
      () => undefined,
    );

    throw error;
  }
}
