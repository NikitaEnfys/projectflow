"use client";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/api/auth";

export function InvitationAccountSwitch({ token }: { token: string }) {
  const router = useRouter();
  return <button type="button" className="pf-button-secondary" onClick={async () => {
    await logout();
    router.replace(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
    router.refresh();
  }}>Másik fiókkal folytatom</button>;
}
