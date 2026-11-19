# Źródła danych bazy płyt

Pliki: `egger.json` (22 płyty korpusowe 18 mm + 6 blatów 38 mm), `kronospan.json` (6 płyt 18 mm).
Stan: 2026-11-19.

## Co jest w danych

Tylko fakty opisowe: producent, kod dekoru, struktura (jeśli pewna), nazwa dekoru, typ, grubości, format.
Kolor `hex` to **własny, ręcznie dobrany kolor poglądowy** – nie pochodzi z plików, skanów ani próbek
producenta. `finish` to ogólne wykończenie (mat, drewno, beton, kamień), z którego scena 3D robi
własną, proceduralną strukturę. `textureUrl` jest zawsze `null`.

Bez logotypów, zdjęć, skanów i tekstur producentów. Bez pobierania danych z portali producentów
(Egger Decor Explorer, Kronosfera i podobnych) – nic nie było scrapowane.

## Skąd kody i nazwy

Kody i nazwy wpisane ręcznie jako popularne dekory z publicznych katalogów kolekcji:

- Egger – aktualna „Decorative Collection” (katalog PDF dla Polski, egger.com → materiały do pobrania).
- Kronospan – katalog kolekcji dekorów płyt meblowych (kronospan.com → do pobrania).

**Do sprawdzenia przez Pawła przed wdrożeniem.** Wpisy spisał asystent (AI) z wiedzy o tych katalogach,
**bez porównania z PDF w tej sesji** i bez otwierania portali producentów (zakaz scrapowania). Każdą
pozycję trzeba porównać z aktualnym wydaniem katalogu (kod, struktura, polska nazwa). Pozycję, której nie da się potwierdzić, usuń – lepiej mniej pewnych niż więcej zgadniętych.
W `kronospan.json` celowo nie ma struktur (oznaczeń powierzchni) – nie były pewne.

## Jak dopisać lub poprawić

- Ten sam format, co `Board` w `src/lib/plyty.ts`; `id` = `producent-kod-struktura-typ` małymi literami
  (test `npm test` sprawdza, czy pliki przechodzą walidację i czy id się zgadzają).
- Firmy mogą też wgrać własną bazę z CSV: Ustawienia → Baza płyt (wzór: `public/wzor-plyty.csv`).
