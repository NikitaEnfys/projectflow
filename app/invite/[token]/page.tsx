import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { InvitationAccept } from "@/components/invitation-accept";
import { InvitationAccountSwitch } from "@/components/invitation-account-switch";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await prisma.organizationInvitation.findUnique({
    where: { token },
    include: { organization: true, invitedBy: { select: { name: true } }, client: { select: { name: true } } },
  });
  if (!invitation) return <main className="mx-auto max-w-xl py-16"><h1 className="text-3xl font-bold">A meghívó nem található</h1><p className="mt-3 text-gray-500">Lehet, hogy már felhasználták vagy visszavonták.</p></main>;
  if (invitation.expiresAt < new Date()) return <main className="mx-auto max-w-xl py-16"><h1 className="text-3xl font-bold">A meghívó lejárt</h1><p className="mt-3 text-gray-500">Kérj új meghívót a szervezet adminisztrátorától.</p></main>;

  const user = await getCurrentUser();
  const next = `/invite/${token}`;
  const emailMatches = user?.email.toLowerCase() === invitation.email.toLowerCase();

  return <main className="mx-auto max-w-xl py-16"><div className="rounded-2xl border p-7">
    <p className="text-sm text-gray-500">ProjectFlow meghívás</p>
    <h1 className="mt-2 text-3xl font-bold">{invitation.organization.name}</h1>
    <p className="mt-4">{invitation.invitedBy.name} meghívott a szervezetbe <strong>{invitation.role}</strong> szerepkörrel.</p>
    {invitation.role === "CLIENT" && <p className="mt-2 text-sm">Ügyfélcég: <strong>{invitation.client?.name ?? "nincs hozzárendelve"}</strong></p>}
    <p className="mt-2 text-sm text-gray-500">Meghívott e-mail: {invitation.email}</p>

    {!user ? <div className="mt-6 flex gap-3"><Link className="rounded-lg bg-white px-4 py-2 text-black" href={`/login?next=${encodeURIComponent(next)}`}>Bejelentkezés</Link><Link className="rounded-lg border px-4 py-2" href={`/register?next=${encodeURIComponent(next)}`}>Regisztráció</Link></div> : emailMatches ? <InvitationAccept token={token} /> : <div className="mt-6 rounded-lg border border-amber-500/40 bg-amber-950/20 p-4"><p className="text-sm">Jelenleg <strong>{user.email}</strong> címmel vagy bejelentkezve, de a meghívó a <strong>{invitation.email}</strong> címhez tartozik.</p><div className="mt-4"><InvitationAccountSwitch token={token} /></div></div>}
  </div></main>;
}
