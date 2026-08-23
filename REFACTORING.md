# ProjectFlow – 2. refaktorálási fázis

Ez a változat a szervezeti alapokra ráépíti a projektszintű tagságot és az első központi jogosultsági réteget.

## Új elemek

- `ProjectRole` enum
- `ProjectMember` modell
- `User.projectMemberships` és `Project.members` reláció
- a meglévő projektfelelősök automatikus `PROJECT_MANAGER` projekttagsága
- új projekt létrehozásakor a kiválasztott felelős automatikusan projektvezetői tagságot kap
- projekt részletezőn megjelenik a projektcsapat
- `lib/permissions.ts` központi permission helper réteg

## Jogosultsági helper-ek

- `getOrganizationMembership`
- `getProjectMembership`
- `canViewProject`
- `canManageProject`
- `canManageProjectMembers`
- `canManageClients`
- `requireProjectAccess`
- `requireProjectManagement`

Ezek már a későbbi autentikációs réteghez készültek: szándékosan `userId`-t várnak paraméterként. Amíg nincs valódi bejelentkezett felhasználó (`currentUser`), nem használjuk őket biztonsági ellenőrzésként az API route-okban, mert az hamis biztonságérzetet adna.

## Adatbázis módosítás

Ebben a fázisban adatbázis-migráció szükséges, mert új enum és új tábla jön létre.

A dev szervert állítsd le (`Ctrl+C`), majd:

```powershell
npx prisma migrate deploy
npx prisma generate
npm run db:bootstrap
npm run dev
```

A `db:bootstrap` most már a meglévő projektekhez is létrehozza/karbantartja a projektvezetői tagságot a korábbi `ownerId` alapján.

## Miért marad még meg az ownerId?

Az `ownerId` jelenleg kompatibilitási mező. A régi UI és adatfolyam továbbra is használja, miközben az új `ProjectMember` modell már létrejön mellette. Később, amikor a projektcsapat-kezelés és auth stabil, az `ownerId` fokozatosan kivezethető.

## Miért opcionális még az organizationId?

Ezt egy külön, kis migrációban tesszük majd kötelezővé, miután ellenőriztük, hogy minden rekordot sikeresen hozzárendelt a bootstrap. Így egy esetleges régi/null rekord nem blokkolja a mostani projekttagsági migrációt.

## Következő fázis

1. valódi autentikáció / current-user réteg;
2. API-k és Server Actionök jogosultsági védelme;
3. projekttag-kezelő UI (hozzáadás, szerepkör módosítás, eltávolítás);
4. lekérdezések szervezet és projekt-hozzáférés szerinti szűrése;
5. `organizationId` kötelezővé tétele;
6. Project modell bővítése státusszal és dátumokkal.

## 4. fázis

Projektcsapat kezelő UI és szerveroldali tagságkezelés. Részletek: `REFACTORING_PHASE4.md`.
