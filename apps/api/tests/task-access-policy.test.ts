import { describe, expect, it } from "vitest";
import {
  OrganizationRole,
  ProjectRole,
} from "@/lib/domain/enums";
import {
  deriveTaskAccessContext,
  type TaskAccessInputs,
} from "@/lib/tasks/access-policy";

function input(
  overrides: Partial<TaskAccessInputs> = {},
): TaskAccessInputs {
  return {
    userId: "user-1",
    projectId: "project-1",
    projectRole: null,
    organizationRole: null,
    linkedProjectContact: false,
    ...overrides,
  };
}

describe("deriveTaskAccessContext", () => {
  it("projekt PROJECT_MANAGER szerepkörből manager hozzáférést ad", () => {
    const access = deriveTaskAccessContext(input({ projectRole: ProjectRole.PROJECT_MANAGER }));
    expect(access).toMatchObject({ manager: true, internalMember: true, clientViewer: false, projectRole: ProjectRole.PROJECT_MANAGER });
  });

  it.each([OrganizationRole.OWNER, OrganizationRole.ADMIN, OrganizationRole.PROJECT_MANAGER])(
    "%s szervezeti szerepkörből manager hozzáférést ad",
    (organizationRole) => {
      const access = deriveTaskAccessContext(input({ organizationRole }));
      expect(access.manager).toBe(true);
      expect(access.internalMember).toBe(true);
      expect(access.clientViewer).toBe(false);
    },
  );

  it("MEMBER projekttag belső tag, de nem manager", () => {
    const access = deriveTaskAccessContext(input({ projectRole: ProjectRole.MEMBER }));
    expect(access.manager).toBe(false);
    expect(access.internalMember).toBe(true);
    expect(access.clientViewer).toBe(false);
  });

  it("CONTRACTOR projekttag belső tag, de nem manager", () => {
    const access = deriveTaskAccessContext(input({ projectRole: ProjectRole.CONTRACTOR }));
    expect(access.manager).toBe(false);
    expect(access.internalMember).toBe(true);
    expect(access.clientViewer).toBe(false);
  });

  it("CLIENT projekttag ügyfél nézetet kap", () => {
    const access = deriveTaskAccessContext(input({ projectRole: ProjectRole.CLIENT }));
    expect(access.manager).toBe(false);
    expect(access.internalMember).toBe(false);
    expect(access.clientViewer).toBe(true);
  });

  it("ProjectClientContact kapcsolat önmagában ügyfél nézetet ad", () => {
    const access = deriveTaskAccessContext(input({ linkedProjectContact: true }));
    expect(access.manager).toBe(false);
    expect(access.internalMember).toBe(false);
    expect(access.clientViewer).toBe(true);
  });

  it("kapcsolat nélküli felhasználó nem kap task-hozzáférési szerepet", () => {
    const access = deriveTaskAccessContext(input());
    expect(access.manager).toBe(false);
    expect(access.internalMember).toBe(false);
    expect(access.clientViewer).toBe(false);
  });

  it("belső MEMBER tagság elsőbbséget élvez a ProjectClientContact kapcsolattal szemben", () => {
    const access = deriveTaskAccessContext(input({ projectRole: ProjectRole.MEMBER, linkedProjectContact: true }));
    expect(access.internalMember).toBe(true);
    expect(access.clientViewer).toBe(false);
  });

  it("szervezeti ADMIN elsőbbséget élvez a CLIENT projektszereppel szemben", () => {
    const access = deriveTaskAccessContext(input({ projectRole: ProjectRole.CLIENT, organizationRole: OrganizationRole.ADMIN, linkedProjectContact: true }));
    expect(access.manager).toBe(true);
    expect(access.internalMember).toBe(true);
    expect(access.clientViewer).toBe(false);
  });

  it("OrganizationRole.MEMBER önmagában nem ad projekt task-hozzáférést", () => {
    const access = deriveTaskAccessContext(input({ organizationRole: OrganizationRole.MEMBER }));
    expect(access.manager).toBe(false);
    expect(access.internalMember).toBe(false);
    expect(access.clientViewer).toBe(false);
  });

  it("OrganizationRole.CLIENT önmagában nem helyettesíti a projekt-specifikus ügyfélkapcsolatot", () => {
    const access = deriveTaskAccessContext(input({ organizationRole: OrganizationRole.CLIENT }));
    expect(access.manager).toBe(false);
    expect(access.internalMember).toBe(false);
    expect(access.clientViewer).toBe(false);
  });

  it("megőrzi a felhasználó és projekt azonosítóját a permission réteg számára", () => {
    const access = deriveTaskAccessContext(input({ userId: "user-demo", projectId: "project-demo", linkedProjectContact: true }));
    expect(access.userId).toBe("user-demo");
    expect(access.projectId).toBe("project-demo");
  });
});
