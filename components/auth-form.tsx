"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
    const supabase = createClient();

    try {
      const next = searchParams.get("next") || "/dashboard";
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(next);
        router.refresh();
      } else {
        const origin = window.location.origin;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (error) throw error;
        if (data.session) {
          router.replace(next);
          router.refresh();
        } else {
          setMessage("A regisztráció elkészült. Ellenőrizd az e-mail fiókodat a megerősítő linkért.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sikertelen hitelesítés.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center">
      <div className="w-full rounded-2xl border p-7 shadow-sm">
        <p className="text-sm text-gray-500">ProjectFlow</p>
        <h1 className="mt-1 text-3xl font-bold">{mode === "login" ? "Bejelentkezés" : "Regisztráció"}</h1>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "register" && (
            <label className="block text-sm font-medium">Név
              <input className="mt-2 w-full rounded-lg border bg-transparent p-3" value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
          )}
          <label className="block text-sm font-medium">E-mail
            <input className="mt-2 w-full rounded-lg border bg-transparent p-3" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="block text-sm font-medium">Jelszó
            <input className="mt-2 w-full rounded-lg border bg-transparent p-3" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
          {message && <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">{message}</p>}
          <button disabled={loading} className="w-full rounded-lg bg-white px-4 py-3 font-medium text-black disabled:opacity-50">
            {loading ? "Folyamatban..." : mode === "login" ? "Belépés" : "Fiók létrehozása"}
          </button>
        </form>
        <p className="mt-5 text-sm text-gray-500">
          {mode === "login" ? "Még nincs fiókod? " : "Már van fiókod? "}
          <Link className="font-medium underline" href={`${mode === "login" ? "/register" : "/login"}${searchParams.get("next") ? `?next=${encodeURIComponent(searchParams.get("next")!)}` : ""}`}>
            {mode === "login" ? "Regisztráció" : "Bejelentkezés"}
          </Link>
        </p>
      </div>
    </div>
  );
}
