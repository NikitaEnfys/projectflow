export const PROJECT_ROLES = ["PROJECT_MANAGER", "MEMBER", "CONTRACTOR", "CLIENT"] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const ORGANIZATION_ROLES = ["OWNER", "ADMIN", "PROJECT_MANAGER", "MEMBER", "CONTRACTOR", "CLIENT"] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export type ApiError = { error: string; details?: string };

export type AccessResponse = {
  user: { id: string; name: string; email: string };
  canCreateClient: boolean;
  canCreateProject: boolean;
  canManageOrganization: boolean;
  canViewClients: boolean;
};

export type AuthUser = { id: string; name: string; email: string };
export type AuthMeResponse = { user: AuthUser };
export type LoginRequest = { email: string; password: string };
export type LoginResponse = { user: AuthUser };
export type RegisterRequest = { name: string; email: string; password: string; next?: string };
export type RegisterResponse = {
  authenticated: boolean;
  requiresEmailConfirmation: boolean;
  user?: AuthUser;
};

export const SESSION_COOKIE_NAME = "projectflow_session";
