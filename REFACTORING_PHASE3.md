# ProjectFlow – 3. refaktorfázis: Supabase Auth + jogosultság

## Mi került bele?

- Supabase Auth SSR integráció (`@supabase/ssr`)
- `/login` és `/register`
- cookie-alapú session frissítés Next.js 16 `proxy.ts` fájllal
- `/auth/callback` a megerősítő/PKCE visszatéréshez
- `User.authUserId` Prisma mező és migráció
- `getCurrentUser()` / `requireCurrentUser()`
- meglévő Prisma User automatikus összekötése Auth userrel azonos e-mail alapján
- projektlista és dashboard jogosultság szerinti szűrése
- projekt részletező szerveroldali `requireProjectAccess` védelemmel
- ügyfelek és szervezeti beállítások korlátozása
- projektek/ügyfelek/felhasználók API-jának jogosultsági ellenőrzése
- kijelentkezés

## Szükséges `.env` változók

```env
DATABASE_URL="..."
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="YOUR_PUBLISHABLE_KEY"
```

A Project URL és Publishable key a Supabase Dashboard → Connect / API keys részen található.

## Telepítés

Ebben a csomagban nincs `node_modules`, `.next`, `.env` és szándékosan nincs lockfile sem, mert új Auth dependency-k kerültek be. Első indításkor:

```powershell
npm install
npx prisma migrate deploy
npx prisma generate
npm run db:bootstrap
npm run dev
```

## Első Auth teszt

1. Regisztrálj ugyanazzal az e-mail címmel, amely már a ProjectFlow `User` táblában szerepel (pl. a meglévő Lili user címe).
2. Ha a Supabase Auth e-mail megerősítést kér, kattints a levélben található linkre.
3. Jelentkezz be.
4. Az első hitelesített kérésnél a rendszer az e-mail alapján megkeresi a meglévő `User` rekordot és feltölti az `authUserId` mezőt.
5. A korábbi `OrganizationMember` és `ProjectMember` kapcsolatok emiatt megmaradnak.

## Jogosultsági próba

A valódi teszt két Auth userrel történik:

- projektvezető: az adott projektet látja és meg tudja nyitni;
- MEMBER/CONTRACTOR: csak azt a projektet látja, amelyhez `ProjectMember` rekordja van;
- nem projekttag MEMBER/CONTRACTOR: a projektet sem listában, sem közvetlen URL-lel nem érheti el;
- OWNER/ADMIN szervezeti szinten látja a szervezet projektjeit és ügyfeleit.

## Megjegyzés

Ez a fázis alkalmazásszintű jogosultságot vezet be a Next.js + Prisma rétegben. Supabase Data API/RLS szabályok kialakítása külön későbbi hardening lépés; a jelenlegi üzleti adatelérés továbbra is szerveroldali Prismán keresztül történik.
