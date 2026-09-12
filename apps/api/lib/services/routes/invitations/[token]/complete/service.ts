import { NextResponse } from "next/server";
import { OrganizationRole } from "@/lib/domain/enums";
import {
  organizationInvitationRepository,
  runInTransaction,
} from "@/lib/repositories";
import { getAuthService } from "@/lib/auth/service";
import { setSessionCookie } from "@/lib/auth/session";

type Ctx = {
  params: Promise<{ token: string }>;
};

export async function POST(request: Request, { params }: Ctx) {
  const { token } = await params;

  const invitation =
    await organizationInvitationRepository.findUnique({
      where: { token },
      include: {
        client: {
          select: { id: true, name: true },
        },
      },
    });

  if (!invitation) {
    return NextResponse.json(
      {
        error:
          "A meghívó nem található vagy már felhasználták.",
      },
      { status: 404 },
    );
  }

  if (invitation.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "A meghívó lejárt." },
      { status: 410 },
    );
  }

  if (
    invitation.role === OrganizationRole.CLIENT &&
    !invitation.clientId
  ) {
    return NextResponse.json(
      {
        error:
          "Az ügyfélmeghívó nincs ügyfélcéghez rendelve. Kérj új meghívót.",
      },
      { status: 400 },
    );
  }

  const body = await request.json();
  const password =
    typeof body.password === "string" ? body.password : "";

  if (password.length < 6) {
    return NextResponse.json(
      { error: "A jelszó legalább 6 karakter legyen." },
      { status: 400 },
    );
  }

  const normalizedEmail = invitation.email.toLowerCase();

  const name =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim()
      : normalizedEmail.split("@")[0];

  try {
    /**
     * The invitation token is the proof that the visitor has access to the
     * invited e-mail address. For an existing Supabase account we update its
     * password; for a new address we create a confirmed auth user.
     *
     * This intentionally avoids a second "registration" form and also repairs
     * the common state where the ProjectFlow User row was removed but the
     * Supabase Auth account still exists.
     */
    const prepared = await getAuthService().prepareInvitedAccount({
      name,
      email: normalizedEmail,
      password,
    });

    await runInTransaction(async (tx) => {
      await tx.organizationMember.upsert({
        where: {
          organizationId_userId: {
            organizationId: invitation.organizationId,
            userId: prepared.user.id,
          },
        },
        update: {
          role: invitation.role,
        },
        create: {
          organizationId: invitation.organizationId,
          userId: prepared.user.id,
          role: invitation.role,
        },
      });

      if (
        invitation.role === OrganizationRole.CLIENT &&
        invitation.clientId
      ) {
        await tx.clientContact.upsert({
          where: {
            clientId_email: {
              clientId: invitation.clientId,
              email: normalizedEmail,
            },
          },
          update: {
            userId: prepared.user.id,
            // Existing CRM name is intentionally preserved.
          },
          create: {
            clientId: invitation.clientId,
            userId: prepared.user.id,
            name,
            email: normalizedEmail,
          },
        });
      }

      await tx.organizationInvitation.delete({
        where: { id: invitation.id },
      });
    });

    await setSessionCookie(prepared.token);

    return NextResponse.json({
      success: true,
      organizationId: invitation.organizationId,
      user: {
        id: prepared.user.id,
        name: prepared.user.name,
        email: prepared.user.email,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nem sikerült aktiválni a meghívást.",
      },
      { status: 400 },
    );
  }
}
