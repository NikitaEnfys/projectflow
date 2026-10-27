import { NextResponse } from "next/server";
import { OrganizationRole } from "@/lib/domain/enums";
import {
  organizationInvitationRepository,
} from "@/lib/repositories";
import { getAuthService } from "@/lib/auth/service";
import { setSessionCookie } from "@/lib/auth/session";
import { applyOrganizationInvitationMembership } from "@/lib/invitations/apply-membership";

type Ctx = {
  params: Promise<{ token: string }>;
};

export async function POST(
  request: Request,
  { params }: Ctx,
) {
  const { token } = await params;

  const invitation =
    await organizationInvitationRepository.findUnique({
      where: { token },
      include: {
        client: {
          select: {
            id: true,
            name: true,
          },
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
    invitation.role ===
      OrganizationRole.CLIENT &&
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
    typeof body.password === "string"
      ? body.password
      : "";

  if (password.length < 6) {
    return NextResponse.json(
      {
        error:
          "A jelszó legalább 6 karakter legyen.",
      },
      { status: 400 },
    );
  }

  const normalizedEmail =
    invitation.email.toLowerCase();

  const name =
    typeof body.name === "string" &&
    body.name.trim()
      ? body.name.trim()
      : normalizedEmail.split("@")[0];

  try {
    const prepared =
      await getAuthService().prepareInvitedAccount({
        name,
        email: normalizedEmail,
        password,
      });

    await applyOrganizationInvitationMembership({
      invitation,
      user: prepared.user,
      preserveExistingClientContactName:
        true,
    });

    await setSessionCookie(
      prepared.token,
    );

    return NextResponse.json({
      success: true,
      organizationId:
        invitation.organizationId,
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
