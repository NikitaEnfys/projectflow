# ProjectFlow – 5. fázis

## Újdonságok
- OrganizationInvitation adatmodell és migráció.
- OWNER / ADMIN meghívhat új szervezeti tagot e-mail alapján.
- 7 napos, egyedi meghívó link.
- Meghívó elfogadása regisztráció vagy bejelentkezés után.
- Szervezeti szerepkör módosítása és tag eltávolítása.
- OWNER védelme; ADMIN nem kezelhet más ADMIN-t.
- Szervezetből eltávolításkor az adott szervezet projekt-tagságai is törlődnek.

## Telepítés
1. Másold át a Phase 4 `.env` fájlt.
2. `npm install`
3. `npx prisma migrate deploy`
4. `npx prisma generate`
5. `npm run dev`

## Teszt
1. Szervezet oldalon hívj meg egy másik valós e-mail címet MEMBER-ként.
2. Másold ki a meghívó linket.
3. Nyisd meg inkognitó ablakban.
4. Regisztrálj / jelentkezz be pontosan a meghívott e-mail címmel.
5. Fogadd el a meghívást.
6. Lépj vissza az owner fiókkal: az új tag jelenjen meg a szervezetben.
7. Projekt oldalon már kiválasztható legyen a Tag hozzáadása listában.
