export type AuthIdentity = {
  providerUserId: string;
  email: string;
  name: string;
};

export type RegistrationResult = {
  identity: AuthIdentity | null;
  authenticated: boolean;
  requiresEmailConfirmation: boolean;
};

export interface AuthProvider {
  signIn(email: string, password: string): Promise<AuthIdentity>;
  signUp(input: { name: string; email: string; password: string; emailRedirectTo: string }): Promise<RegistrationResult>;
  exchangeCode(code: string): Promise<AuthIdentity>;
}
