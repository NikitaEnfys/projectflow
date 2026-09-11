import Link from "next/link";
import { serverApi, ApiResponseError } from "@/lib/api/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { InvitationAccept } from "@/components/invitation-accept";
import { InvitationAccountSwitch } from "@/components/invitation-account-switch";

function MessagePage({ title, text }: { title: string; text: string }) {
  return <main className="mx-auto flex min-h-[75vh] max-w-xl items-center"><div className="pf-card w-full p-7 sm:p-9"><p className="pf-eyebrow">ProjectFlow meghívás</p><h1 className="text-3xl font-bold tracking-[-0.035em] text-[#222a3d]">{title}</h1><p className="mt-3 text-sm leading-6 text-[#748094]">{text}</p></div></main>;
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let invitation: any;
  try { invitation = await serverApi<any>(`/api/invitations/${token}`); }
  catch (error) {
    if (error instanceof ApiResponseError && error.status === 404) return <MessagePage title="A meghívó nem található" text="Lehet, hogy már felhasználták vagy visszavonták." />;
    throw error;
  }
  if (new Date(invitation.expiresAt) < new Date()) return <MessagePage title="A meghívó lejárt" text="Kérj új meghívót a szervezet adminisztrátorától." />;

  const user = await getCurrentUser();
  const next = `/invite/${token}`;
  const emailMatches = user?.email.toLowerCase() === invitation.email.toLowerCase();

  return <main className="mx-auto flex min-h-[75vh] max-w-xl items-center">
    <div className="pf-card w-full p-7 sm:p-9">
      <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef0ff] text-sm font-bold text-[#5965df]">PF</div>
      <p className="pf-eyebrow">Meghívás érkezett</p>
      <h1 className="text-3xl font-bold tracking-[-0.035em] text-[#222a3d]">{invitation.organization.name}</h1>
      <p className="mt-4 text-sm leading-6 text-[#687386]"><strong className="text-[#3c4558]">{invitation.invitedBy.name}</strong> meghívott a szervezetbe <strong className="text-[#3c4558]">{invitation.role}</strong> szerepkörrel.</p>
      {invitation.role === "CLIENT" && <p className="mt-2 text-sm text-[#687386]">Ügyfélcég: <strong>{invitation.client?.name ?? "nincs hozzárendelve"}</strong></p>}
      <div className="mt-5 rounded-xl bg-[#f8f9fc] p-4 text-sm text-[#737d90]"><span className="text-xs font-semibold uppercase tracking-wide text-[#9ba3b2]">Meghívott e-mail</span><p className="mt-1 font-medium text-[#4c5569]">{invitation.email}</p></div>

      {!user ? <div className="mt-6 flex flex-wrap gap-3"><Link className="pf-button-primary" href={`/login?next=${encodeURIComponent(next)}`}>Bejelentkezés</Link><Link className="pf-button-secondary" href={`/register?next=${encodeURIComponent(next)}`}>Regisztráció</Link></div> : emailMatches ? <InvitationAccept token={token} /> : <div className="mt-6 rounded-xl border border-[#f0d8ae] bg-[#fff8eb] p-4"><p className="text-sm leading-6 text-[#805f2d]">Jelenleg <strong>{user.email}</strong> címmel vagy bejelentkezve, de a meghívó a <strong>{invitation.email}</strong> címhez tartozik.</p><div className="mt-4"><InvitationAccountSwitch token={token} /></div></div>}
    </div>
  </main>;
}
