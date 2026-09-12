import { getAuthProvider } from "@/lib/auth/provider-factory";
import { createSessionToken } from "@/lib/auth/session";
import { getUserRepository } from "@/lib/repositories/user";

export class AuthService {
  constructor(
    private readonly provider = getAuthProvider(),
    private readonly users = getUserRepository(),
  ) {}

  async login(email: string, password: string) {
    const identity = await this.provider.signIn(email, password);
    const user = await this.users.resolveIdentity(identity);
    return { token: createSessionToken(identity), user };
  }

  async register(input: {
    name: string;
    email: string;
    password: string;
    next: string;
  }) {
    const apiOrigin =
      process.env.API_PUBLIC_URL ?? "http://localhost:3001";

    const callback = `${apiOrigin}/api/auth/callback?next=${encodeURIComponent(
      input.next,
    )}`;

    const result = await this.provider.signUp({
      ...input,
      emailRedirectTo: callback,
    });

    if (!result.authenticated || !result.identity) {
      return {
        authenticated: false as const,
        requiresEmailConfirmation: result.requiresEmailConfirmation,
      };
    }

    const user = await this.users.resolveIdentity(result.identity);

    return {
      authenticated: true as const,
      requiresEmailConfirmation: false,
      token: createSessionToken(result.identity),
      user,
    };
  }

  async completeCallback(code: string) {
    const identity = await this.provider.exchangeCode(code);
    const user = await this.users.resolveIdentity(identity);
    return { token: createSessionToken(identity), user };
  }

  async invitedAccountExists(email: string) {
    return this.provider.invitedAccountExists(email);
  }

  async prepareInvitedAccount(input: {
    name: string;
    email: string;
    password: string;
  }) {
    const identity = await this.provider.prepareInvitedAccount(input);
    const user = await this.users.resolveIdentity(identity);

    return {
      identity,
      user,
      token: createSessionToken(identity),
    };
  }
}

let service: AuthService | undefined;

export function getAuthService() {
  service ??= new AuthService();
  return service;
}
