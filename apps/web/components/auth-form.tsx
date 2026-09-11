"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { login, register } from "@/lib/api/auth";

type Props = { mode: "login" | "register" };

export function AuthForm({ mode }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const next = searchParams.get("next") || "/dashboard";
      const response = mode === "login" ? await login(email, password) : await register(name, email, password, next);
      const payload = await response.json().catch(() => null) as { error?: string; authenticated?: boolean; requiresEmailConfirmation?: boolean } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Sikertelen hitelesítés.");
      if (mode === "register" && payload?.requiresEmailConfirmation) {
        setMessage("A regisztráció elkészült. Ellenőrizd az e-mail fiókodat a megerősítő linkért.");
        return;
      }
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sikertelen hitelesítés.");
    } finally {
      setLoading(false);
    }
  }

  const next = searchParams.get("next");

  return (
    <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_.95fr]">
      <section className="hidden rounded-[28px] bg-gradient-to-br from-[#5865ef] via-[#6975f5] to-[#8b78f7] p-10 text-white shadow-[0_28px_70px_rgba(79,91,210,.22)] lg:block">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-sm font-bold ring-1 ring-white/25">PF</div>
        <h2 className="mt-10 max-w-md text-4xl font-semibold leading-tight tracking-[-0.04em]">Kevesebb káosz. Több átlátható munka.</h2>
        <p className="mt-5 max-w-lg text-[15px] leading-7 text-white/75">Tartsd egy helyen a projekteket, feladatokat, ügyfeleket és a csapat kommunikációját — egyszerűen, felesleges zaj nélkül.</p>
        <div className="mt-12 grid gap-3 sm:grid-cols-2">
          {[
            ["01", "Projektek egy nézetben"],
            ["02", "Tiszta felelősségek"],
            ["03", "Gyors státuszfrissítés"],
            ["04", "Ügyfélbarát együttműködés"],
          ].map(([number, label]) => <div key={number} className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur"><p className="text-xs text-white/55">{number}</p><p className="mt-2 text-sm font-medium">{label}</p></div>)}
        </div>
      </section>

      <section className="mx-auto w-full max-w-md px-1 sm:px-4">
        <div className="mb-8 lg:hidden">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#5b67f1] text-sm font-bold text-white shadow-lg">PF</div>
        </div>
        <p className="pf-eyebrow">ProjectFlow</p>
        <h1 className="pf-title">{mode === "login" ? "Örülünk, hogy újra itt vagy." : "Hozd létre a fiókodat."}</h1>
        <p className="pf-subtitle">{mode === "login" ? "Jelentkezz be, és folytasd onnan, ahol abbahagytad." : "Pár adat, és már indulhat is a rendezettebb projektmunka."}</p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          {mode === "register" && <label className="block text-sm font-semibold text-[#465065]">Név<input className="mt-2 w-full rounded-xl border px-3.5 py-3" value={name} onChange={(e) => setName(e.target.value)} placeholder="Teljes név" required /></label>}
          <label className="block text-sm font-semibold text-[#465065]">E-mail<input className="mt-2 w-full rounded-xl border px-3.5 py-3" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nev@ceg.hu" required /></label>
          <label className="block text-sm font-semibold text-[#465065]">Jelszó<input className="mt-2 w-full rounded-xl border px-3.5 py-3" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Legalább 6 karakter" required /></label>
          {error && <p className="rounded-xl border border-[#f1cdd3] bg-[#fff2f4] p-3.5 text-sm text-[#b33d50]">{error}</p>}
          {message && <p className="rounded-xl border border-[#cce9dd] bg-[#eef9f4] p-3.5 text-sm text-[#187555]">{message}</p>}
          <button disabled={loading} className="pf-button-primary mt-2 w-full py-3 disabled:opacity-50">{loading ? "Folyamatban…" : mode === "login" ? "Belépés" : "Fiók létrehozása"}</button>
        </form>

        <p className="mt-6 text-sm text-[#7e8798]">
          {mode === "login" ? "Még nincs fiókod? " : "Már van fiókod? "}
          <Link className="font-semibold text-[#515dde] hover:text-[#404bc2]" href={`${mode === "login" ? "/register" : "/login"}${next ? `?next=${encodeURIComponent(next)}` : ""}`}>{mode === "login" ? "Regisztráció" : "Bejelentkezés"}</Link>
        </p>
      </section>
    </div>
  );
}
