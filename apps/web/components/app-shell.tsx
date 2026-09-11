"use client";
import { apiFetch } from "@/lib/api/client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoutButton } from "@/components/logout-button";

type Access = {
  canCreateClient: boolean;
  canCreateProject: boolean;
  canManageOrganization: boolean;
  canViewClients: boolean;
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [access, setAccess] = useState<Access | null>(null);
  const authPage = pathname.startsWith("/login") || pathname.startsWith("/register") || pathname.startsWith("/auth/") || pathname.startsWith("/invite/");

  useEffect(() => {
    if (authPage) return;
    apiFetch("/api/access")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setAccess(data))
      .catch(() => setAccess(null));
  }, [authPage, pathname]);

  if (authPage) return <main className="min-h-screen p-6">{children}</main>;

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r p-4">
        <h2 className="mb-6 text-xl font-bold">ProjectFlow</h2>
        <nav className="space-y-2">
          <Link href="/dashboard" className="block rounded p-2 hover:bg-gray-100">Dashboard</Link>
          <Link href="/projects" className="block rounded p-2 hover:bg-gray-100">Projektek</Link>
          {access?.canViewClients ? <Link href="/clients" className="block rounded p-2 hover:bg-gray-100">Ügyfelek</Link> : null}
          {access?.canCreateClient ? <Link href="/clients/new" className="block rounded p-2 hover:bg-gray-100">Új ügyfél</Link> : null}
          {access?.canCreateProject ? <Link href="/projects/new" className="block rounded p-2 hover:bg-gray-100">Új projekt</Link> : null}
          {access?.canManageOrganization ? <Link href="/settings/organization" className="block rounded p-2 hover:bg-gray-100">Szervezet</Link> : null}
        </nav>
        <LogoutButton />
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
