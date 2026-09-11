"use client";

import { useRouter } from "next/navigation";
import { logout } from "@/lib/api/auth";

export function InvitationAccountSwitch({ token }: { token: string }) {
  const router = useRouter();
  return <button
    type="button"
    className="rounded-lg bg-white px-4 py-2 font-medium text-black"
    onClick={async () => {
      await logout();
      router.replace(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
      router.refresh();
    }}
  >Másik fiókkal folytatom</button>;
}
