# ProjectFlow – Refaktor 4. fázis

## Cél

A `ProjectMember` adatmodellhez teljes projektcsapat-kezelő felület és szerveroldali CRUD került.

## Új funkciók

- szervezeti tag hozzáadása projekthez;
- projektszerepkör megadása (`PROJECT_MANAGER`, `MEMBER`, `CONTRACTOR`, `CLIENT`);
- projektszerepkör módosítása;
- projekttag eltávolítása;
- jogosultságellenőrzés minden írási művelet előtt;
- az utolsó projektvezető nem távolítható el és nem fokozható le;
- a legacy `Project.ownerId` automatikusan átkerül egy másik projektvezetőre, ha a korábbi felelőst eltávolítják vagy lefokozzák.

## Jogosultság

Projektcsapatot kezelhet:

- szervezeti `OWNER`;
- szervezeti `ADMIN`;
- az adott projekt `PROJECT_MANAGER` tagja.

Más szerepkörök csak megtekintik a projektcsapatot.

## Adatbázis

Ehhez a fázishoz **nem kell új Prisma migráció**, mert a `ProjectMember` tábla és a `ProjectRole` enum már a 2. fázisban létrejött.

## Indítás

A működő Phase 3 `.env` fájlt másold át, majd:

```powershell
npm install
npx prisma generate
npm run dev
```

`npx prisma migrate deploy` futtatható ellenőrzésként, de új Phase 4 migráció nincs.

## Teszt

1. Jelentkezz be OWNER / ADMIN / PROJECT_MANAGER felhasználóval.
2. Nyiss meg egy projektet.
3. Adj hozzá egy szervezeti tagot MEMBER szerepkörrel.
4. Módosítsd CONTRACTOR-ra.
5. Jelentkezz be ezzel a felhasználóval, és ellenőrizd, hogy a projekt megnyitható.
6. Próbáld meg vele a csapat kezelését: nem jelenhet meg szerkesztő UI és az API-nak is 403-at kell adnia.
7. Próbáld meg eltávolítani az utolsó PROJECT_MANAGER-t: a rendszernek meg kell akadályoznia.
