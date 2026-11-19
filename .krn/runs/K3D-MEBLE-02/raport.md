# K3D-MEBLE-02 – raport

Gałąź lokalna `feat/meble-cargo-lemans` (od `main` 4f2bdf2 + commit z recon), bez pusha i bez deployu. Autor commitów: pawel799.

## Commity (ETAP 2)
| Krok | Commit | Co |
|---|---|---|
| 1 | `27b5994` | Strona zawiasu drzwi jednoskrzydłowych `hinge: L/P` – 3D (zawias, animacja, uchwyt po przeciwnej), trójkąt otwierania na rysunku/PDF, przełącznik w panelu. Runner testów `node --test` + `tsx`. |
| 2+3 | `83e18ea` | Cargo dolne (15/20/30/40, 2 kosze) i cargo wysokie (słupek, 5 koszy do 200 cm, wyżej 6). Jeden commit, bo to ten sam nowy rodzaj `cargo` w dwóch strefach. |
| 4 | `630dfcb` | Narożnik typu LeMans L/P: część ślepa, blenda 50–100 mm, front 400–600 mm, kosze „nerki” z obrotem, ostrzeżenia o sąsiedniej szafce. |
| 5 | `342cc32` | Blat waterfall L/P/oba: 3D, rysunek, rozkrój („bok waterfall”), uwaga o 45° w PDF. |
| 6 | `0153756` | Wysuwy: typ prowadnic (rolkowe / kulkowe / ukryte z cichym domykiem) jako osobna pozycja okuć z ilością; ceny okuć w cenniku. |
| 7 | `51c30a3` | Tryb „bez cen”, CSV do hurtowni, CSV okuć i okleiny, liczba cięć, wzory boku/dna. |
| – | `6bd7b76` | Poprawka typu w teście (tsc wyłapał po commicie 7). |

## Polecenia i exit codes
Przed (main + recon): `npx tsc --noEmit` 0, `npm run lint` 0, `npm run build` 0, `out/` 24 425 225 B.
Po (ostatni commit, czysty `.next`):
- `npx tsc --noEmit` – exit 0
- `npm run lint` – exit 0
- `npm test` – exit 0 (24 pass, 0 fail)
- `npm run build` – exit 0
- `out/` 24 455 616 B (+30 391 B, +0,12%)

## Testy jednostkowe (`npm test`, 24 testy)
- szafka 60: dno (wieniec) 600 − 2×18 = **564** mm, boki 720 × 557 (`formatki.test.ts`)
- cargo 30: boki 720×557, wieńce 264×557, front 717×297, kosz 2 poziomy + prowadnice ukryte 500 mm
- słupek cargo 300 (210 cm): boki 2100×557, front 2097×297, mechanizm z 6 koszami (200 cm → 5)
- LeMans L i P: blenda 717×70 / 717×60, front 717×447 / 717×497, mechanizm lewy/prawy, ostrzeżenia (22 mm od frontu, zasłonięcie o 18 mm, brak sąsiada)
- waterfall: bok 820 mm (nóżki 100 + korpus 720), 870 przy nóżkach 150, blat dłuższy o 38 mm, ostrzeżenie w środku ciągu
- wysuwy: ilość kompletów, brak podwójnej dopłaty, ceny z cennika firmy, parser
- bez cen: CSV z dokładnym nagłówkiem, bez „zł” w PDF i mailu, cięcia z rozkroju
- zgodność: stary plan bez nowych pól przechodzi parser bez zmian

## Stara oferta (KV)
Odczyt oferty z KV nie przechodzi przez parser, a wszystkie nowe pola są opcjonalne (brak = zachowanie jak dotąd).
Porównanie `main` ↔ gałąź na kuchni pokazowej (`narzedzia/stara-oferta.ts`): parser, cena (7524 zł), formatki, okucia, blaty i podział frontów **identyczne**.

## Pomiar FPS (Playwright, headless Chromium, WebGL programowy SwiftShader – liczby porównawcze)
| Plan | Widok | Przed | Po |
|---|---|---|---|
| kuchnia pokazowa (12 mebli + 3 AGD) | desktop 1440×900, /kreator | 10,3–10,6 FPS, 832 draw calls | 10,3–10,5 FPS, 831–832 |
| kuchnia pokazowa | telefon Pixel 7, /oferta/view (atrapa API) | 9,0 FPS, 803 | 8,9–9,4 FPS, 800–803 |
| nowe-12 (LeMans, 2× cargo, waterfall, wysuwy) | desktop | – (main nie zna typów) | 11,5–12,1 FPS, ~605 |
| nowe-12 | telefon | – | 10,0–10,2 FPS, ~575 |
Kosze cargo i „nerki” LeMans są sklejone w jedną geometrię na mebel. Kreator na telefonie się nie uruchamia (komunikat „Kreator działa na komputerze”), dlatego telefon mierzony na stronie oferty klienta.

## Zrzuty i review
Zrzuty (JPEG, jakość 78; oceniane były PNG 1440×900): `.krn/runs/K3D-MEBLE-02/zrzuty/` (zawiasy L/P, cargo 30, cargo wysokie 30, LeMans L i P, także z góry, waterfall P, kuchnia 12 – zamknięte/otwarte).
Niezależne review (świeży subagent read-only, tylko folder `.krn/review/…`):
- Runda 1: 6/8 par OK, diff OK (bez marek producentów, bez sekretów, nagłówek CSV zgodny, „bez cen” bez kwot). ERROR: LeMans L – nie widać kosza z kamery głównej; LeMans P – szafka prostopadła zasłania front, raster na boku.
- Poprawki: dodatkowe ujęcia z góry; plan testowy LeMans P na ścianie 260 cm.
- Runda 2: LeMans L OK (kosz widoczny z góry), nachodzenie na front LeMans P naprawione. **Otwarte:** raster (acne cienia) na plecach HDF szafki ustawionej tyłem do pokoju – **występuje tak samo na `main`** (`runs/K3D-MEBLE-02/zrzuty/main-szafka-tylem-zamkniete.jpg`), to nie skutek tej zmiany; proponowane osobne zadanie (shadow bias / polygonOffset na plecach).
Werdykt review nie jest akceptacją – akceptuje Paweł.

## Do potwierdzenia / ograniczenia
- Wysokość boku waterfall (nóżki + korpus, do spodu blatu) – potwierdzić z Kubą. Nóżki: nowe pole „Nóżki (wysokość)” w ustawieniach Formatek i rozkroju (domyślnie 100 mm).
- Grubość blatu: w rozkroju z materiału blatu (`thicknessMm`), brak = 38 mm; w 3D blat ma stałe 28 mm (jak dotąd).
- Kreator nie liczy uciosu 45° – tylko opis w PDF i w formatce.
- CSV hurtowni zawiera formatki w zadanym formacie; okucia, okleina w mb, blaty, liczba formatek i cięć są w osobnym CSV („CSV okuć i okleiny”) i w PDF produkcji – jeden plik w stałym formacie nie pomieści innych wierszy.
- Liczba cięć: z rozkroju gilotynowego (obrzeże arkusza + 0–2 cięcia na formatkę) – szacunek dla piły panelowej.
- Szuflady bez wybranego typu prowadnic liczą się jak dotąd (dopłata „szuflada”); wybór typu przenosi je do osobnej pozycji okuć. Przy cenach ręcznych okucia są w ofercie z ilością, bez kwot.
- K3D-PLYTY-01: poza plikami płyt; minimalne dopiski w `lib/kolory.ts` (części cargo/LeMans) i `produkcja/zrodloOferty.ts` (grubość blatu) – możliwy drobny konflikt przy scalaniu.
- Ostrzeżenia LeMans/waterfall pomijają meble pod dowolnym kątem (`kat`).
