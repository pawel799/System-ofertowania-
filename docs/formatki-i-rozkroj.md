# Formatki i rozkrój

Gdzie:
- w kreatorze, krok **Klient i oferta**, karta **Produkcja**, przycisk **Formatki i rozkrój**;
- na stronie `/panel/rozkroj` (link „Rozkrój” w panelu) – bez projektu, dla list z innych programów.

Wszystko liczy się w przeglądarce. Serwer nic tu nie robi i niczego nie zapisuje.
Ustawienia cięcia są zapamiętane w przeglądarce (`localStorage`).

## Źródła formatek

### Z projektu (`src/components/produkcja/formatki.ts`)

Geometria jak w bryle 3D (`MebelParametryczny`) i na rysunku technicznym (`frontyElementu`):
- płyta 18 mm, boki na całą wysokość, wieńce między bokami (pod zlew: 2 listwy po 100 mm);
- plecy HDF 3 mm nakładane (−2 mm z każdej strony) albo bez pleców;
- przegrody i półki z kolumn wnętrza (`wnetrze.ts`);
- szuflady: skrzynki z płyty (boki, przód/tył, dno HDF; prowadnica = głębokość − 40 mm, w dół do pełnych 50 mm) albo systemowe (wtedy tylko fronty);
- fronty z podziału rysunku minus szczelina (domyślnie 3 mm), okleina dookoła;
- słupek z piekarnikiem: półki pod i nad piekarnikiem, front dolny i górny (proporcje jak w 3D);
- zabudowa lodówki: korpus i front; zmywarka: sam front;
- modele 3D z R2 i AGD trafiają na listę „Bez formatek”.

Materiał każdej części to kolor mebla po dziedziczeniu (`koloryMebla`) z katalogu firmy. Słoje: wykończenie „struktura” albo nazwa drewna (`DREWNO_RE`).

Okucia: zawiasy (2/3/4/5 wg wysokości drzwi), prowadnice, podpórki półek, drążki, uchwyty (albo push-to-open), nóżki, zawieszki.

Blaty: ciągi szafek dolnych wzdłuż ścian, głębokość + nawis (domyślnie 20 mm), liczba płyt 4100 mm.

### Wklej listę (`importListy.ts`)

Komórki z Excela (tab), CSV (`;` albo `,` z cudzysłowami), TXT.
- Kolumny rozpoznają się po nagłówkach (PL i EN): długość, szerokość, ilość, materiał, nazwa, mebel, grubość, okleina (jedna kolumna albo D1/D2/S1/S2), słoje.
- Bez nagłówka: liczby w kolejności długość, szerokość, ilość.
- Wymiary < 300 traktujemy jako centymetry.
- Plik w Windows-1250 też się wczyta.
- `.xlsx` trzeba zapisać jako CSV albo wkleić komórki.

### Z modelu 3D (`importModelu.ts`)

- Obsługiwane pliki: OBJ (np. PRO100: Plik → Eksport → OBJ, opcjonalnie z MTL), 3DS, GLB (bez Draco).
- Siatki dzielimy na spójne kawałki. Kawałek z 8 narożnikami to płyta, także obrócona pod dowolnym kątem.
- Grubość to najkrótsza krawędź. Jednostki zgadujemy po typowej grubości 18 mm.
- Uchwyty, AGD i zaokrąglenia są pomijane.
- Okleiny i słojów model nie zapisuje.

## Rozkrój (`rozkroj.ts`)

Cięcie gilotynowe:
- arkusz domyślnie 2800 × 2070 mm, rzaz 4 mm, obrzeże 10 mm;
- formatka ze słojami nie obraca się;
- heurystyka BSSF z kilkoma kolejnościami i regułami podziału; wygrywa najmniej arkuszy, potem największa resztka.

## Wyniki

- Okno: zestawienie płyt (m², arkusze, odpad, okleina mb), tabele per materiał z numerami, arkusze SVG z tymi samymi numerami, okucia, blaty.
- **Drukuj / PDF**: osobne okno do druku (`dokument.ts`).
- **Pobierz CSV**:
  - kodowanie UTF-8 z BOM, separator `;`;
  - kolumny: Nr, Materiał, Grubość, Długość, Szerokość, Ilość, Słoje, Okleina D1–S2, Mebel, Element, Uwagi.
