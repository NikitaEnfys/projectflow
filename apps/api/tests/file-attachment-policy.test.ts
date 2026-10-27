import {
  describe,
  expect,
  it,
} from "vitest";
import {
  CommentVisibility,
} from "@/lib/domain/enums";
import {
  attachmentUploadVisibility,
  attachmentVisibleToUser,
  canDeleteAttachment,
} from "@/lib/files/attachment-policy";

describe(
  "attachment policy",
  () => {
    it("clientViewer csak CLIENT_VISIBLE fájlt lát", () => {
      expect(
        attachmentVisibleToUser({
          clientViewer:
            true,
          visibility:
            CommentVisibility.INTERNAL,
        }),
      ).toBe(false);

      expect(
        attachmentVisibleToUser({
          clientViewer:
            true,
          visibility:
            CommentVisibility.CLIENT_VISIBLE,
        }),
      ).toBe(true);
    });

    it("belső user minden task attachmentet lát", () => {
      expect(
        attachmentVisibleToUser({
          clientViewer:
            false,
          visibility:
            CommentVisibility.INTERNAL,
        }),
      ).toBe(true);
    });

    it("client upload mindig CLIENT_VISIBLE", () => {
      expect(
        attachmentUploadVisibility({
          clientViewer:
            true,
          requested:
            CommentVisibility.INTERNAL,
          taskClientVisible:
            true,
        }),
      ).toBe(
        CommentVisibility.CLIENT_VISIBLE,
      );
    });

    it("nem clientVisible taskon belső user nem tehet CLIENT_VISIBLE fájlt", () => {
      expect(
        attachmentUploadVisibility({
          clientViewer:
            false,
          requested:
            CommentVisibility.CLIENT_VISIBLE,
          taskClientVisible:
            false,
        }),
      ).toBe(
        CommentVisibility.INTERNAL,
      );
    });

    it("uploader törölheti a saját fájlját", () => {
      expect(
        canDeleteAttachment({
          manager: false,
          currentUserId:
            "u1",
          uploadedById:
            "u1",
        }),
      ).toBe(true);
    });

    it("manager törölhet más által feltöltött fájlt", () => {
      expect(
        canDeleteAttachment({
          manager: true,
          currentUserId:
            "manager",
          uploadedById:
            "u1",
        }),
      ).toBe(true);
    });

    it("másik nem-manager nem törölheti a fájlt", () => {
      expect(
        canDeleteAttachment({
          manager: false,
          currentUserId:
            "u2",
          uploadedById:
            "u1",
        }),
      ).toBe(false);
    });
  },
);
