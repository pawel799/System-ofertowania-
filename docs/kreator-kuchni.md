# Kreator kuchni

Kreator jest dla firmy, która nie rysuje kuchni w PRO100 albo Winnerze. W panelu składa się zabudowę z gotowych szafek, zapisuje ją jako zwykłą ofertę i wysyła klientowi **dwie osobne rzeczy**: link do podglądu 3D oraz PDF oferty handlowej.

To nie jest rozkrój płyt. Nie ma nestingu ani listy formatek.

## Gdzie to jest

- Panel → **Kreator** (`/panel/kreator`), albo „Kreator kuchni” przy nowej ofercie.
- Zapisana kuchnia wraca na listę ofert. W karcie oferty: **Edytuj w kreatorze**, oraz w kolumnie linku sekcje **Link dla klienta** (3D) i **Oferta PDF**.
- Klient otwiera ten sam adres co dotychczas (`/oferta/…`) i widzi złożoną kuchnię w 3D, z wyborem frontu, blatu i okuć.

## Jak złożyć kuchnię

1. Wybierz układ: **ciąg prosty** albo **kształt L**. Wymiary ścian są w centymetrach. Pomieszczenie jest opcjonalne (sam obrys, nie przycina szafek).
2. Z katalogu dodajesz:
   - **moduły parametryczne** (szafka dolna, górna, słupek, szuflady, narożna — ta sama bryła co na `/oferta/modul`),
   - **półki ścienne** (pojedyncza i podwójna) w pasie szafek górnych, dosunięte górą do sąsiednich szafek,
   - **AGD**: zmywarka, piekarnik (słupek i pod blatem), płyta indukcyjna i gazowa, lodówka wolnostojąca i zabudowa, mikrofalówka, okap kominowy i podszafkowy, zlewozmywak, bateria oraz szafka pod zlew. Gdy nie ma własnego GLB, kreator rysuje bryłę parametryczną o właściwym obrysie,
   - **modele 3D firmy** wgrane w Ustawienia → Modele 3D. Bryła jest skalowana do podanych wymiarów.
   - **bibliotekę 50 GLB** (`seed/modele-kuchnia-50`, po wgraniu skryptem do firmy `main`): szafki, blaty, AGD i dodatki (01–46) w katalogu kreatora, z wymiarami z `katalog.json` (cm, zaokrąglone) i rolami front / blat / uchwyt. Cztery gotowe kuchnie (47–50: prosta, L, z wyspą, aneks) nie są szafką w kreatorze — wybiera się je jako model całej oferty (nowa oferta albo karta oferty → Model 3D, grupa „Gotowe kuchnie”).
3. Na rzucie przeciągasz element (napis to nazwa albo szerokość; pełna nazwa i wymiary w podpowiedzi po najechaniu) (albo strzałkami, co 5 cm; krawędź przyciąga się do ściany i sąsiada). Obrót o 90°. Gruba kreska to front. Szafka górna może stać nad dolną. Płyta, zlew i bateria leżą na blacie i nie zasłaniają szafki dolnej. Półka dzieli miejsce z szafkami górnymi. Słupek nie może nachodzić na żaden inny element.
4. **Wymiary** (włączone domyślnie) rysują linie jak w rysunku meblowym: długość ścian, pomieszczenie, długość ciągu oraz — po zaznaczeniu — szerokość, głębokość i wysokość. To samo widać w podglądzie 3D. Przycisk „Wymiary” chowa nakładkę; zrzut do PDF bierze aktualny widok.
5. Zaznaczenie otwiera **właściwości**: nazwa, szerokość, wysokość i głębokość w widełkach tego rodzaju (np. zmywarka 45–60 cm, półka płytsza niż szafka). Zmiana szerokości trzyma krawędź od strony narożnika i przesuwa dalsze elementy rzędu, więc styk zostaje. „Dociągnij rząd” zsuwa przerwę do 25 cm. Cena pozycji liczy się z nowych wymiarów tym samym wzorem co szafka (urządzenia AGD bez ceny).
6. Kolor frontów: próbki z katalogu albo pakiet RAL firmy, jeśli jest w ustawieniach. Jeden kolor na całą kuchnię, tak jak w dotychczasowej ofercie.
7. **Zapisz ofertę.** Serwer (nie przeglądarka) wpisuje cenę: `base` i lista modułów biorą się z wymiarów i cennika firmy (Ustawienia → Cennik modułów). Wzór jest ten sam co przy szafkach na wymiar — także dla półek i zabudów AGD (słupek z piekarnikiem, piekarnik pod blatem, zmywarka do zabudowy, zabudowa lodówki, szafka pod zlew). Same urządzenia — płyty, okapy, zlewozmywak, bateria, lodówka wolnostojąca i mikrofalówka — nie wchodzą do ceny (`URZADZENIA_POZA_WYCENA` w `src/lib/kuchnia.ts`), bo strona klienta mówi „Bez AGD i montażu”. W PDF są na liście z dopiskiem „AGD, poza ceną”. Dopłaty za front, blat i okucia dolicza strona klienta tak jak dotychczas.

„Wstaw przykład” kładzie typowy ciąg albo L — ze zmywarką, płytą, okapem i półką ścienną — żeby nie zaczynać od pustego rzutu.

## Dwie wysyłki

- **Podgląd 3D** — „Utwórz link 3D”, potem „Wyślij podgląd 3D”. To dotychczasowy mail albo SMS z adresem `/oferta/…`. Ważność, PIN i ukrycie ceny doprecyzujesz w panelu oferty.
- **Oferta PDF** — osobne przyciski „Pobierz PDF” i „Wyślij ofertę PDF”.
  - Pobranie otwiera okno drukowania przeglądarki. Trzeba wybrać **Zapisz jako PDF**. Nie ma renderu 3D na serwerze. Jeśli scena zdążyła się narysować, na pierwszej stronie jest jeden zrzut.
  - Mail PDF ma pozycje, wymiary i kwoty netto. Nie zastępuje maila z linkiem 3D — oba wychodzą osobno. Plik PDF dołącza się ręcznie (poczta nie przyjmie go z samego `mailto`).

PDF jest ofertą handlową: marka firmy, klient, układ, pozycje, wymiary, ceny netto, dopłaty materiałowe. Na dole jest wprost napisane, że to nie jest rozkrój.

## Dane

Na ofercie w KV dochodzi pole `kuchnia`: układ (`ciag` albo `L`), długości ścian, opcjonalne pomieszczenie i elementy (id, nazwa, źródło `modul` albo `model`, `rodzaj`, strefa, wymiary, pozycja, obrót). Strefy: `dolna`, `gorna`, `wysoka`, `blat`, `polka`. Starsze oferty bez `rodzaj` są szafką. Ceny w tym polu nie ma.

Przy każdym zapisie z panelem funkcja `zCenaKuchni` nadpisuje `base` i `moduly`. Publiczny `GET /api/public/:slug` liczy kwotę jeszcze raz z aktualnego cennika, więc zmiana cennika w ustawieniach widać u klienta bez ponownego zapisu oferty. Przy ukrytej cenie kwot nie ma, geometria zostaje.

**Po wdrożeniu tej wersji** istniejąca oferta publiczna, w której plan miał płytę, okap, zlewozmywak, baterię, lodówkę wolnostojącą albo mikrofalówkę, pokaże **niższą kwotę**. Cena liczy się na żywo, bez tych urządzeń. Zabudowy (szafka, słupek, zmywarka do zabudowy) zostają w cenie.

Element z własnym GLB (`zrodlo: "model"`) może mieć obrys od 1×1×1 do 400×280×400 cm, żeby zmieścił się blat 240 cm, cienka płyta i panel boczny. Szafka parametryczna ma dotychczasowe widełki.

## Biblioteka 50 modeli

Pliki leżą w repozytorium: `seed/modele-kuchnia-50/` (GLB, `katalog.json`, `id-map.json`). Id spełnia ten sam wzorzec co reszta modeli (`/^[A-Za-z0-9]{10,32}$/`). Mapa: `mk` + numer `01`–`50` + id z katalogu bez podkreśleń. Jedyny dopisek to `mk43hokerx` (samo „hoker” byłoby za krótkie).

Sprawdzenie plików, bez sieci:

```
node seed/modele-kuchnia-50/seed.mjs --check
```

Wgranie do firmy `main` (bez prefiksu kluczy). Skrypt jest idempotentny: drugi raz nie dubluje wpisów, nadpisuje plik i oznaczenia z katalogu. **Nie uruchamiać na produkcji, dopóki Paweł nie napisze „deploy”.** Po review wgra to Grok Bot.

```
# lokalnie, gdy działa wrangler pages dev (bindingi OFFERS i MODELS)
# i katalog .wrangler/state już istnieje. Wrangler odrzuca bucket „MODELS”
# (wielkie litery), więc --local zapisuje wprost do magazynu miniflare.
node seed/modele-kuchnia-50/seed.mjs --local

# produkcja: R2 kuchnia-modele, KV kuchnia-oferty, projekt system-ofertowania
SEED_CONFIRM=kuchnia-modele node seed/modele-kuchnia-50/seed.mjs --remote
```

Klucze KV: `model:<id>` (opis, w tym `tags` z katalogu: Front→front, Blat→blat, Uchwyt→uchwyt) i `modelowner:<id>` → `main`. Plik R2: `models/<id>/<wersja>.glb`. Firma `main` nie ma limitu liczby modeli; inne firmy tej biblioteki nie widzą, dopóki nie mają tych samych wpisów u siebie.

Model użyty w kreatorze nie da się usunąć, dopóki jest w jakiejś ofercie (tak samo jak model całej kuchni). Link publiczny nie zwraca katalogu firmy — tylko modele wstawione w tę kuchnię.

## Lokalnie

```
npm run build
npx -y wrangler@4 pages dev out --kv OFFERS --r2 MODELS
```

Potem zalogowana firma: `/panel/kreator`. Sam `next dev` nie ma API ofert; kreator wtedy trzyma szkic w przeglądarce i pokazuje „Dane demo”. Link klienta i tak wymaga API.
