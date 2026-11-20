# K3D-PLYTY-01b – raport (ETAP 2)

Data: 2026-11-20. Gałąź `feat/baza-plyt` (worktree `D:\kuchnia\.claude\worktrees\baza-plyt`). Lokalny commit `8e2a483`
na `939e934` (K3D-PLYTY-01), autor pawel799. Bez push i bez deployu. Szczegóły weryfikacji są w `weryfikacja.md`.

## Wynik weryfikacji (34 pozycje przed poprawkami)

| Status | Egger | Kronospan | Razem |
|---|---|---|---|
| OK | 15 | 0 | 15 |
| POPRAWIONE | 6 | 3 | 9 |
| NIEPOTWIERDZONE | 1 | 3 | 4 |
| WYCOFANE | 6 | 0 | 6 |

## Co zmieniono w danych (decyzja Pawła: „dalej + zamienniki”)

- **Poprawione nazwy (Egger):** W1000 „Biały premium”, U702 „Kaszmir”, U732 „Szary przykurzony”, H3325 „Dąb Gladstone tabak”,
  H1344 „Dąb Sherman koniakowy brązowy”, H3700 „Orzech Pacific naturalny”.
- **Kronospan:** K001 „White Craft Oak”, K002 „Grey Craft Oak”, K003 „Gold Craft Oak”. Nazwy K002 i K003 były zamienione.
  Kolory poglądowe K002 i K003 zamieniono miejscami. Dodano strukturę PW, przez co zmieniły się id na `kronospan-k00x-pw-plyta`.
- **Usunięte (wycofane):** H1146 ST10, F274 ST9, blat F812 ST9, blat F204 ST75.
- **Usunięte (niepotwierdzone):** Kronospan 0190, 0162.
- **Zamienniki (potwierdzone w źródłach, inna struktura lub kod):** W980 ST2 → W980 ST7, U961 ST2 → U961 ST7 „Szary grafitowy”
  (stara nazwa „Czarny grafit” była błędna), U999 ST2 → U999 ST7, Kronospan 0101 → K101 PE „Front White”.
  W980 ST7 18 mm ma u Egger status „z określonym czasem produkcji”. Pozostałe są dostępne z magazynu.
- **Stan bazy:** 28 pozycji, w tym Egger 24 (20 płyt 18 mm i 4 blaty 38 mm) i Kronospan 4 płyty 18 mm.
- `ZRODLA.md`: przy każdym kodzie jest URL karty dekoru, źródło grubości i data sprawdzenia. Usunięto zapis „spisane z wiedzy”.
- `public/wzor-plyty.csv` (wzór dla stolarni): Kronospan 0190 zastąpiono K101 PE.
- **Test danych** (`src/lib/plyty.test.mjs`) sprawdza:
  - pola `code`, `name`, `type`, `thicknesses` i `hex`,
  - unikalność kodu w obrębie producenta i typu (ten sam dekor może być płytą i blatem, np. F186),
  - wzór kodu: Egger `^[A-Z]\d{3,4}$`, Kronospan `^(K\d{3}|\d{4})$`,
  - obecność wiersza z URL i datą w `ZRODLA.md`,
  - brak zapisu „z wiedzy” w `ZRODLA.md`.
- Kolor HEX dalej jest własnym doborem. Nie pobierano go od producenta.

## Polecenia i kody wyjścia

| Polecenie | Gdzie | Exit | Log |
|---|---|---|---|
| `npx tsc --noEmit` | worktree, commit 8e2a483 | 0 | `tsc.log` |
| `npm test` (10 testów) | worktree | 0 | `test.log` |
| `npm run build` | worktree | 0 | `build.log` |
| `npm ci` | osobny klon `git clone --branch feat/baza-plyt` w folderze tymczasowym poza `D:\kuchnia` | 0 | `npm-ci.log` |
| `npm run lint` | ten sam osobny klon | **0** („No ESLint warnings or errors”) | `lint-galaz.log` |

Po scaleniu z `main` (commit `527ebec`):

| Polecenie | Gdzie | Exit | Log |
|---|---|---|---|
| `npx tsc --noEmit` | worktree | 0 | `tsc-merge.log` |
| `npm test` (34 testy, w tym 10 płyt) | worktree | 0 | `test-merge.log` |
| `npm run build` | worktree | 0 | `build-merge.log` |
| `npm ci` + `npm run lint` | osobny klon poza `D:\kuchnia`, zaktualizowany do 527ebec | 0 / **0** | `npm-ci-merge.log`, `lint-merge.log` |
| `git apply --check zmiany.diff` | czysty klon na `5f5c6e6` | 0 | – |

Lint w zwykłym klonie przechodzi, więc nie ma błędów do wypisania z `origin/main`. Błąd lintu z K3D-PLYTY-01 wynikał
tylko z zagnieżdżenia worktree w `D:\kuchnia`.

## Źródła i ograniczenia

- Strony czytano pojedynczo (`curl` z odstępem 2 s): 35 kart Egger i 13 kart Kronospan, w tym próby innych struktur i adresów.
  Do tego dwa publiczne PDF-y Egger. Bez logowania, bez zdjęć i tekstur.
- Wyszukiwarka dostępności `edc-availability.egger.services` została zablokowana przez zabezpieczenia sesji. Nie obchodzono
  blokady. Grubości Egger wzięto z oficjalnego „Programu dostaw EDC 26+” (PDF).

## Niezależne review

Subagent (sonnet) pracował tylko do odczytu i dostał wyłącznie `.krn/review/K3D-PLYTY-01b/`, czyli JSON-y, `weryfikacja.md` i `ZASADY.md`.
Wylosował 5 pozycji: H3309 ST28, H3170 ST12, F186 ST9 płyta, F186 ST9 blat i Kronospan K001 PW. Każdą sprawdził na karcie
producenta, a pozycje Egger dodatkowo w PDF „Program dostaw EDC 26+”. **Werdykt: OK, 5/5, bez BLOCKER i bez ERROR.**
Spójność `weryfikacja.md` z JSON-ami: zgodna.

Uwaga z review: liczba 24 w `weryfikacja.md` to stan bez zamienników. Po decyzji Pawła jest ich 28. Zamienników ST7 i K101
review nie losował. Werdykt review nie jest akceptacją, akceptuje Paweł.

## Scalenie z `main` (decyzja Pawła: „Scal i rozwiąż”)

Od bazy gałęzi (`4f2bdf2`) w `origin/main` przybyło 9 commitów (K3D-MEBLE-02, do `5f5c6e6`). Merge `527ebec` miał konflikty
w 8 plikach (9 bloków). Rozwiązania:

| Plik | Rozwiązanie |
|---|---|
| `package.json` | Runner testów z `main` (`tsx`, `*.test.ts`). `plyty.test.mjs` przeniesiony do `plyty.test.ts` z typami pod `tsc`. |
| `MebelParametryczny.tsx` | Wspólny `useMaterialyMebla` z `main` dostał strukturę płyt (korpus, środek, fronty). Działa też w cargo i LeMans. |
| `AgdBryla.tsx` | Blat waterfall z `main` + grubość i struktura blatu z bazy płyt. Bez wybranej płyty geometria jest taka sama jak w `main`. |
| `zrodloOferty.ts`, `formatki.ts` | Bok waterfall w formatkach ma grubość płyty blatu z bazy, gdy jest wybrana (np. kompakt 12 mm). W pozostałych przypadkach jak w `main`. |
| `dokument.ts`, `Produkcja.tsx` | Zostają pola obu stron (obrzeże i uwagi z płyt, wzory i CSV hurtowni z `main`). |
| `ofertaPdf.ts` | Uwagi wykonawcze z `main` + nota o płytach. |

`package-lock.json` jest identyczny z `main`. Zmianę metadanych, którą zrobił lokalny `npm install`, cofnięto.

**Nie sprawdzono w przeglądarce:** blatu waterfall razem z płytą blatu z bazy. Ta kombinacja jest sprawdzona tylko przez tsc, testy i build.

## Liczba odczytanych stron

Egger: 35 kart dekorów (w tym próby innych struktur) i 2 PDF-y. Kronospan: 13 kart. Do tego wyszukiwarka internetowa
ograniczona do egger.com i kronospan.com. Review: 5 kart i PDF Egger.

## Push na `main` i deploy (polecenie Pawła: „commit i push do main, sprawdź przed”)

Projekt Cloudflare Pages `system-ofertowania` (system-ofertowania.pages.dev, oprzut.app) jest podpięty do Gita: push na `main`
sam buduje i wdraża produkcję. Tak poszło K3D-MEBLE-02 (deploy z `5f5c6e6`). GitHub Actions `Testy` uruchamia się równolegle
i nie blokuje deployu, dlatego wszystkie kontrole wykonano lokalnie przed pushem:

| Polecenie | Exit |
|---|---|
| `npx tsc --noEmit` | 0 |
| `npm test` (36 testów, w tym 10 płyt i 2 nowe w `produkcja/zrodloOferty.test.ts`) | 0 |
| `npm run build` | 0 |
| `npm run lint` w osobnym klonie poza `D:\kuchnia` | 0 |
| `npm run test:e2e` (Playwright, 8 testów: konta, szybka oferta, PDF z kreatora, rozkrój, panel, kopia) | 0 |

Nowy test `zrodloOferty.test.ts` sprawdza miejsce scalenia: bok waterfall i naddatek blatu w grubości płyty z bazy
(kompakt 12 mm), a bez płyty grubość jak w `main` (38 mm).
Wizualnie w 3D nie sprawdzono kombinacji waterfall + płyta blatu z bazy (potrzebne konto firmy w lokalnym podglądzie).
