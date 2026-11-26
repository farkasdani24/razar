# Razar Skating Skills — jelentkező és elszámoló app

Egy weboldal, amit telefonra is lehet telepíteni. A szülők jelzik, hogy jön-e a gyerek
a keddi korcsolyatechnika órára, az app pedig a létszámból automatikusan kiszámolja az
árat. A fizetési adatokat csak a két edző látja, közös jelszóval belépve.

## Mit tud

- **Óra fül** — a következő alkalom, a jelenlegi létszám és az abból adódó ár. A szülő
  a gyereke nevénél a „Jön” / „Nem” gombbal jelez. A jelentkezés az óra kezdete után
  30 perccel automatikusan zár.
- **Alkalmak fül** — a következő és a korábbi alkalmak. Az edző itt hoz létre újat,
  akár egyszerre több hétre előre.
- **Gyerekek fül** — a csapat névsora. A szülők elérhetősége és a bérlet egyenlege
  csak az edzőknek látszik.
- **Infó fül** — helyszín, időpont, edzők elérhetősége, árak, bérlet részletei és az
  utalási adatok. Ezeket a szövegeket az edző az appból tudja szerkeszteni.
- **Pénzügy fül** (csak edzőknek) — kinek mennyit kell fizetnie, mivel fizetett
  (készpénz / utalás / bérletből), ki van még elmaradásban. A nyitott tartozás
  minden lezárt alkalmat beleszámol, nem csak azokat, amiket már kipipáltatok.
- **Lomtár** (Infó fül, csak edzőknek) — a törölt gyerekek és alkalmak nem vesznek
  el, ide kerülnek, és egy kattintással visszaállíthatók. Az adataik (jelentkezések,
  fizetések) addig is megmaradnak. Végleges törlés külön, megerősítéssel lehetséges.
- **Napló** (Infó fül, csak edzőknek) — minden változás nyoma: ki mit módosított és
  mikor. A szülői jelentkezések is benne vannak. A szülők nem látják.
- **Telefonra telepíthető** — a kezdőképernyőre kitéve külön ikonról indul, mint egy
  rendes alkalmazás (az Infó fülön ott a leírás, hogyan).

## Az árszámítás

| Létszám | Alkalmi díj | Bérletesnek |
|---|---|---|
| 7 vagy több | 6 000 Ft | 1 alkalom |
| 6 fő | 7 000 Ft | 1 alkalom + 1 000 Ft |
| 5 fő | 8 000 Ft | 1 alkalom + 2 000 Ft |
| 4 vagy kevesebb | az óra elmarad | nem vesz el alkalmat |

Ezek az árak nincsenek beégetve a kódba: az Infó fülön, edzőként belépve az
„Árak szerkesztése” gombbal bármikor átírhatók.

## Első teendők, ha fent van

1. Nyisd meg a linket, jobbra fent **Edző**, írd be a közös jelszót.
2. **Gyerekek fül → Új gyerek**: vedd fel a gyerekeket a szülő adataival.
3. **Alkalmak fül → Új alkalom**: állítsd be a keddi időpontot, és pipáld be a
   „Több hétre előre, hetente” lehetőséget, hogy egyszerre létrejöjjön az egész
   következő időszak.
4. **Infó fül → Szövegek szerkesztése**: írd be a pontos helyszínt, az edzők
   elérhetőségét és a bérlet részleteit.
5. Küldd szét a linket a szülőknek.

## Hogyan védi a fizetési adatokat

A szülők oldala egy nyilvános kulccsal éri el az adatbázist — ez a kulcs a weboldal
kódjában van, tehát elvileg bárki megszerezheti, aki megnyitja az oldalt. Ezért a
fizetési adatok nem egyszerűen el vannak rejtve a felületen, hanem az adatbázis
szintjén le vannak zárva:

- a `payments` tábla és a szülői elérhetőségeket tartalmazó `kids` tábla **csak
  bejelentkezve** olvasható;
- a szülők egy külön nézetet (`kids_public`) látnak, amiben csak a gyerek neve és a
  csoportja van benne;
- a jelentkezés (`attendance`) és az alkalmak (`lessons`) nyilvánosak — itt nincs
  érzékeny adat.

Ez teszteléssel ellenőrizve van: a szülői kulccsal a fizetési tábla nulla sort ad vissza.

## Telepítés

### 1. Supabase adatbázis — EZ MÁR KÉSZ

Az adatbázis a meglévő **SVAT SE - Alkalmazás** Supabase projektben van, `razar_`
előtagú táblákban, hogy ne akadjon össze a focis appal. A táblák, a jogosultsági
szabályok és az edzői belépés már be vannak állítva — ezzel nincs teendőd.

A `supabase-schema.sql` fájl csak archívumként van itt: akkor kell majd lefuttatni,
ha egyszer külön adatbázisba költöztetitek az appot.

### 2. Kód GitHubra

1. Hozz létre egy új repository-t a [github.com](https://github.com)-on (pl. `razar-app`).
2. Töltsd fel ennek a mappának a teljes tartalmát (a `node_modules` és a `dist`
   mappát ne).

### 3. Vercel

1. [vercel.com](https://vercel.com) → **Add New… → Project** → válaszd ki a repót → **Import**.
2. **Deploy**. Nem kell semmilyen beállítást megadni — az adatbázis címe és
   nyilvános kulcsa bele van írva a kódba (a `src/lib/supabaseClient.js` fájlba).
3. Kapsz egy linket, ezt küldheted szét a szülőknek.

## Ha módosítani szeretnéd

Töltsd fel a megváltozott fájlokat ugyanabba a GitHub repóba — a Vercel pár másodperc
alatt magától frissíti az oldalt.

## Helyi kipróbálás (nem kötelező)

```bash
npm install
cp .env.example .env     # írd bele a saját Supabase adataidat
npm run dev
```
