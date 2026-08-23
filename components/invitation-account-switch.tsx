"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function InvitationAccountSwitch({ token }: { token: string }) {
  const router = useRouter();
  return <button
    type="button"
    className="rounded-lg bg-white px-4 py-2 font-medium text-black"
    onClick={async () => {
      await createClient().auth.signOut();
      router.replace(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
      router.refresh();
    }}
  >Másik fiókkal folytatom</button>;
}
