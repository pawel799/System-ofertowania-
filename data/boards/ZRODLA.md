# Źródła danych bazy płyt

Pliki: `egger.json` (20 płyt 18 mm i 4 blaty 38 mm), `kronospan.json` (4 płyty 18 mm).
Weryfikacja: K3D-PLYTY-01b, 2026-11-20. Każdy kod, nazwa, struktura i grubość zostały potwierdzone w publicznym
źródle producenta, wymienionym niżej przy danym kodzie. Strony czytano pojedynczo, bez logowania i bez pobierania zdjęć ani tekstur.

## Co jest w danych

Tylko fakty opisowe: producent, kod dekoru, struktura, nazwa dekoru, typ, grubości, format.
Kolor `hex` to **własny, ręcznie dobrany kolor poglądowy**. Nie pochodzi z plików, skanów, zdjęć ani próbek
producenta. `finish` to ogólne wykończenie (mat, drewno, beton, kamień), z którego scena 3D robi
własną, proceduralną strukturę. `textureUrl` jest zawsze `null`.

Nazwy są takie, jakie podaje producent na swojej polskiej stronie. Kronospan podaje je tam tylko po angielsku.
Grubości: płyta 18 mm, blat 38 mm. Wszystkie są u producenta dostępne z magazynu, z jednym wyjątkiem:
Egger W980 ST7 18 mm ma w programie dostaw status „z określonym czasem produkcji”. Pozostałe grubości
producenci robią na zamówienie, dlatego nie ma ich w bazie.

## Źródła ogólne

- **Egger, karta dekoru (PL):** `https://www.egger.com/pl/meble-i-aranzacja-wnetrz/dekory/<KOD>_<numer struktury>?country=PL`.
  Podaje kod, strukturę, polską nazwę i grupy produktów.
- **Egger, „Program dostaw – Kolekcja materiałów dekoracyjnych 26+” (PL, PDF):** https://binary.egger.link/pis/c57abcfd-7ca6-494f-bb18-0b5adc554d97/DI_Availability_guide_pl
  (link „Program dostaw EDC26+ (Polski/PDF)” ze strony produktu egger.com/pl). Tabela dekor × produkt × grubość.
  „s.” to numer strony wydrukowany w broszurze.
- **Egger, „Kolekcja materiałów dekoracyjnych 2020–23 – Zmiany w dostępności dekorów” (PL, PDF):**
  https://downloads.egger.com/static/baltics/Ulotka_Zmiany_w_dostepnosci_dekorow_EDC_2020_23_FAB_PLA.pdf.
  Na jej podstawie usunięto wycofane dekory i struktury.
- **Kronospan, karta dekoru (pl_PL):** `https://kronospan.com/pl_PL/decors/view/kronodesign/<kolekcja>/<KOD>/`.
  Podaje kod, strukturę i tabelę grubości dla każdego produktu.

## Źródło każdej pozycji

| Producent | Kod | Struktura | Nazwa | Typ | Karta dekoru | Grubość potwierdzona w | Sprawdzono |
|---|---|---|---|---|---|---|---|
| Egger | W1000 | ST9 | Biały premium | plyta | https://www.egger.com/pl/meble-i-aranzacja-wnetrz/dekory/W1000_9?country=PL | Program dostaw EDC 26+, s. 4–5 (płyta wiórowa laminowana 18 mm) | 2026-11-20 |
| Egger | W980 | ST7 | Biały platynowy | plyta | https://www.egger.com/pl/meble-i-aranzacja-wnetrz/dekory/W980_7?country=PL | Program dostaw EDC 26+, s. 4–5 (płyta wiórowa laminowana 18 mm) | 2026-11-20 |
| Egger | U708 | ST9 | Szary jasny | plyta | https://www.egger.com/pl/meble-i-aranzacja-wnetrz/dekory/U708_9?country=PL | Program dostaw EDC 26+, s. 8–9 (płyta wiórowa laminowana 18 mm) | 2026-11-20 |
| Egger | U702 | ST9 | Kaszmir | plyta | https://www.egger.com/pl/meble-i-aranzacja-wnetrz/dekory/U702_9?country=PL | Program dostaw EDC 26+, s. 8–9 (płyta wiórowa laminowana 18 mm) | 2026-11-20 |
| Egger | U732 | ST9 | Szary przykurzony | plyta | https://www.egger.com/pl/meble-i-aranzacja-wnetrz/dekory/U732_9?country=PL | Program dostaw EDC 26+, s. 10–11 (płyta wiórowa laminowana 18 mm) | 2026-11-20 |
| Egger | U727 | ST9 | Szary kamienny | plyta | https://www.egger.com/pl/meble-i-aranzacja-wnetrz/dekory/U727_9?country=PL | Program dostaw EDC 26+, s. 10–11 (płyta wiórowa laminowana 18 mm) | 2026-11-20 |
| Egger | U961 | ST7 | Szary grafitowy | plyta | https://www.egger.com/pl/meble-i-aranzacja-wnetrz/dekory/U961_7?country=PL | Program dostaw EDC 26+, s. 12–13 (płyta wiórowa laminowana 18 mm) | 2026-11-20 |
| Egger | U999 | ST7 | Czarny | plyta | https://www.egger.com/pl/meble-i-aranzacja-wnetrz/dekory/U999_7?country=PL | Program dostaw EDC 26+, s. 12–13 (płyta wiórowa laminowana 18 mm) | 2026-11-20 |
| Egger | H1145 | ST10 | Dąb Bardolino naturalny | plyta | https://www.egger.com/pl/meble-i-aranzacja-wnetrz/dekory/H1145_10?country=PL | Program dostaw EDC 26+, s. 12–13 (płyta wiórowa laminowana 18 mm) | 2026-11-20 |
| Egger | H3303 | ST10 | Dąb Hamilton naturalny | plyta | https://www.egger.com/pl/meble-i-aranzacja-wnetrz/dekory/H3303_10?country=PL | Program dostaw EDC 26+, s. 18–19 (płyta wiórowa laminowana 18 mm) | 2026-11-20 |
| Egger | H1180 | ST37 | Dąb Halifax naturalny | plyta | https://www.egger.com/pl/meble-i-aranzacja-wnetrz/dekory/H1180_37?country=PL | Program dostaw EDC 26+, s. 12–13 (płyta wiórowa laminowana 18 mm) | 2026-11-20 |
| Egger | H1176 | ST37 | Dąb Halifax biały | plyta | https://www.egger.com/pl/meble-i-aranzacja-wnetrz/dekory/H1176_37?country=PL | Program dostaw EDC 26+, s. 12–13 (płyta wiórowa laminowana 18 mm) | 2026-11-20 |
| Egger | H3309 | ST28 | Dąb Gladstone piaskowy | plyta | https://www.egger.com/pl/meble-i-aranzacja-wnetrz/dekory/H3309_28?country=PL | Program dostaw EDC 26+, s. 18–19 (płyta wiórowa laminowana 18 mm) | 2026-11-20 |
| Egger | H3325 | ST28 | Dąb Gladstone tabak | plyta | https://www.egger.com/pl/meble-i-aranzacja-wnetrz/dekory/H3325_28?country=PL | Program dostaw EDC 26+, s. 18–19 (płyta wiórowa laminowana 18 mm) | 2026-11-20 |
| Egger | H3170 | ST12 | Dąb Kendal naturalny | plyta | https://www.egger.com/pl/meble-i-aranzacja-wnetrz/dekory/H3170_12?country=PL | Program dostaw EDC 26+, s. 16–17 (płyta wiórowa laminowana 18 mm) | 2026-11-20 |
| Egger | H1344 | ST32 | Dąb Sherman koniakowy brązowy | plyta | https://www.egger.com/pl/meble-i-aranzacja-wnetrz/dekory/H1344_32?country=PL | Program dostaw EDC 26+, s. 14–15 (płyta wiórowa laminowana 18 mm) | 2026-11-20 |
| Egger | H3730 | ST10 | Hikora naturalna | plyta | https://www.egger.com/pl/meble-i-aranzacja-wnetrz/dekory/H3730_10?country=PL | Program dostaw EDC 26+, s. 20–21 (płyta wiórowa laminowana 18 mm) | 2026-11-20 |
| Egger | H3700 | ST10 | Orzech Pacific naturalny | plyta | https://www.egger.com/pl/meble-i-aranzacja-wnetrz/dekory/H3700_10?country=PL | Program dostaw EDC 26+, s. 20–21 (płyta wiórowa laminowana 18 mm) | 2026-11-20 |
| Egger | F186 | ST9 | Beton Chicago jasnoszary | plyta | https://www.egger.com/pl/meble-i-aranzacja-wnetrz/dekory/F186_9?country=PL | Program dostaw EDC 26+, s. 20–21 (płyta wiórowa laminowana 18 mm) | 2026-11-20 |
| Egger | F187 | ST9 | Beton Chicago ciemnoszary | plyta | https://www.egger.com/pl/meble-i-aranzacja-wnetrz/dekory/F187_9?country=PL | Program dostaw EDC 26+, s. 20–21 (płyta wiórowa laminowana 18 mm) | 2026-11-20 |
| Egger | F186 | ST9 | Beton Chicago jasnoszary | blat | https://www.egger.com/pl/meble-i-aranzacja-wnetrz/dekory/F186_9?country=PL | Program dostaw EDC 26+, s. 20–21 (blat postformowany 38 mm, 4100×600) | 2026-11-20 |
| Egger | F187 | ST9 | Beton Chicago ciemnoszary | blat | https://www.egger.com/pl/meble-i-aranzacja-wnetrz/dekory/F187_9?country=PL | Program dostaw EDC 26+, s. 20–21 (blat postformowany 38 mm, 4100×600) | 2026-11-20 |
| Egger | H1145 | ST10 | Dąb Bardolino naturalny | blat | https://www.egger.com/pl/meble-i-aranzacja-wnetrz/dekory/H1145_10?country=PL | Program dostaw EDC 26+, s. 12–13 (blat postformowany 38 mm, 4100×600) | 2026-11-20 |
| Egger | H3303 | ST10 | Dąb Hamilton naturalny | blat | https://www.egger.com/pl/meble-i-aranzacja-wnetrz/dekory/H3303_10?country=PL | Program dostaw EDC 26+, s. 18–19 (blat postformowany 38 mm, 4100×600) | 2026-11-20 |
| Kronospan | K101 | PE | Front White | plyta | https://kronospan.com/pl_PL/decors/view/kronodesign/color/K101/ | ta sama karta: Płyta wiórowa laminowana (MF PB) 18 mm, 2800×2070 | 2026-11-20 |
| Kronospan | K001 | PW | White Craft Oak | plyta | https://kronospan.com/pl_PL/decors/view/kronodesign/standard/K001/ | ta sama karta: Płyta wiórowa laminowana (MF PB) 18 mm, 2800×2070 | 2026-11-20 |
| Kronospan | K002 | PW | Grey Craft Oak | plyta | https://kronospan.com/pl_PL/decors/view/kronodesign/standard/K002/ | ta sama karta: Płyta wiórowa laminowana (MF PB) 18 mm, 2800×2070 | 2026-11-20 |
| Kronospan | K003 | PW | Gold Craft Oak | plyta | https://kronospan.com/pl_PL/decors/view/kronodesign/standard/K003/ | ta sama karta: Płyta wiórowa laminowana (MF PB) 18 mm, 2800×2070 | 2026-11-20 |

## Jak dopisać lub poprawić

- Dopisujemy tylko pozycje potwierdzone w źródle producenta. Do tej tabeli dodajemy URL i datę sprawdzenia.
- Format jak `Board` w `src/lib/plyty.ts`; `id` = `producent-kod-struktura-typ` małymi literami.
  `npm test` sprawdza walidację, zgodność id, wymagane pola, unikalność kodów w obrębie producenta
  i typu, wzór kodu oraz to, czy każda pozycja ma wiersz w tym pliku.
- Firmy mogą też wgrać własną bazę z CSV: Ustawienia → Baza płyt (wzór: `public/wzor-plyty.csv`).
