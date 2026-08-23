# ProjectFlow – 6. fázis

## Cél
A jogosultságok minimum-korrekciója és a projektmenedzsment alapmodell kibővítése.

## Jogosultságok
- OWNER / ADMIN: ügyfél és projekt létrehozása.
- PROJECT_MANAGER: projekt létrehozása, de új ügyfél létrehozása nem.
- MEMBER / CONTRACTOR / CLIENT: sem ügyfelet, sem projektet nem hozhat létre.
- A backend API-k ellenőrzik a jogosultságot; a navigáció csak az engedélyezett menüpontokat mutatja.

## Új Project mezők
- `status`: PLANNING / ACTIVE / ON_HOLD / COMPLETED / CANCELLED
- `priority`: LOW / MEDIUM / HIGH / URGENT
- `startDate`
- `dueDate`
- `progress` (0–100)
- `updatedAt`

## Milestone
Új `Milestone` modell:
- név
- leírás
- státusz
- határidő
- projekt kapcsolat

A projektvezető, admin és owner hozhat létre mérföldkövet. A projekt többi tagja olvashatja.

## Migráció
Futtasd:

```powershell
npx prisma migrate deploy
npx prisma generate
```

A migráció neve:
`20260815124500_expand_project_and_add_milestones`

## Teszt
1. OWNER/ADMIN: látja az Új ügyfél és Új projekt menüpontot.
2. PROJECT_MANAGER: látja az Új projektet, de nem az Új ügyfelet.
3. MEMBER/CONTRACTOR/CLIENT: egyik létrehozó menüpontot sem látja; direkt API-hívásra 403-at kell kapnia.
4. Új projekt készíthető státusszal, prioritással és dátumokkal.
5. Projektoldalon megjelennek az új adatok és a progress bar.
6. Projektvezető létrehozhat mérföldkövet; MEMBER csak látja.
