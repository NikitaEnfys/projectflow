"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
export function LogoutButton() {
  const router = useRouter();
  return <button className="mt-6 w-full rounded p-2 text-left text-sm hover:bg-gray-100" onClick={async()=>{ await createClient().auth.signOut(); router.replace("/login"); router.refresh(); }}>Kijelentkezés</button>;
}
