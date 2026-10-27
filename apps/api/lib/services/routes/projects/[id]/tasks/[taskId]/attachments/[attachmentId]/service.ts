import {
  CommentVisibility,
} from "@/lib/domain/enums";
import {
  requireCurrentUser,
} from "@/lib/auth/current-user";
import {
  taskAttachmentRepository,
} from "@/lib/repositories";
import {
  resolveTaskAccess,
} from "@/lib/tasks/access";
import {
  attachmentVisibleToUser,
  canDeleteAttachment,
} from "@/lib/files/attachment-policy";
import {
  readStoredFile,
  removeStoredFile,
} from "@/lib/files/storage";
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
    attachmentId: string;
  }>;
};

async function resolveAttachment(
  input: {
    userId: string;
    projectId: string;
    taskId: string;
    attachmentId: string;
  },
) {
  const access =
    await resolveTaskAccess(
      input.userId,
      input.projectId,
      input.taskId,
    );

  if (
    !access ||
    !access.permissions.canView
  ) {
    return null;
  }

  const attachment =
    await taskAttachmentRepository.findFirst({
      where: {
        id:
          input.attachmentId,
        taskId:
          input.taskId,
        task: {
          projectId:
            input.projectId,
        },
      },
      include: {
        task: {
          select: {
            title: true,
            clientVisible:
              true,
          },
        },
      },
    });

  if (
    !attachment ||
    !attachmentVisibleToUser(
      {
        clientViewer:
          access.context
            .clientViewer,
        visibility:
          attachment.visibility,
      },
    )
  ) {
    return null;
  }

  return {
    access,
    attachment,
  };
}

function safeDownloadName(
  name: string,
) {
  return name.replace(
    /["\r\n]/g,
    "_",
  );
}

export async function GET(
  _request: Request,
  { params }: Context,
) {
  const {
    id: projectId,
    taskId,
    attachmentId,
  } = await params;

  const user =
    await requireCurrentUser();

  const resolved =
    await resolveAttachment({
      userId: user.id,
      projectId,
      taskId,
      attachmentId,
    });

  if (!resolved) {
    return json(
      {
        error:
          "A fájl nem található.",
      },
      {
        status: 404,
      },
    );
  }

  try {
    const bytes =
      await readStoredFile(
        resolved.attachment
          .storageKey,
      );

    return new Response(
      bytes,
      {
        headers: {
          "Content-Type":
            resolved.attachment
              .mimeType,
          "Content-Length":
            String(
              bytes.byteLength,
            ),
          "Content-Disposition":
            `attachment; filename="${safeDownloadName(
              resolved.attachment
                .originalName,
            )}"`,
          "Cache-Control":
            "private, no-store",
          "X-Content-Type-Options":
            "nosniff",
        },
      },
    );
  } catch {
    return json(
      {
        error:
          "A fájl tartalma nem érhető el.",
      },
      {
        status: 410,
      },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: Context,
) {
  const {
    id: projectId,
    taskId,
    attachmentId,
  } = await params;

  const user =
    await requireCurrentUser();

  const resolved =
    await resolveAttachment({
      userId: user.id,
      projectId,
      taskId,
      attachmentId,
    });

  if (!resolved) {
    return json(
      {
        error:
          "A fájl nem található.",
      },
      {
        status: 404,
      },
    );
  }

  if (
    !canDeleteAttachment({
      manager:
        resolved.access
          .context.manager,
      currentUserId:
        user.id,
      uploadedById:
        resolved.attachment
          .uploadedById,
    })
  ) {
    return json(
      {
        error:
          "Nincs jogosultságod a fájl törléséhez.",
      },
      {
        status: 403,
      },
    );
  }

  await taskAttachmentRepository.delete({
    where: {
      id:
        resolved.attachment.id,
    },
  });

  await runBestEffortSideEffects(
    "TASK_ATTACHMENT_DELETED",
    [
      {
        name:
          "removeStoredFile",
        run: () =>
          removeStoredFile(
            resolved.attachment
              .storageKey,
          ),
      },
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
              "TASK_ATTACHMENT_DELETED",
            entityType:
              "TaskAttachment",
            entityId:
              resolved.attachment
                .id,
            message:
              `Törölte a(z) „${resolved.attachment.task.title}” feladat fájlját: ${resolved.attachment.originalName}.`,
            metadata: {
              visibility:
                resolved.attachment
                  .visibility,
            },
            clientVisible:
              resolved.attachment
                .visibility ===
                CommentVisibility.CLIENT_VISIBLE &&
              resolved.attachment
                .task
                .clientVisible,
          }),
      },
    ],
  );

  return json({
    success: true,
  });
}
