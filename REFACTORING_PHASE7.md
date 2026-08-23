# ProjectFlow – Phase 7: Task refaktor + Kanban

## Adatmodell
A `Task` mostantól enum státuszt és prioritást használ, valamint támogatja a felelőst, létrehozót, mérföldkövet, határidőt és az ügyfél-láthatóságot.

### Státuszok
- TODO
- IN_PROGRESS
- REVIEW
- BLOCKED
- DONE

### Prioritások
- LOW
- MEDIUM
- HIGH
- URGENT

## Jogosultságok
- OWNER / ADMIN / projekt PROJECT_MANAGER: feladat létrehozás, teljes szerkesztés, felelős/mérföldkő kijelölés, törlés.
- MEMBER / CONTRACTOR: a saját magára kiosztott feladat státuszát módosíthatja.
- CLIENT: csak a `clientVisible = true` feladatokat látja, nem módosíthatja őket.

## Projekt progress
A projekt előrehaladása automatikusan frissül: `DONE taskok / összes task * 100`.

## Migráció
`20260815153000_refactor_tasks`

A meglévő Task rekordok megmaradnak. A régi string státusz enumra konvertálódik, a meglévő feladatok létrehozója a projekt korábbi `ownerId` felhasználója lesz.
