"use client";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/api/auth";

export function LogoutButton() {
  const router = useRouter();
  return <button className="mt-6 w-full rounded p-2 text-left text-sm hover:bg-gray-100" onClick={async () => {
    await logout();
    router.replace("/login");
    router.refresh();
  }}>Kijelentkezés</button>;
}
