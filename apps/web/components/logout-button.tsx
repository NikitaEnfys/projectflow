"use client";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/api/auth";

export function LogoutButton() {
  const router = useRouter();
  return <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold text-[#778196] hover:bg-[#fff1f3] hover:text-[#bd4053]" onClick={async () => {
    await logout();
    router.replace("/login");
    router.refresh();
  }}>
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f7f8fb]">
      <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 5H5.5A1.5 1.5 0 0 0 4 6.5v11A1.5 1.5 0 0 0 5.5 19H10M14.5 8.5 18 12l-3.5 3.5M9 12h9"/></svg>
    </span>
    Kijelentkezés
  </button>;
}
