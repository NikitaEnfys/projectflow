# Phase 8 – Task assignee fix, comments and activity log

## Mit javít?

- A feladat felelősének listája közvetlenül az adott projekt `ProjectMember` rekordjaiból épül.
- Választható: `PROJECT_MANAGER`, `MEMBER`, `CONTRACTOR`.
- `CLIENT` nem lehet belső feladat felelőse.
- A legacy `ownerId` projektvezető biztonsági tartalékként megmarad a listában akkor is, ha egy régi projektből hiányzik a tagsági rekord.

## Új funkciók

- `TaskComment` modell és belső / ügyfélnek látható kommentek.
- Ügyfél csak `clientVisible = true` feladatot és `CLIENT_VISIBLE` kommentet lát.
- Ügyfél kommentje automatikusan `CLIENT_VISIBLE`.
- Kommentet a szerző vagy projektmenedzser törölhet.
- `ActivityLog` modell és projekt-szintű aktivitási feed.
- Naplózás: task létrehozás, task módosítás/státuszváltás/törlés, komment hozzáadás, mérföldkő létrehozás/módosítás/törlés.

## Migráció

`20260815164500_add_task_comments_and_activity`

Új adatbázis-elemek:

- `CommentVisibility` enum
- `TaskComment` tábla
- `ActivityLog` tábla

## Telepítés

```powershell
npm install
npx prisma migrate deploy
npx prisma generate
npm run dev
```

## Teszt

1. Projektcsapatban legyen legalább egy `MEMBER` vagy `CONTRACTOR` Lili mellett.
2. Új task létrehozásakor mindegyik belső projekttag jelenjen meg felelősként.
3. `CLIENT` ne jelenjen meg felelősként.
4. Adj taskot a belső munkatársnak, lépj be vele, és módosítsd a saját task státuszát.
5. Nyiss meg taskot és írj belső kommentet.
6. Ügyfélnek látható tasknál írj `CLIENT_VISIBLE` kommentet, majd ellenőrizd ügyfélként.
7. Ellenőrizd a projekt `Aktivitás` szekcióját task- és mérföldkőműveletek után.
