# K3D-PLYTY-01 — recon (ETAP 1, tylko odczyt)

Data: 2026-11-19. Stan czytany: katalog roboczy `D:\kuchnia` (gałąź `landing-pokaz-kreatora`) + porównanie z `origin/main`.
Żadnych zmian w kodzie. Jedyny nowy plik: ten.

## 0. Stan repo — ważne przed ETAP 2

- `origin/main` (4f2bdf2) **zawiera całą** gałąź `landing-pokaz-kreatora` i jest dalej: E2E Playwright (`e2e/`, `playwright.config.ts`, `npm run test:e2e`), `src/components/produkcja/zrodloOferty.ts`, zmiany w `KreatorApp.tsx`, `SettingsApp.tsx`, `ofertaPdf.ts`, `Produkcja.tsx`.
- Lokalny `main` (a64c752) jest **nieaktualny** — `feat/baza-plyt` trzeba wyciągnąć z `origin/main`, nie z lokalnego `main`.
- W katalogu roboczym leżą **niezacommitowane zmiany cudzej pracy** (ściany: `Sciany.tsx`, `scianyStore.ts`, `PaletaSciany.tsx`, `SterowanieScian.tsx`, `KuchniaScena.tsx`, `kuchnia.ts`, `KreatorApp.tsx`, `KreatorShow.tsx`). Nie ruszam ich. Propozycja: ETAP 2 w osobnym `git worktree` na `feat/baza-plyt` (od `origin/main`), żeby nie mieszać.
- Folderu `skills/` (`context-relay`, `frame-review`, `visual-lab`, `AGENTS-rekurencja.md`) **nie ma** ani w gałęzi roboczej, ani w `origin/main` (jest tylko `.claude/skills/` z innymi skillami). Stosuję zasady relay i review ręcznie, jak mówi prompt.
- Testy jednostkowe: brak runnera (jest tylko Playwright). Node 24.13 → `node --test` z natywnym obcinaniem typów TS, **zero nowych zależności**.

## 1. Kolory i materiały mebli dziś

| Warstwa | Plik | Co jest |
|---|---|---|
| Wbudowane próbki | `src/components/catalog.ts` | `FRONTS` (5), `COUNTERTOPS` (3), `HARDWARE` (3) — id, nazwa, kolor, dopłata |
| **Paleta RAL Classic** | `src/components/ral.ts` (≈213 kolorów, z npm `ral-colors` MIT) + `palettes.ts` (pakiety RAL firmy, KV `palette:<id>`) | front może mieć id `ral:<pakiet>:<kod>` |
| Katalog materiałów firmy | `src/components/katalogFirmy.ts` (typ `KatalogPozycja`, rodzaje `plyta_front/plyta_korpus/plyta_blat/obrzeze/uchwyt/…`), magazyn `katalogStore.ts`, UI `panel/KatalogTab.tsx`, API `functions/api/katalog/*`, walidacja + snapshot `functions/_lib/katalog.ts` | KV `catalog:<id>` (1 klucz na pozycję), w ofercie `cat:<id>`; limit planu `limits.katalog` (30/200/∞, `src/lib/plans.ts`) |
| Rozwiązywanie id → materiał | `findMaterial(rola, id, ctx)` w `katalogFirmy.ts`; kolejność: wbudowane → RAL → katalog | typ wspólny `Material { id,name,color,delta,finish,thicknessMm,producer,zrodlo }` |
| Kolory części mebla | `src/lib/kolory.ts`: `KoloryMebla {front,korpus,srodek,uchwyt}` na elemencie, `KoloryProjektu {korpus,srodek}` w planie; dziedziczenie boki←fronty, środek←boki; id walidowane `REF_RE` (dowolny ref do 80 znaków) | korpus i środek biorą próbki z **listy frontów** (`findMaterial("front", …)`) |
| Oferta (KV) | `functions/_lib/offers.ts` `Offer.front / countertop / hardware` (id), `Offer.kuchnia` (plan z kolorami), `Offer.materialy` (snapshot `MaterialySnapshot` front/blat/okucia z chwili zapisu) | `validateOffer` przyjmuje: id wbudowane, `ral:`, `cat:` |
| 3D | `kuchnia/KuchniaScena.tsx` → `lookFor()` (`modelRoles.ts`) kolor + wykończenie → `AgdBryla.tsx` / `MebelParametryczny.tsx`; wykończenie → `LOOK_WYKONCZENIA` (roughness/clearcoat), brak tekstur dekorów | blat: `BLAT[countertop]` albo kolor z katalogu |
| Rozkrój | `produkcja/zrodloOferty.ts` (origin/main) / `KreatorApp.tsx` `zrodloProdukcji`: materiał części = `findMaterial("front", koloryMebla(...)[czesc])`, `grubosc = thicknessMm ?? 18`, słoje z `finish==="struktura"` lub `DREWNO_RE` | blat tylko jako **nazwa** (`blatNazwa`) |
| PDF | `panel/ofertaPdf.ts`: „Kolor mebli: …”, „Blat: …” (`zGruboscia`), opis kolorów per mebel; `produkcja/dokument.ts`: tabela formatek z kolumną materiału (`nazwaZGruboscia`) i CSV | |

Wniosek: istnieje już mechanizm „materiał po id + snapshot w ofercie”. Nowa baza płyt powinna się do niego **podpiąć** (nowy prefiks id), a nie budować równoległy świat.

## 2. Grubości w wymiarach — gdzie są zaszyte

**Płyta korpusu 18 mm — stała w 3 miejscach, geometria od niej zależy:**
- `src/lib/wnetrze.ts:15` `PLYTA_CM = 1.8` (światło, przestrzenie, rysunek `rysunekTechniczny.ts:81-91`),
- `src/components/produkcja/formatki.ts:86` `T = 18`, `:87` `PLECY = 3`, `HDF` 3 mm (`:83`),
- `src/components/kuchnia/MebelParametryczny.tsx:17` `T = 0.018`, `PLECY = 0.003`.
- Uwaga: `zrodloOferty`/`KreatorApp` już dziś wpisują do formatki `grubosc = thicknessMm` z katalogu, ale wymiary liczą z 18 → płyta 16 mm z katalogu daje opis „16 mm” i wymiary jak dla 18. **To istniejący błąd, który nowa baza by nasiliła.**
- Decyzja do ETAP 2: korpus liczony zawsze dla 18 mm; wybór płyty korpusu o innej grubości → ostrzeżenie „wymiary liczone dla 18 mm” (zmiana całej geometrii to osobne zadanie). Kompakt i blat nie wpływają na korpus.

**Blat — 3 niezależne wartości na sztywno:**
- `kuchnia/AgdBryla.tsx:28-35` `Blat`: siatka grubości `0.028`, środek `H + 0.016`; `ZlewNaSzafce` `H + 0.032` (`:94`); osobny element `rodzaj==="blat"` (`:332`) używa `el.h`,
- `kuchnia/uklad3d.ts:10` `BLAT_NAD_KORPUSEM = 0.03` (poziom AGD/zlewu/wyposażenia na blacie),
- `rysunek/rysunekTechniczny.ts:393-394` blat 3 cm nad szafkami dolnymi.
- `formatki.ts:268-302` `blatyPlanu`: długość/szerokość + `nawisBlatu`, bez grubości; `blatyNaPlyty` (4100 mm).
- Plan ETAP 2: jedno źródło `gruboscBlatu(plan)` w `src/lib/` (mm), używane przez te 3 miejsca. Brak pola w planie = zachowanie jak dziś (siatka 28, poziom 30) → stare oferty wyglądają identycznie. Ustawione → poziom blatu = korpus + grubość. Grubość jako parametr gotowy dla K3D-MEBLE-02 (waterfall).

## 3. Ustawienia stolarni (panel, KV)

- KV `OFFERS`, każda firma przez `scoped()` (`functions/_lib/tenant.ts:86`) → prefiks `t:<firmId>:` (firma `main` bez prefiksu).
- Ustawienia: `functions/api/settings/*` (`brand`, `cennik` → `settings:cennik-modulow` w `functions/_lib/modul.ts`, `embed`, `domain`, `powiadomienia`); UI `src/components/panel/SettingsApp.tsx` (zakładki, w tym `KatalogTab.tsx`, `CennikTab.tsx`).
- Cennik ma już listę płyt z ceną arkusza: `ModulCennik.plyty: PlytaKorpusu[] {id,nazwa,grubosc,dl,szer,cenaArkusza}` + `plytaDomyslna`, `odpadPlyty` (`src/lib/modul.ts:39-96`), a plan ma `plan.plyta` (id) → `cenaKoncowa.ts`. **Drugi istniejący „katalog płyt”, tym razem cenowy.**
- Propozycja zapisu bazy z CSV: jeden klucz KV na firmę `boards:csv` → `{ wersja, at, plyty: Board[] }` (jeden JSON; 1000 wierszy ≈ 150–250 kB, limit KV 25 MiB). Nowe API `GET/PUT /api/settings/plyty` (tylko właściciel, jak cennik), eksport CSV po stronie przeglądarki.

## 4. Propozycja schematu (TypeScript)

```ts
// src/lib/plyty.ts — zwykły moduł bez Reacta (panel, kreator, functions/)
export type Producent = "Egger" | "Kronospan" | "Inny";
export type TypPlyty = "plyta" | "blat" | "kompakt" | "front" | "obrzeze"; // "obrzeze" — patrz pytanie 2
export type Wykonczenie = "mat" | "polysk" | "drewno" | "kamien" | "beton" | "inne";

export type Board = {
  id: string;                    // katalog: "egger-h1145-st10"; csv: losowe 10–32 znaki
  producer: Producent;
  producerName?: string;         // gdy producer === "Inny" (np. „Swiss Krono”) — tylko tekst opisowy
  code: string;                  // „H1145”
  name: string;                  // „Dąb Bardolino naturalny”
  structure?: string;            // „ST10”
  type: TypPlyty;
  thicknesses: number[];         // mm, np. [18] / [28, 38] / [12]
  format?: [number, number];     // mm, np. [2800, 2070]
  hex: string;                   // #rrggbb dobrany ręcznie — poglądowy
  finish: Wykonczenie;           // → proceduralna struktura w 3D (bez tekstur producenta)
  textureUrl?: null;             // zawsze puste w tym zadaniu
  priceM2?: number;              // tylko z CSV; brak = tryb „bez cen”
  source: "katalog" | "csv";
};

// Ref w ofercie (mieści się w REF_RE z kolory.ts): "brd:<id>" ; grubość wybrana osobno.
export type WyborPlyty = { ref: string; grubosc: number };

// Nowe pole w PlanKuchni (opcjonalne — stara oferta bez niego działa jak dziś)
export type MaterialyPlyt = {
  korpus?: WyborPlyty;
  front?: WyborPlyty;
  blat?: WyborPlyty;             // grubosc: 28/36/38 (blat) lub 12–16 (kompakt, domyślnie 12)
  obrzeze?: WyborPlyty;
};

// Snapshot w Offer.materialy (serwer przy zapisie): fakty płyty z chwili zapisu → PDF i link klienta
// nie zależą od późniejszej edycji CSV.
export type PlytaSnapshot = Pick<Board, "producer" | "producerName" | "code" | "name" | "structure" | "type" | "hex" | "finish" | "priceM2"> & { ref: string; grubosc: number };

export const opisPlyty = (b: PlytaSnapshot) => `${b.producerName ?? b.producer} ${b.code}${b.structure ? " " + b.structure : ""} ${b.grubosc} mm`; // „Egger H1145 ST10 18 mm”
```

Integracja: `findMaterial` dostaje nowy prefiks `brd:` (rozwiązuje przez załadowaną leniwie bazę + CSV firmy) i zwraca zwykły `Material` → 3D, formatki, PDF działają bez przepisywania. Wbudowane `data/boards/*.json` ładowane `import()` tylko w oknie wyboru płyty (osobny chunk), nie w bundlu kreatora.

## 5. Pliki do zmiany (ETAP 2)

Nowe:
- `data/boards/egger.json`, `data/boards/kronospan.json`, `data/boards/ZRODLA.md`
- `src/lib/plyty.ts` (typy, walidacja, `opisPlyty`, `gruboscBlatu`), `src/lib/plytyCsv.ts` (parser/eksport CSV, bez zależności), `src/lib/plytyCsv.test.ts` (`node --test`)
- `src/components/panel/WyborPlyty.tsx` (wyszukiwarka kod/nazwa, filtr producenta i typu, lazy import JSON)
- `src/components/panel/PlytyTab.tsx` (import CSV/XLSX, podgląd, błędy z numerem wiersza, zapis, eksport)
- `functions/api/settings/plyty.ts` (+ walidacja w `functions/_lib/plyty.ts`)
- `public/wzor-plyty.csv`
- `.krn/runs/K3D-PLYTY-01/raport.md`, `.krn/review/K3D-PLYTY-01/`

Zmieniane:
- `src/components/katalogFirmy.ts` (prefiks `brd:` w `findMaterial`, snapshot)
- `src/lib/kuchnia.ts` (pole `plyty?: MaterialyPlyt` w `PlanKuchni` + `parseKuchnia`)
- `functions/_lib/offers.ts`, `functions/_lib/katalog.ts` (walidacja refów `brd:`, snapshot `PlytaSnapshot`)
- `src/components/kuchnia/AgdBryla.tsx`, `kuchnia/uklad3d.ts`, `rysunek/rysunekTechniczny.ts` (grubość blatu z `gruboscBlatu`)
- `src/components/produkcja/zrodloOferty.ts`, `formatki.ts`, `dokument.ts` (kolumna „materiał”: `Egger H1145 ST10 18 mm`, blat z grubością, ostrzeżenie ≠18 mm)
- `src/components/panel/ofertaPdf.ts` (materiały + stopka prawna), stopka kreatora (`KreatorApp.tsx` lub `KreatorKroki.tsx`)
- `src/components/panel/KreatorKolory.tsx` / `KoloryElementu.tsx` (wybór: korpus, fronty, blat, obrzeże)
- `src/components/panel/SettingsApp.tsx` (nowa zakładka), `package.json` (`"test": "node --test"`, ewentualnie `papaparse`)

## 6. Ryzyka i pytania do Pawła

1. **RAL już jest w produkcie.** `src/components/ral.ts` to wbudowana paleta RAL Classic (licencja MIT dotyczy paczki npm, nie praw RAL gGmbH), pakiety RAL firm (`palettes.ts`, KV `palette:*`), oferty z id `ral:<pakiet>:<kod>`, tekst w `SettingsApp.tsx:704`. To sprzeczne z zakazem z promptu, ale usunięcie zepsuje istniejące oferty i pakiety. Proponuję **nie ruszać w K3D-PLYTY-01** (nowa baza nie używa RAL) i zrobić osobne zadanie: migracja pakietów RAL na „kod lakieru wpisany przez stolarnię + własny HEX”. Do decyzji.
2. Prompt chce wyboru **obrzeża**, a `Board.type` go nie ma → proponuję dodać `"obrzeze"` do typu (grubości np. 0,8/2 mm). OK?
3. Baza z CSV: **osobny klucz `boards:csv`** (proponuję; bez limitu `limits.katalog`, setki wierszy) czy **pozycje istniejącego katalogu firmy** (`catalog:<id>`, limit 30 w planie Start)? Czy CSV ma limit wierszy wg planu?
4. `cena_m2` z CSV a istniejący cennik płyt (`ModulCennik.plyty`, cena arkusza): czy cena z CSV ma **zastępować** cenę płyty z cennika w wycenie oferty, czy tylko być pokazana w rozkroju? Proponuję: v1 tylko rozkrój/zestawienie (m² × cena), wycena oferty bez zmian.
5. Dane wbudowane: nie mogę sprawdzić kodów w katalogu online bez otwierania stron producentów (a scrapowania nie robię). Wpiszę tylko kody, których jestem pewien, z linkiem do publicznego katalogu w `ZRODLA.md` i adnotacją „do sprawdzenia przez Pawła” — albo poczekam na CSV od Pawła. Spodziewaj się raczej ~15–20 pewnych wpisów na producenta niż 30.
6. XLSX przez SheetJS z CDN: CSP w `public/_headers` prawdopodobnie blokuje zewnętrzne skrypty; SheetJS nie publikuje już aktualnych wersji na npm. Alternatywa: tylko CSV (+ instrukcja „Zapisz jako CSV UTF-8”), jak w `importListy.ts`. Proponuję tak w v1.
7. Grubość korpusu ≠ 18 mm: v1 = ostrzeżenie, geometria zostaje 18 (pkt 2). Pełna obsługa to osobne zadanie.
8. Pomiar bundla: baseline `out/` i rozmiar chunku `/panel/kreator` zrobię na `feat/baza-plyt` przed pierwszą zmianą.

ETAP 1 gotowy.
