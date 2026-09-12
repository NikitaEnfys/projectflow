"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";

export function InvitationActivate({
  token,
  email,
  suggestedName,
  accountExists,
}: {
  token: string;
  email: string;
  suggestedName: string;
  accountExists: boolean;
}) {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function complete(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("A jelszó legalább 6 karakter legyen.");
      return;
    }

    if (password !== passwordAgain) {
      setError("A két jelszó nem egyezik.");
      return;
    }

    try {
      setBusy(true);

      const response = await apiFetch(
        `/api/invitations/${token}/complete`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: suggestedName,
            password,
          }),
        },
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error || "Nem sikerült elfogadni a meghívást.",
        );
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Nem sikerült elfogadni a meghívást.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="rounded-xl border border-[#e5e8f0] bg-[#fbfcff] p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#9ba3b2]">
          Fiók
        </p>

        <p className="mt-2 text-sm font-semibold text-[#454f63]">
          {suggestedName}
        </p>

        <p className="mt-1 text-sm text-[#758094]">{email}</p>

        <p className="mt-3 text-xs leading-5 text-[#7d8798]">
          {accountExists
            ? "Ehhez az e-mail címhez már tartozik fiók. Nem kell újra regisztrálnod vagy megadnod a profiladataidat. A meghívás elfogadásához állíts be egy új jelszót."
            : "A meghívó alapján a nevedet és az e-mail címedet már ismerjük. Csak állíts be egy jelszót a fiók aktiválásához."}
        </p>
      </div>

      <form onSubmit={complete} className="mt-5 space-y-4">
        <label className="block text-sm font-semibold text-[#465065]">
          {accountExists ? "Új jelszó" : "Jelszó"}
          <input
            type="password"
            minLength={6}
            autoComplete="new-password"
            className="mt-2 w-full rounded-xl border px-3.5 py-3"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            placeholder="Legalább 6 karakter"
            required
          />
        </label>

        <label className="block text-sm font-semibold text-[#465065]">
          Jelszó újra
          <input
            type="password"
            minLength={6}
            autoComplete="new-password"
            className="mt-2 w-full rounded-xl border px-3.5 py-3"
            value={passwordAgain}
            onChange={(event) =>
              setPasswordAgain(event.target.value)
            }
            placeholder="Írd be még egyszer"
            required
          />
        </label>

        {error && (
          <p className="rounded-xl border border-[#f1cdd3] bg-[#fff2f4] p-3.5 text-sm text-[#b33d50]">
            {error}
          </p>
        )}

        <button
          disabled={busy}
          className="pf-button-primary w-full py-3 disabled:opacity-50"
        >
          {busy
            ? "Aktiválás…"
            : accountExists
              ? "Új jelszó mentése és meghívás elfogadása"
              : "Fiók aktiválása és meghívás elfogadása"}
        </button>
      </form>

      {accountExists && (
        <p className="mt-4 text-xs leading-5 text-[#8993a5]">
          Az itt megadott jelszó lesz a fiókod új ProjectFlow-jelszava.
        </p>
      )}
    </div>
  );
}
