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

type NavItem = {
  href: string;
  label: string;
  hint: string;
  icon: "home" | "project" | "client" | "plus" | "settings";
  visible?: boolean;
};

function NavIcon({ icon }: { icon: NavItem["icon"] }) {
  const common = "h-[18px] w-[18px]";
  if (icon === "home") return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3.5 10.8 12 3.8l8.5 7v8.4a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5v-8.4Z"/><path d="M9.2 20.7v-6.2h5.6v6.2"/></svg>;
  if (icon === "project") return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M8 5V3.5M16 5V3.5M3.5 9.5h17"/></svg>;
  if (icon === "client") return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 20v-8.5h7V20M13 20V5h7v15M6.5 14.5h2M15.5 8h2M15.5 11.5h2M15.5 15h2"/></svg>;
  if (icon === "settings") return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9A1.7 1.7 0 0 0 21 10h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg>;
  return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 5v14M5 12h14"/></svg>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [access, setAccess] = useState<Access | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const authPage = pathname.startsWith("/login") || pathname.startsWith("/register") || pathname.startsWith("/auth/") || pathname.startsWith("/invite/");

  useEffect(() => {
    if (authPage) return;
    apiFetch("/api/access")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setAccess(data))
      .catch(() => setAccess(null));
  }, [authPage, pathname]);

  useEffect(() => setMobileOpen(false), [pathname]);

  if (authPage) {
    return <main className="min-h-screen px-5 py-8 sm:px-8">{children}</main>;
  }

  const items: NavItem[] = [
    { href: "/dashboard", label: "Áttekintés", hint: "Minden egy helyen", icon: "home" },
    { href: "/projects", label: "Projektek", hint: "Munka és határidők", icon: "project" },
    { href: "/clients", label: "Ügyfelek", hint: "Kapcsolatok", icon: "client", visible: access?.canViewClients },
    { href: "/projects/new", label: "Új projekt", hint: "Projekt indítása", icon: "plus", visible: access?.canCreateProject },
    { href: "/clients/new", label: "Új ügyfél", hint: "Ügyfél felvétele", icon: "plus", visible: access?.canCreateClient },
    { href: "/settings/organization", label: "Szervezet", hint: "Csapat és jogosultságok", icon: "settings", visible: access?.canManageOrganization },
  ];

  const visibleItems = items.filter((item) => item.visible !== false);

  const sidebar = (
    <>
      <div className="flex items-center gap-3 px-2 py-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#5b67f1] text-sm font-bold text-white shadow-[0_8px_22px_rgba(91,103,241,.25)]">PF</div>
        <div>
          <p className="text-[15px] font-bold tracking-[-0.02em] text-[#1d2538]">ProjectFlow</p>
          <p className="text-[11px] text-[#929bad]">Nyugodtabb munkanapok</p>
        </div>
      </div>

      <div className="my-6 h-px bg-[#edf0f5]" />

      <nav className="space-y-1.5">
        {visibleItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 ${active ? "bg-[#eef0ff] text-[#4652d8]" : "text-[#596376] hover:bg-[#f7f8fc] hover:text-[#242c40]"}`}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? "bg-white shadow-sm" : "bg-[#f7f8fb] group-hover:bg-white"}`}><NavIcon icon={item.icon} /></span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold">{item.label}</span>
                <span className={`block truncate text-[10px] ${active ? "text-[#7d86e7]" : "text-[#a0a8b6]"}`}>{item.hint}</span>
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-6">
        <div className="mb-3 rounded-2xl border border-[#e7eaf2] bg-[#fbfcff] p-3.5">
          <p className="text-xs font-semibold text-[#3d4659]">Tipp</p>
          <p className="mt-1 text-[11px] leading-5 text-[#8790a2]">Tartsd naprakészen a feladatok státuszát, így az áttekintés mindig pontos marad.</p>
        </div>
        <LogoutButton />
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-transparent">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[268px] flex-col border-r border-[#e9ecf2] bg-white/95 px-4 py-5 backdrop-blur lg:flex">
        {sidebar}
      </aside>

      {mobileOpen && <button aria-label="Menü bezárása" className="fixed inset-0 z-40 bg-[#172033]/20 backdrop-blur-[1px] lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-white px-4 py-5 shadow-2xl transition-transform lg:hidden ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {sidebar}
      </aside>

      <div className="lg:pl-[268px]">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#eaedf3] bg-[#f7f8fc]/90 px-5 backdrop-blur-xl sm:px-7 lg:px-9">
          <div className="flex items-center gap-3">
            <button className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#e2e6ee] bg-white text-[#586174] lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Menü megnyitása">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
            </button>
            <div>
              <p className="text-xs font-medium text-[#9aa2b2]">ProjectFlow</p>
              <p className="text-sm font-semibold text-[#374055]">{visibleItems.find(item => pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`)))?.label ?? "Munkaterület"}</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-[#e5e8ef] bg-white px-3 py-1.5 text-xs font-medium text-[#697386] sm:flex">
            <span className="h-2 w-2 rounded-full bg-[#48b98a]" />
            Minden rendszer elérhető
          </div>
        </header>

        <main className="px-5 py-7 sm:px-7 lg:px-9 lg:py-9">{children}</main>
      </div>
    </div>
  );
}
