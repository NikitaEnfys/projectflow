import {
  CommentVisibility,
} from "@/lib/domain/enums";

export function attachmentVisibleToUser(
  input: {
    clientViewer: boolean;
    visibility:
      CommentVisibility;
  },
) {
  return (
    !input.clientViewer ||
    input.visibility ===
      CommentVisibility.CLIENT_VISIBLE
  );
}

export function attachmentUploadVisibility(
  input: {
    clientViewer: boolean;
    requested:
      | CommentVisibility
      | null;
    taskClientVisible: boolean;
  },
) {
  if (
    input.clientViewer
  ) {
    return CommentVisibility.CLIENT_VISIBLE;
  }

  if (
    input.requested ===
      CommentVisibility.CLIENT_VISIBLE &&
    input.taskClientVisible
  ) {
    return CommentVisibility.CLIENT_VISIBLE;
  }

  return CommentVisibility.INTERNAL;
}

export function canDeleteAttachment(
  input: {
    manager: boolean;
    currentUserId: string;
    uploadedById: string;
  },
) {
  return (
    input.manager ||
    input.currentUserId ===
      input.uploadedById
  );
}
