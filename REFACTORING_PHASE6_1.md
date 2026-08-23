# ProjectFlow – Phase 6.1 stabilizáló javítás

Ez a verzió a Phase 6 két hiányosságát javítja:

1. a `CLIENT` szervezeti felhasználót konkrét `Client` ügyfélcéghez köti;
2. a mérföldkövek létrehozás mellett már szerkeszthetők és törölhetők is.

## Adatbázis-változás

Új migráció:

`20260815144000_add_client_contacts`

Új `ClientContact` tábla:

- `clientId` – melyik ügyfélcéghez tartozik;
- `userId` – opcionális ProjectFlow felhasználói kapcsolat;
- `name`, `email`, `position` – kapcsolattartói adatok.

Az `OrganizationInvitation` új `clientId` mezőt kapott. `CLIENT` szerepkörű meghívásnál az ügyfélcég kiválasztása kötelező.

## Meglévő CLIENT felhasználó hozzárendelése

A migráció nem tudja automatikusan eldönteni, hogy egy korábban meghívott CLIENT melyik ügyfélcéghez tartozik.

1. Menj a `Szervezet` oldalra.
2. A már meglévő CLIENT tag alatt megjelenik az `Ügyfélcég` választó.
3. Válaszd ki a megfelelő ügyfelet és mentsd el.

Ezután a felhasználó:

- látja a saját ügyfélcégét az Ügyfelek menüben;
- látja a saját ügyfélcégéhez tartozó projekteket;
- az ügyfél részletező oldalon kapcsolattartóként jelenik meg.

Fontos: a `Client` továbbra is az ügyfélcéget jelenti. Egy regisztrált ügyfélfelhasználó nem külön `Client` rekordként, hanem `ClientContact` kapcsolattartóként jelenik meg.

## Mérföldkövek

A projektvezető, OWNER és ADMIN most már:

- létrehozhat;
- szerkeszthet;
- státuszt és határidőt módosíthat;
- törölhet mérföldkövet.

A MEMBER / CONTRACTOR / CLIENT továbbra is csak olvashatja őket.

## Telepítés

```powershell
npm install
npx prisma migrate deploy
npx prisma generate
npm run dev
```

Alkalmazandó új migráció:

`20260815144000_add_client_contacts`
