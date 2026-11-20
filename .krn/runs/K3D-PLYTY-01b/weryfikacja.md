# K3D-PLYTY-01b — weryfikacja kodów płyt (ETAP 1)

Data sprawdzenia wszystkich pozycji: **2026-11-20**. Gałąź z danymi: `feat/baza-plyt` (worktree `D:\kuchnia\.claude\worktrees\baza-plyt`, commit 939e934).
Sprawdzane pliki: `data/boards/egger.json` (28), `data/boards/kronospan.json` (6). W tym etapie nie zmieniono ani jednego pliku z kodem.

## Źródła (tylko publiczne strony producentów, czytane pojedynczo)

| Skrót | Źródło |
|---|---|
| **E-KARTA** | Karta dekoru Egger PL: `https://www.egger.com/pl/meble-i-aranzacja-wnetrz/dekory/<KOD>_<STR>?country=PL` (np. `.../W1000_9?country=PL`). Podaje kod, strukturę, polską nazwę i listę grup produktów. Nie podaje grubości. |
| **E-PD** | Egger „Program dostaw – Kolekcja materiałów dekoracyjnych 26+” (PL, PDF, ostatnia zmiana 2026-01-23), link „Program dostaw EDC26+ (Polski/PDF)” ze strony produktu egger.com/pl: `https://binary.egger.link/pis/c57abcfd-7ca6-494f-bb18-0b5adc554d97/DI_Availability_guide_pl`. Tabela: dekor × produkt × grubość. Kolumny użyte niżej: **„Płyty wiórowe laminowane E1E05 TSCA P2” 2800×2070, 18 mm** oraz **„Blaty robocze postformowane Model 300/3” 4100×600 / 4100×920, 38 mm**. ● = z magazynu, ○ = z określonym czasem produkcji. „str.” = numer strony wydrukowany w broszurze (rozkładówki). |
| **E-ZM** | Egger PL „Kolekcja materiałów dekoracyjnych EGGER 2020–23 – Zmiany w dostępności dekorów” (PDF, 2023-09-13): `https://downloads.egger.com/static/baltics/Ulotka_Zmiany_w_dostepnosci_dekorow_EDC_2020_23_FAB_PLA.pdf` |
| **K-KARTA** | Karta dekoru Kronospan PL: `https://kronospan.com/pl_PL/decors/view/kronodesign/<kolekcja>/<KOD>/`. Podaje kod, strukturę i tabelę grubości dla każdego produktu (● w magazynie, ○ na życzenie). |

Surowe zapisy z każdej odczytanej strony: `egger_surowe.txt`, `kronospan_surowe.txt` (w tym folderze).
Nie użyto wyszukiwarki dostępności `edc-availability.egger.services`, bo zabezpieczenia sesji zablokowały tę domenę. Grubości Egger pochodzą więc z E-PD.

## Egger (28 pozycji)

| # | id w bazie | Kod/str. w bazie | Nazwa w bazie | Nazwa u producenta | Grubość wg E-PD | Status | Źródło |
|---|---|---|---|---|---|---|---|
| 1 | egger-w1000-st9-plyta | W1000 ST9 | Biały Premium | **Biały premium** | 18 ● | POPRAWIONE: nazwa „Biały Premium” → „Biały premium” (wielkość litery) | E-KARTA W1000_9; E-PD str. 4–5 |
| 2 | egger-w980-st2-plyta | W980 ST2 | Biały platynowy | — (brak karty PL dla ST2, 404) | brak wiersza W980 ST2 (są tylko ST7 i SM) | NIEPOTWIERDZONE: ST2 nie istnieje w E-PD ani na karcie PL; E-ZM: „W980 ST2* … kontynuacja z inną strukturą”. Możliwy zamiennik W980 ST7 „Biały platynowy” (18 ○), ale to inna struktura, więc wymaga decyzji Pawła | E-KARTA W980_2 (404), W980_7; E-PD str. 4–5; E-ZM s. 2 |
| 3 | egger-u708-st9-plyta | U708 ST9 | Szary jasny | Szary jasny | 18 ● | OK | E-KARTA U708_9; E-PD str. 8–9 |
| 4 | egger-u702-st9-plyta | U702 ST9 | Szary kaszmirowy | **Kaszmir** | 18 ● | POPRAWIONE: nazwa „Szary kaszmirowy” → „Kaszmir” | E-KARTA U702_9; E-PD str. 8–9 |
| 5 | egger-u732-st9-plyta | U732 ST9 | Szary pyłowy | **Szary przykurzony** | 18 ● | POPRAWIONE: nazwa „Szary pyłowy” → „Szary przykurzony” | E-KARTA U732_9; E-PD str. 10–11 |
| 6 | egger-u727-st9-plyta | U727 ST9 | Szary kamienny | Szary kamienny | 18 ● | OK | E-KARTA U727_9; E-PD str. 10–11 |
| 7 | egger-u961-st2-plyta | U961 ST2 | Czarny grafit | Szary grafitowy | brak wiersza U961 ST2 (jest ST7: 18 ●) | WYCOFANE: E-ZM (płyty Eurodekor) „U961 ST2* Szary grafitowy”, * = kontynuacja z inną strukturą; brak karty PL (404). Nazwa w bazie też była błędna | E-KARTA U961_2 (404), U961_7; E-PD str. 12–13; E-ZM s. 1 |
| 8 | egger-u999-st2-plyta | U999 ST2 | Czarny | Czarny | brak wiersza U999 ST2 (są m.in. ST7: 18 ●, ST19: 18 ●) | WYCOFANE: E-ZM „U999 ST2* Czarny”, kontynuacja z inną strukturą; brak karty PL (404) | E-KARTA U999_2 (404), U999_7; E-PD str. 12–13; E-ZM s. 1 |
| 9 | egger-h1145-st10-plyta | H1145 ST10 | Dąb Bardolino naturalny | Dąb Bardolino naturalny | 18 ● | OK | E-KARTA H1145_10; E-PD str. 12–13 |
| 10 | egger-h1146-st10-plyta | H1146 ST10 | Dąb Bardolino szary | — (brak karty PL, 404) | brak wiersza | WYCOFANE: E-ZM (płyty Eurodekor) „H1146 ST10 Dąb Bardolino szary” | E-KARTA H1146_10 (404); E-PD; E-ZM s. 1 |
| 11 | egger-h3303-st10-plyta | H3303 ST10 | Dąb Hamilton naturalny | Dąb Hamilton naturalny | 18 ● | OK | E-KARTA H3303_10; E-PD str. 18–19 |
| 12 | egger-h1180-st37-plyta | H1180 ST37 | Dąb Halifax naturalny | Dąb Halifax naturalny | 18 ● | OK | E-KARTA H1180_37; E-PD str. 12–13 |
| 13 | egger-h1176-st37-plyta | H1176 ST37 | Dąb Halifax biały | Dąb Halifax biały | 18 ● | OK (wycofany jest tylko blat H1176 wg E-ZM s. 4; tego blatu nie ma w bazie) | E-KARTA H1176_37; E-PD str. 12–13 |
| 14 | egger-h3309-st28-plyta | H3309 ST28 | Dąb Gladstone piaskowy | Dąb Gladstone piaskowy | 18 ● | OK | E-KARTA H3309_28; E-PD str. 18–19 |
| 15 | egger-h3325-st28-plyta | H3325 ST28 | Dąb Gladstone tabakowy | **Dąb Gladstone tabak** | 18 ● | POPRAWIONE: nazwa „Dąb Gladstone tabakowy” → „Dąb Gladstone tabak” | E-KARTA H3325_28; E-PD str. 18–19 |
| 16 | egger-h3170-st12-plyta | H3170 ST12 | Dąb Kendal naturalny | Dąb Kendal naturalny | 18 ● | OK | E-KARTA H3170_12; E-PD str. 16–17 |
| 17 | egger-h1344-st32-plyta | H1344 ST32 | Dąb Sherman koniakowo-brązowy | **Dąb Sherman koniakowy brązowy** | 18 ● | POPRAWIONE: nazwa „…koniakowo-brązowy” → „…koniakowy brązowy” | E-KARTA H1344_32; E-PD str. 14–15 |
| 18 | egger-h3730-st10-plyta | H3730 ST10 | Hikora naturalna | Hikora naturalna | 18 ● | OK | E-KARTA H3730_10; E-PD str. 20–21 |
| 19 | egger-h3700-st10-plyta | H3700 ST10 | Orzech Pacyfik naturalny | **Orzech Pacific naturalny** | 18 ● | POPRAWIONE: nazwa „Orzech Pacyfik naturalny” → „Orzech Pacific naturalny” | E-KARTA H3700_10; E-PD str. 20–21 |
| 20 | egger-f186-st9-plyta | F186 ST9 | Beton Chicago jasnoszary | Beton Chicago jasnoszary | 18 ● | OK | E-KARTA F186_9; E-PD str. 20–21 |
| 21 | egger-f187-st9-plyta | F187 ST9 | Beton Chicago ciemnoszary | Beton Chicago ciemnoszary | 18 ● | OK | E-KARTA F187_9; E-PD str. 20–21 |
| 22 | egger-f274-st9-plyta | F274 ST9 | Beton jasny | — (brak karty PL, 404) | brak wiersza | WYCOFANE: E-ZM (płyty Eurodekor) „F274 ST9 Beton jasny” | E-KARTA F274_9 (404); E-PD; E-ZM s. 2 |
| 23 | egger-f186-st9-blat | F186 ST9 (blat) | Beton Chicago jasnoszary | Beton Chicago jasnoszary | blat postformowany 38: 4100×600 ●, 4100×920 ● | OK (karta wymienia „Blaty robocze”) | E-KARTA F186_9; E-PD str. 20–21 |
| 24 | egger-f187-st9-blat | F187 ST9 (blat) | Beton Chicago ciemnoszary | Beton Chicago ciemnoszary | blat 38: 4100×600 ●, 4100×920 ● | OK | E-KARTA F187_9; E-PD str. 20–21 |
| 25 | egger-f812-st9-blat | F812 ST9 (blat) | Marmur Levanto biały | Marmur Levanto biały | blat: brak (płyta 18 tylko ○) | WYCOFANE (jako blat): E-ZM s. 4 „Blaty robocze … F812 ST9 Marmur Levanto biały”; karta F812_9 nie wymienia „Blaty robocze”; E-PD bez blatu | E-KARTA F812_9; E-PD str. 24–25; E-ZM s. 4 |
| 26 | egger-f204-st75-blat | F204 ST75 (blat) | Marmur Carrara biały | — (brak karty PL, 404) | brak wiersza | WYCOFANE: E-ZM s. 4 „Blaty robocze … F204 ST75 Marmur Carrara biały” | E-KARTA F204_75 (404); E-PD; E-ZM s. 4 |
| 27 | egger-h1145-st10-blat | H1145 ST10 (blat) | Dąb Bardolino naturalny | Dąb Bardolino naturalny | blat 38: 4100×600 ●, 4100×920 ● | OK | E-KARTA H1145_10; E-PD str. 12–13 |
| 28 | egger-h3303-st10-blat | H3303 ST10 (blat) | Dąb Hamilton naturalny | Dąb Hamilton naturalny | blat 38: 4100×600 ●, 4100×920 ● | OK | E-KARTA H3303_10; E-PD str. 18–19 |

Format w bazie (płyta 2800×2070, blat 4100×600) zgadza się z nagłówkami kolumn E-PD.

## Kronospan (6 pozycji)

Na polskiej stronie Kronospan nazwy dekorów są tylko po angielsku. Jako nazwę producenta podaję je w oryginale.

| # | id w bazie | Kod w bazie | Nazwa w bazie | U producenta (pl_PL) | Struktura | Grubości (płyta wiórowa laminowana MF PB, 2800×2070) | Status | Źródło |
|---|---|---|---|---|---|---|---|---|
| 29 | kronospan-0101-plyta | 0101 | Biały | brak karty 0101 na pl_PL (przekierowanie na 404). Na pl_PL istnieje **K101 Front White** (PE, MF PB 18 ●) | — | — | NIEPOTWIERDZONE: kodu 0101 nie ma na polskiej stronie producenta (występuje na stronach innych krajów jako „0101 Front White”). Możliwy zamiennik K101 PE, ale to inny kod, więc wymaga decyzji Pawła | K-KARTA color/0101 (404), color/K101 |
| 30 | kronospan-0190-plyta | 0190 | Czarny | brak karty 0190 na pl_PL. Na pl_PL jest **K190 Black**, ale **bez** płyty MF PB (tylko Acrylic, lakierowane MDF, Mirror Gloss, kompakt itd.) | — | — | NIEPOTWIERDZONE: brak 0190 na pl_PL; K190 nie ma laminowanej płyty wiórowej, więc nie ma zamiennika 1:1 | K-KARTA color/0190 (404), color/K190 |
| 31 | kronospan-0162-plyta | 0162 | Antracyt | nie znaleziono kodu 0162 w żadnej wersji strony (pl_PL ani inne) | — | — | NIEPOTWIERDZONE: kod nie istnieje w źródłach producenta | K-KARTA 0162 (404); wyszukiwanie w kronospan.com bez wyniku |
| 32 | kronospan-k001-plyta | K001 | Dąb Craft biały | **K001 White Craft Oak** | **PW** | 18 ● (8/10/12/16/19/22/25/28/38 ○) | POPRAWIONE: nazwa → „White Craft Oak”; dopisać strukturę PW | K-KARTA standard/K001 |
| 33 | kronospan-k002-plyta | K002 | Dąb Craft złoty | **K002 Grey Craft Oak** | **PW** | 18 ● (pozostałe ○) | POPRAWIONE: **nazwa była zamieniona z K003**: „Dąb Craft złoty” → „Grey Craft Oak” (szary); dopisać PW; hex poglądowy trzeba dobrać do szarego | K-KARTA standard/K002 |
| 34 | kronospan-k003-plyta | K003 | Dąb Craft szary | **K003 Gold Craft Oak** | **PW** | 18 ● (pozostałe ○) | POPRAWIONE: **nazwa była zamieniona z K002**: „Dąb Craft szary” → „Gold Craft Oak” (złoty); dopisać PW; hex poglądowy trzeba dobrać do złotego | K-KARTA standard/K003 |

Dodatkowo, czego nie ma w bazie: K002 i K003 mają u producenta blaty 38 mm (FP, 4100×635 ●). Nie dopisuję ich bez polecenia.

## Podsumowanie

| Status | Egger | Kronospan | Razem |
|---|---|---|---|
| OK | 15 | 0 | 15 |
| POPRAWIONE | 6 | 3 | 9 |
| NIEPOTWIERDZONE | 1 (W980 ST2) | 3 (0101, 0190, 0162) | 4 |
| WYCOFANE | 6 (U961 ST2, U999 ST2, H1146 ST10, F274 ST9, blat F812 ST9, blat F204 ST75) | 0 | 6 |
| **Razem** | 28 | 6 | 34 |

Po ETAPIE 2 (bez zamienników) w bazie zostanie **24 pozycje** (Egger 21 = 17 płyt + 4 blaty, Kronospan 3).

### Decyzje dla Pawła przed ETAPEM 2
1. **Zamienniki o innej strukturze lub kodzie** (każdy potwierdzony w E-PD lub K-KARTA, ale to inne produkty niż w bazie): W980 ST7, U961 ST7, U999 ST7, Kronospan K101 PE. Domyślnie **nie dodaję** ich. Zgodnie z zasadą usuwam stare pozycje bez zastępowania.
2. **Kolory HEX K002/K003**: hex zostaje poglądowy (własny dobór). Po zamianie nazw obecne kolory nie pasują (złoty hex przy szarym dekorze), więc w ETAPIE 2 zamienię je miejscami między K002 a K003.
3. **Nazwy Kronospan po angielsku**: tak podaje producent na pl_PL. Wpisuję oryginał.
