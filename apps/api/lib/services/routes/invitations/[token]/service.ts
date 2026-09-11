import { json } from "@/lib/http/response";
import { organizationInvitationRepository } from "@/lib/repositories";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await organizationInvitationRepository.findUnique({
    where: { token },
    include: { organization: true, invitedBy: { select: { name: true } }, client: { select: { name: true } } },
  });
  if (!invitation) return json({ error: "A meghívó nem található." }, { status: 404 });
  return json(invitation);
}
