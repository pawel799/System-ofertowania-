# K3D-PLYTY-01 – raport (ETAP 2)

Data: 2026-11-19. Gałąź `feat/baza-plyt` (worktree `D:\kuchnia\.claude\worktrees\baza-plyt`), lokalny commit `939e934`
od `origin/main` 4f2bdf2, autor pawel799. Bez push i bez deployu. Paczka: `K3D-PLYTY-01.zip` (OPIS.txt, zmiany.diff, pliki/).

## Polecenia i kody wyjścia (log: `kontrola-po.log`)

| Polecenie | Exit |
|---|---|
| `npx tsc --noEmit` | 0 |
| `npm test` (node --test, 9 testów) | 0 |
| `npm run lint` | **1** – konflikt pluginu `@next/next` między `.eslintrc.json` worktree a `D:\kuchnia\.eslintrc.json` (zagnieżdżony worktree; tak samo na czystym `origin/main`, `build-przed.log` l.10) |
| `npx eslint --no-eslintrc -c .eslintrc.json --ext .ts,.tsx,.js,.jsx,.mjs src functions` | 0 |
| `npm run build` | 0 |

Do potwierdzenia przez Pawła: `npm run lint` w zwykłym katalogu (nie zagnieżdżonym).

## Pomiary przed / po

| | przed (`origin/main`) | po |
|---|---|---|
| rozmiar `out/` | 24 407 953 B | 24 447 270 B (+39 kB, w tym JSON-y i wzór CSV) |
| First Load JS `/panel/kreator` | 254 kB | 261 kB (+7 kB) |
| wszystkie chunki JS razem (gzip -9) | 1 428 715 B | 1 439 711 B (+11,0 kB) |
| chunk z bazą płyt (leniwy) | – | 6,8 kB, 1,0 kB gzip |
| czas buildu | 60 s | 39–57 s |
| `/panel/kreator` – loadEventEnd (rozgrzewka + 3×) | 201 / 203 / 199 ms | 247 / 245 / 198 ms |
| `/panel/kreator` – krok gotowy (górna granica) | 335 / 337 / 331 ms | 392 / 378 / 326 ms |

Czasy: lokalnie (wrangler pages dev), ciepła pamięć podręczna, pojedynczy komputer – różnica ok. +40 ms w medianie,
w granicach szumu. Bundle kreatora rośnie o ok. 7 kB (limit ~30 kB gzip spełniony); baza płyt ładuje się leniwie.

## Test ręczny (lokalnie, testowe konto z danych `e2e/pomoc.ts`)

- Ustawienia → Baza płyt: CSV z 5 wierszami → podgląd: 3 do zapisu, wiersze 4 („brak producenta”) i 6 („zła grubość”) wypisane; zapis do KV, lista po odświeżeniu.
- Kreator → Materiały → Płyty producentów: wyszukanie „h1145” pokazuje płytę z CSV („moja baza”) i wbudowaną; wybór korpusu Egger H1145 ST10, blatu kompakt (domyślnie 12 mm, lista 12–16), frontu z CSV.
- 3D: korpus z proceduralnymi słojami, cienki blat kompaktowy (zrzuty w `.krn/review/K3D-PLYTY-01/zrzuty/`).
- Zapis oferty: `kuchnia.plyty` w KV (korpus + blat z faktami i grubością).
- Formatki: „Egger H1145 ST10 18 mm”, blat „Moja hurtownia KP-12 Kompakt czarny łódź, 12 mm”, z ceną z CSV: „płyty z ceną 19,48 zł netto” (0,43 m² × 45,50 zł); bez ceny – brak kwoty.
- PDF (pdfHtml w Node przez esbuild): linia „Materiał: Korpus: Egger H1145 ST10 …, 18 mm · Blat: …”, nota prawna, brak obrazów producenta; stara oferta bez linii „Materiał”, dopłaty jak dotąd. Poprawiono dublowanie „38 mm (38 mm)”.
- **Stara oferta** (ta sama bez `plyty` i `materialy`, POST 201) otwiera się w kreatorze bez błędu; w konsoli tylko błędy niezwiązane (CSP dla mojego testowego zapytania do atrapy poczty, 503 „Brak klucza modelu” – lokalnie brak klucza szyfrowanego modelu).

## Niezależne review (subagent read-only, sonnet, tylko `.krn/review/K3D-PLYTY-01/`)

Wszystkie pozycje OK, brak BLOCKER/ERROR: fakty w bazie, brak logo/zdjęć/tekstur, brak scrapowania (uwaga: dane spisane bez porównania z katalogiem – do sprawdzenia przez Pawła), HEX + `CanvasTexture`, `textureUrl: null`, brak nowych palet RAL/NCS, nota w kreatorze i PDF, brak nowych zależności, brak sekretów. Werdykt review nie jest akceptacją – akceptuje Paweł.

## Otwarte

1. Dane `data/boards/*.json` – sprawdzić z aktualnymi katalogami PDF (ZRODLA.md).
2. Istniejąca paleta RAL (`src/components/ral.ts`, pakiety RAL) – osobne zadanie migracji.
3. Import z PDF (opcja 7) – nie zrobiony. XLSX – tylko komunikat „zapisz jako CSV”.
4. Strona klienta: wybór kolorów pojedynczego mebla (KoloryMebli) nie zna płyt.
