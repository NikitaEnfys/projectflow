import { describe, expect, it } from "vitest";
import {
  ProjectRole,
  TaskApprovalDecision,
  TaskStatus,
} from "@/lib/domain/enums";
import {
  buildTaskPermissions,
  type TaskAccessContext,
} from "@/lib/tasks/permission-policy";

function context(overrides: Partial<TaskAccessContext> = {}): TaskAccessContext {
  return { userId: "user-1", projectId: "project-1", manager: false, internalMember: false, clientViewer: false, projectRole: null, ...overrides };
}

function task(overrides: Partial<{ id: string; creatorId: string; assigneeId: string | null; clientVisible: boolean; requiresApproval: boolean; status: string; }> = {}) {
  return { id: "task-1", creatorId: "creator-2", assigneeId: null, clientVisible: false, requiresApproval: false, status: TaskStatus.TODO, ...overrides };
}

describe("buildTaskPermissions", () => {
  it("projektvezető normál taskon teljes kezelési jogosultságot kap", () => {
    const p = buildTaskPermissions(context({ manager: true, internalMember: true, projectRole: ProjectRole.PROJECT_MANAGER }), task(), null);
    expect(p).toMatchObject({ canView: true, canEdit: true, canDelete: true, canChangeStatus: true, canComment: true, canModerateComments: true, canConfigureApproval: true });
  });

  it("AWAITING_APPROVAL taskot manager sem szerkeszthet vagy mozgathat közvetlenül", () => {
    const p = buildTaskPermissions(context({ manager: true, internalMember: true, projectRole: ProjectRole.PROJECT_MANAGER }), task({ status: TaskStatus.AWAITING_APPROVAL, requiresApproval: true }), null);
    expect(p.canView).toBe(true);
    expect(p.canEdit).toBe(false);
    expect(p.canChangeStatus).toBe(false);
    expect(p.canConfigureApproval).toBe(false);
  });

  it("manager AWAITING_APPROVAL állapotban is törölheti a taskot a jelenlegi policy szerint", () => {
    const p = buildTaskPermissions(context({ manager: true, internalMember: true }), task({ status: TaskStatus.AWAITING_APPROVAL }), null);
    expect(p.canDelete).toBe(true);
  });

  it("MEMBER a saját task státuszát módosíthatja", () => {
    const p = buildTaskPermissions(context({ internalMember: true, projectRole: ProjectRole.MEMBER }), task({ assigneeId: "user-1" }), null);
    expect(p.canView).toBe(true);
    expect(p.canEdit).toBe(false);
    expect(p.canChangeStatus).toBe(true);
    expect(p.canDelete).toBe(false);
  });

  it("MEMBER más felhasználó taskjának státuszát nem módosíthatja", () => {
    const p = buildTaskPermissions(context({ internalMember: true, projectRole: ProjectRole.MEMBER }), task({ assigneeId: "user-2" }), null);
    expect(p.canView).toBe(true);
    expect(p.canChangeStatus).toBe(false);
  });

  it("CONTRACTOR a saját task státuszát módosíthatja", () => {
    const p = buildTaskPermissions(context({ internalMember: true, projectRole: ProjectRole.CONTRACTOR }), task({ assigneeId: "user-1" }), null);
    expect(p.canChangeStatus).toBe(true);
    expect(p.canEdit).toBe(false);
  });

  it("belső tag a projekt minden taskját láthatja, de csak a sajátját mozgathatja", () => {
    const p = buildTaskPermissions(context({ internalMember: true, projectRole: ProjectRole.MEMBER }), task({ assigneeId: null, clientVisible: false }), null);
    expect(p.canView).toBe(true);
    expect(p.canComment).toBe(true);
    expect(p.canChangeStatus).toBe(false);
  });

  it("ügyfél nem lát nem clientVisible taskot", () => {
    const p = buildTaskPermissions(context({ clientViewer: true, projectRole: ProjectRole.CLIENT }), task({ clientVisible: false }), null);
    expect(p.canView).toBe(false);
    expect(p.canComment).toBe(false);
    expect(p.canDecideApproval).toBe(false);
  });

  it("ügyfél a clientVisible taskot láthatja és kommentelheti, de nem szerkesztheti", () => {
    const p = buildTaskPermissions(context({ clientViewer: true, projectRole: ProjectRole.CLIENT }), task({ clientVisible: true }), null);
    expect(p.canView).toBe(true);
    expect(p.canComment).toBe(true);
    expect(p.canEdit).toBe(false);
    expect(p.canDelete).toBe(false);
    expect(p.canChangeStatus).toBe(false);
  });

  it("kapcsolat nélküli felhasználó semmilyen task-műveletet nem kap", () => {
    const p = buildTaskPermissions(context(), task({ clientVisible: true }), null);
    expect(p).toEqual({ canView: false, canEdit: false, canDelete: false, canChangeStatus: false, canComment: false, canModerateComments: false, canConfigureApproval: false, canSubmitForApproval: false, canDecideApproval: false });
  });

  it("saját taskjára kiosztott belső tag jóváhagyásra küldhet jóváhagyásköteles taskot", () => {
    const p = buildTaskPermissions(context({ internalMember: true, projectRole: ProjectRole.CONTRACTOR }), task({ assigneeId: "user-1", requiresApproval: true, status: TaskStatus.REVIEW }), null);
    expect(p.canSubmitForApproval).toBe(true);
  });

  it("más felhasználó taskját MEMBER nem küldheti jóváhagyásra", () => {
    const p = buildTaskPermissions(context({ internalMember: true, projectRole: ProjectRole.MEMBER }), task({ assigneeId: "user-2", requiresApproval: true, status: TaskStatus.REVIEW }), null);
    expect(p.canSubmitForApproval).toBe(false);
  });

  it("nem approval-köteles taskot nem lehet approvalra küldeni", () => {
    const p = buildTaskPermissions(context({ manager: true, internalMember: true }), task({ requiresApproval: false, status: TaskStatus.REVIEW }), null);
    expect(p.canSubmitForApproval).toBe(false);
  });

  it("DONE taskot nem lehet újra jóváhagyásra küldeni", () => {
    const p = buildTaskPermissions(context({ manager: true, internalMember: true }), task({ requiresApproval: true, status: TaskStatus.DONE }), null);
    expect(p.canSubmitForApproval).toBe(false);
  });

  it("AWAITING_APPROVAL taskot nem lehet újra jóváhagyásra küldeni", () => {
    const p = buildTaskPermissions(context({ manager: true, internalMember: true }), task({ requiresApproval: true, status: TaskStatus.AWAITING_APPROVAL }), null);
    expect(p.canSubmitForApproval).toBe(false);
  });

  it("pending saját approval esetén ügyfél-jóváhagyó dönthet clientVisible taskon", () => {
    const p = buildTaskPermissions(context({ clientViewer: true, projectRole: ProjectRole.CLIENT }), task({ clientVisible: true, requiresApproval: true, status: TaskStatus.AWAITING_APPROVAL }), { id: "approval-1", approverId: "user-1", decision: TaskApprovalDecision.PENDING });
    expect(p.canDecideApproval).toBe(true);
  });

  it("nem clientVisible taskon ügyfél akkor sem dönthet, ha pending approval rekordja van", () => {
    const p = buildTaskPermissions(context({ clientViewer: true, projectRole: ProjectRole.CLIENT }), task({ clientVisible: false, requiresApproval: true, status: TaskStatus.AWAITING_APPROVAL }), { id: "approval-1", approverId: "user-1", decision: TaskApprovalDecision.PENDING });
    expect(p.canView).toBe(false);
    expect(p.canDecideApproval).toBe(false);
  });

  it("már APPROVED approval nem ad új döntési jogosultságot", () => {
    const p = buildTaskPermissions(context({ clientViewer: true, projectRole: ProjectRole.CLIENT }), task({ clientVisible: true, requiresApproval: true, status: TaskStatus.AWAITING_APPROVAL }), { id: "approval-1", approverId: "user-1", decision: TaskApprovalDecision.APPROVED });
    expect(p.canDecideApproval).toBe(false);
  });

  it("REJECTED approval nem ad új döntési jogosultságot", () => {
    const p = buildTaskPermissions(context({ clientViewer: true, projectRole: ProjectRole.CLIENT }), task({ clientVisible: true, requiresApproval: true, status: TaskStatus.AWAITING_APPROVAL }), { id: "approval-1", approverId: "user-1", decision: TaskApprovalDecision.REJECTED });
    expect(p.canDecideApproval).toBe(false);
  });

  it("approval rekord nélkül nincs döntési jogosultság", () => {
    const p = buildTaskPermissions(context({ clientViewer: true, projectRole: ProjectRole.CLIENT }), task({ clientVisible: true, requiresApproval: true, status: TaskStatus.AWAITING_APPROVAL }), null);
    expect(p.canDecideApproval).toBe(false);
  });

  it("manager csak AWAITING_APPROVAL állapoton kívül konfigurálhat approvalt", () => {
    const editable = buildTaskPermissions(context({ manager: true, internalMember: true }), task({ status: TaskStatus.REVIEW }), null);
    const locked = buildTaskPermissions(context({ manager: true, internalMember: true }), task({ status: TaskStatus.AWAITING_APPROVAL }), null);
    expect(editable.canConfigureApproval).toBe(true);
    expect(locked.canConfigureApproval).toBe(false);
  });
  it("a saját maga által létrehozott taskot a MEMBER szerkesztheti és approvalt konfigurálhat", () => {
    const permissions =
      buildTaskPermissions(
        context({
          internalMember:
            true,
          projectRole:
            ProjectRole.MEMBER,
        }),
        task({
          creatorId:
            "user-1",
          requiresApproval:
            true,
        }),
        null,
      );

    expect(
      permissions.canEdit,
    ).toBe(true);
    expect(
      permissions.canConfigureApproval,
    ).toBe(true);
    expect(
      permissions.canSubmitForApproval,
    ).toBe(true);
    expect(
      permissions.canDelete,
    ).toBe(false);
  });

  it("a más által létrehozott, nem kiosztott taskot a MEMBER nem szerkesztheti", () => {
    const permissions =
      buildTaskPermissions(
        context({
          internalMember:
            true,
          projectRole:
            ProjectRole.MEMBER,
        }),
        task({
          creatorId:
            "user-2",
          assigneeId:
            null,
        }),
        null,
      );

    expect(
      permissions.canEdit,
    ).toBe(false);
    expect(
      permissions.canConfigureApproval,
    ).toBe(false);
  });

});
