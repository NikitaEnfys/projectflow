import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuthIdentity } from "@/lib/auth/provider";

export const userWithAccessInclude = {
  memberships: true,
  projectMemberships: true,
} satisfies Prisma.UserInclude;

export type ProjectFlowUser = Prisma.UserGetPayload<{ include: typeof userWithAccessInclude }>;

export interface UserRepository {
  resolveIdentity(identity: AuthIdentity): Promise<ProjectFlowUser>;
}

export class PrismaUserRepository implements UserRepository {
  async resolveIdentity(identity: AuthIdentity): Promise<ProjectFlowUser> {
    const user = await prisma.user.findUnique({
      where: { authUserId: identity.providerUserId },
      include: userWithAccessInclude,
    });
    if (user) return user;

    const existing = await prisma.user.findUnique({ where: { email: identity.email } });
    if (existing) {
      if (existing.authUserId && existing.authUserId !== identity.providerUserId) {
        throw new Error("Ehhez az e-mail címhez már másik Auth-fiók tartozik.");
      }
      return prisma.user.update({
        where: { id: existing.id },
        data: { authUserId: identity.providerUserId, name: existing.name || identity.name },
        include: userWithAccessInclude,
      });
    }

    return prisma.user.create({
      data: { name: identity.name, email: identity.email, authUserId: identity.providerUserId },
      include: userWithAccessInclude,
    });
  }
}

let repository: UserRepository | undefined;
export function getUserRepository(): UserRepository {
  repository ??= new PrismaUserRepository();
  return repository;
}
