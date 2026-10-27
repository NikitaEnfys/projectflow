import {
  OrganizationRole,
} from "@/lib/domain/enums";
import {
  runInTransaction,
} from "@/lib/repositories";

type InvitationRecord = {
  id: string;
  organizationId: string;
  email: string;
  role: OrganizationRole;
  clientId: string | null;
};

type InvitationUser = {
  id: string;
  name: string;
  email: string;
};

type ApplyInvitationMembershipInput = {
  invitation: InvitationRecord;
  user: InvitationUser;
  preserveExistingClientContactName?: boolean;
};

export async function applyOrganizationInvitationMembership({
  invitation,
  user,
  preserveExistingClientContactName = false,
}: ApplyInvitationMembershipInput) {
  const normalizedEmail =
    user.email.toLowerCase();

  return runInTransaction(
    async (tx) => {
      const membership =
        await tx.organizationMember.upsert({
          where: {
            organizationId_userId: {
              organizationId:
                invitation.organizationId,
              userId: user.id,
            },
          },
          update: {
            role: invitation.role,
          },
          create: {
            organizationId:
              invitation.organizationId,
            userId: user.id,
            role: invitation.role,
          },
        });

      if (
        invitation.role ===
          OrganizationRole.CLIENT &&
        invitation.clientId
      ) {
        await tx.clientContact.upsert({
          where: {
            clientId_email: {
              clientId:
                invitation.clientId,
              email: normalizedEmail,
            },
          },
          update:
            preserveExistingClientContactName
              ? {
                  userId: user.id,
                }
              : {
                  userId: user.id,
                  name: user.name,
                },
          create: {
            clientId:
              invitation.clientId,
            userId: user.id,
            name: user.name,
            email: normalizedEmail,
          },
        });
      }

      await tx.organizationInvitation.delete({
        where: {
          id: invitation.id,
        },
      });

      return membership;
    },
  );
}
