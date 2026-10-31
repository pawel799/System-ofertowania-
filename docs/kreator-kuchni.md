# Kreator kuchni

Kreator jest dla firmy, która nie rysuje kuchni w PRO100 albo Winnerze. W panelu składa się zabudowę z gotowych szafek, zapisuje ją jako zwykłą ofertę i wysyła klientowi **dwie osobne rzeczy**: link do podglądu 3D oraz PDF oferty handlowej.

To nie jest rozkrój płyt. Nie ma nestingu ani listy formatek.

## Gdzie to jest

- Panel → **Nowa** → co projektujemy → „W kreatorze, krok po kroku” (`/panel/kreator?typ=kuchnia|szafa|komoda|lazienka|inne`).
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
   - **bibliotekę 100 GLB** szaf, szafek i komód (`seed/modele-szafy-komody-100`): grupy **Szafy**, **Szafki** i **Komody** w katalogu kreatora. Wstawiają się jak moduły kuchenne (wymiary i strefa z `id-map.json`). Nie zastępują mk01–mk50 i nie są modelem całej oferty.
3. Na rzucie przeciągasz element (napis to nazwa albo szerokość; pełna nazwa i wymiary w podpowiedzi po najechaniu) (albo strzałkami, co 5 cm; krawędź przyciąga się do ściany i sąsiada). Obrót o 90°. Gruba kreska to front. Szafka górna może stać nad dolną. Płyta, zlew i bateria leżą na blacie i nie zasłaniają szafki dolnej. Półka dzieli miejsce z szafkami górnymi. Słupek nie może nachodzić na żaden inny element.
4. **Wymiary** (włączone domyślnie) rysują linie jak w rysunku meblowym: długość ścian, pomieszczenie, długość ciągu oraz — po zaznaczeniu — szerokość, głębokość i wysokość. To samo widać w podglądzie 3D. Przycisk „Wymiary” chowa nakładkę; zrzut do PDF bierze aktualny widok.
5. Zaznaczenie otwiera **właściwości**: nazwa, szerokość, wysokość i głębokość w widełkach tego rodzaju (np. zmywarka 45–60 cm, półka płytsza niż szafka). Zmiana szerokości trzyma krawędź od strony narożnika i przesuwa dalsze elementy rzędu, więc styk zostaje. „Dociągnij rząd” zsuwa przerwę do 25 cm. Cena pozycji liczy się z nowych wymiarów tym samym wzorem co szafka (urządzenia AGD bez ceny).
6. Kolor frontów: próbki z katalogu albo pakiet RAL firmy, jeśli jest w ustawieniach. Jeden kolor na całą kuchnię, tak jak w dotychczasowej ofercie.
7. **Zapisz ofertę.** Serwer (nie przeglądarka) wpisuje cenę: `base` i lista modułów biorą się z wymiarów i cennika firmy (Ustawienia → Cennik modułów). Wzór jest ten sam co przy szafkach na wymiar — także dla półek i zabudów AGD (słupek z piekarnikiem, piekarnik pod blatem, zmywarka do zabudowy, zabudowa lodówki, szafka pod zlew). Same urządzenia — płyty, okapy, zlewozmywak, bateria, lodówka wolnostojąca i mikrofalówka — nie wchodzą do ceny (`URZADZENIA_POZA_WYCENA` w `src/lib/kuchnia.ts`), bo strona klienta mówi „Bez AGD i montażu”. W PDF są na liście z dopiskiem „AGD, poza ceną”. Dopłaty za front, blat i okucia dolicza strona klienta tak jak dotychczas.

„Wstaw przykład” kładzie typowy ciąg albo L — ze zmywarką, płytą, okapem i półką ścienną — żeby nie zaczynać od pustego rzutu.

## Kreator krok po kroku (kuchnia, szafa, komoda, łazienka)

**Nowa oferta** w panelu pyta najpierw **co projektujemy** (kuchnia, szafa / garderoba, komoda / RTV / regał, łazienka, inny mebel), potem **jak**: „W kreatorze, krok po kroku” (`/panel/kreator?typ=…`) albo „Z gotowego modelu albo kwoty” (dotychczasowy formularz). Rodzaj zapisuje się w `offer.projekt` (`src/lib/projekt.ts`; brak = kuchnia).

Kreator ma sześć kroków w prawej kolumnie (pasek u góry, „Dalej” / „Wstecz” w stopce pod sumą):

1. **Pomiar / Wnęka** – szerokość, długość i wysokość pomieszczenia (do sufitu), układ (ciąg, L), długość ściany pod zabudowę.
2. **Okna i instalacje** – okna (od narożnika, szerokość, parapet) i drzwi na ścianach zabudowy, przyłącze wody, gaz czy indukcja. Na rzucie: okno niebieską kreską, drzwi z łukiem, woda kropką; w 3D okno i drzwi na ścianie.
3. **Wyposażenie** – kuchnia: AGD do zabudowy (jedna zmywarka / piekarnik / lodówka z pary) i wysokość szafek górnych (72, 90, do sufitu); szafa: drzwi przesuwne albo uchylne i co ma się zmieścić; komoda: które meble; łazienka: szerokość szafki pod umywalkę i słupek. **Ułóż propozycję** (`src/lib/propozycja.ts`) robi pierwszy układ: zlew przy wodzie, zmywarka obok, płyta z okapem poza oknem, słupki na końcu (nigdy pod oknem, nie kosztem zlewu i płyty), szafki górne nad dolnymi poza oknem, nic w drzwiach; szafa na całą wnękę do sufitu z wnętrzem pod potrzeby. Czego nie dało się zmieścić – komunikat.
4. **Meble** – lista elementów (dwuklik: okno elementu) i właściwości zaznaczonego. Zaznaczenie na rzucie albo w 3D przenosi do tego kroku.
5. **Materiały** – fronty, blat (kuchnia), okucia.
6. **Klient i oferta** – klient, kontakt, nazwa, budżet (ostrzeżenie, gdy projekt go przekracza), termin, uwagi z pomiaru, PDF i link 3D.

Odpowiedzi z kroków 1–3 i 6 zapisują się w planie (`kuchnia.wywiad`, `src/lib/wywiad.ts`, walidacja w `parseKuchnia`). Zapisana oferta otwiera się od kroku „Meble”.

**Samouczek** (6 dymków: kroki, katalog, rzut, 3D, cena, zapis) startuje sam przy pierwszej nowej ofercie w danej przeglądarce; potem przycisk „Samouczek” w nagłówku.

Katalog pokazuje najpierw grupy pasujące do projektu (`GRUPY_TYPU` w `projekt.ts`), reszta po „Pokaż wszystkie elementy”; okno biblioteki ma filtr „Do projektu”. Na wymiar są też szafy (uchylne, przesuwne, wnękowe do sufitu), komody, szafki nocne, RTV, regały, szafki pod umywalkę i słupek łazienkowy.

## Okno elementu: wymiary i wnętrze

Kliknięcie elementu w katalogu (albo w bibliotece) otwiera okno: wymiary w widełkach rodzaju, **gotowe układy wnętrza** (miniatury; te, które nie pasują do wymiarów, są wyszarzone z powodem) albo **własny układ**: kolumny (przegrody), w każdej przestrzenie od góry – półka, szuflada, drążek – z wysokością w świetle, „bez drzwi” dla kolumny, rodzaj frontu (uchylne, przesuwne, regał). Podgląd z wymiarami, opis („3 kolumny · 6 półek · 2 szuflady · drążek · drzwi przesuwne”), cena. Ten sam widok: dwuklik na meblu (rzut, lista) albo „Zmień wnętrze” we właściwościach. Model 3D z biblioteki ma tylko wymiary – i przycisk „Zamień na … na wymiar z własnym wnętrzem”.

Zabezpieczenia (`sprawdzWnetrze` w `src/lib/wnetrze.ts`, te same na serwerze – zapis z nierealnym wnętrzem dostaje 400): kolumna min. 20 cm; półka do 100 cm szerokości (ostrzeżenie od 80 cm przy kilku półkach); między półkami min. 10 cm; szuflada 8–45 cm wysokości, 20–110 cm szerokości, moduł min. 30 cm głębokości; drążek min. 60 cm wysokości, min. 50 cm głębokości, 30–120 cm długości; skrzydło drzwi do 60 cm (szersza kolumna dostaje dwa skrzydła); drzwi przesuwne od 100 cm szerokości i 55 cm głębokości; suma przestrzeni i półek = światło korpusu (wysokość − 2 × 1,8 cm). Po zmianie wymiaru wnętrze przelicza się samo; gdy przestaje mieć sens, wraca układ domyślny.

Cena: wymiary jak dotąd + płyta dodatkowych półek, przegród i skrzynek szuflad + szuflady i drążki z cennika (Ustawienia → Cennik modułów: „Szuflada we wnętrzu”, „Drążek w szafie”). Element bez zapisanego wnętrza kosztuje tyle co wcześniej. PDF dopisuje wnętrze przy pozycji.

## 3D: drzwi i szuflady, tło

- **Otwórz drzwi i szuflady** (kreator nad podglądem 3D, strona klienta przy „Uwagi do projektu”) otwiera wszystkie fronty; dwuklik na meblu w 3D – tylko ten. Moduły na wymiar: drzwi na zawiasach, szuflady ze skrzynką, drzwi przesuwne, w środku półki i drążki. Modele GLB (biblioteka i wgrane pliki z nazwami `Front_drzwi*`, `Front_szuflada*`, `Front_klapa*`, `Front_panel*`, `Front_zmywarka*`): zawiasy przy bliższym boku, klapy do góry, szuflady z dorobioną skrzynką, uchwyty jadą razem z frontem (`src/components/kuchnia/ruchomeGlb.ts`).
- **Pełny ekran** (strona klienta, `src/components/PelnyEkran.tsx`): przycisk w prawym dolnym rogu – na komputerze nad paskiem materiałów, na telefonie w rogu sceny. Na pełnym ekranie jest tylko scena 3D (bez materiałów, ceny, przycisków) i „Zamknij” (albo Esc / wstecz); żeby zmienić materiał, klient wychodzi z pełnego ekranu. Komputer, Android i iPad: prawdziwy pełny ekran (Fullscreen API – znikają karty i pasek adresu). iPhone: Safari nie daje stronom pełnego ekranu (API działa tam tylko dla wideo), więc scena zakrywa całą stronę od krawędzi do krawędzi, a podpowiedź mówi, jak schować pasek Safari („Ukryj pasek narzędzi” w menu strony). Wcześniejszy poziomy podgląd z paskiem i materiałami jest usunięty.
- **Tło** sceny przełącza się na jasne, gdy fronty (albo cały wgrany model) są ciemne – grafit, dąb wędzony, czarny (`src/components/tloSceny.ts`).

## Dwie wysyłki

- **Podgląd 3D** — „Utwórz link 3D”, potem „Wyślij podgląd 3D”. To dotychczasowy mail albo SMS z adresem `/oferta/…`. Ważność, PIN i ukrycie ceny doprecyzujesz w panelu oferty.
- **Oferta PDF** — osobne przyciski „Pobierz PDF” i „Wyślij ofertę PDF”.
  - Pobranie otwiera okno drukowania przeglądarki. Trzeba wybrać **Zapisz jako PDF**. Nie ma renderu 3D na serwerze. Jeśli scena zdążyła się narysować, na pierwszej stronie jest jeden zrzut.
  - **Kod QR do kuchni w 3D** jest na pierwszej stronie PDF (pod danymi klienta), razem z adresem i datą ważności linku. Pobranie PDF z kreatora najpierw zapisuje ofertę (kod pokazuje tę samą kuchnię co plik), potem bierze obecny link, a gdy go nie ma albo wygasł — tworzy nowy na 14 dni. W panelu oferty nowy link dostaje ustawienia z sekcji „Link dla klienta” (ważność, PIN, cena). Link z PIN-em: PIN-u nie ma w PDF, klient dostaje go osobno. Bez klienta i nazwy oferta się nie zapisze — wtedy PDF wychodzi bez kodu. Kod rysuje biblioteka `qrcode-generator` w przeglądarce (SVG, bez zewnętrznej usługi).
  - Mail PDF ma pozycje, wymiary i kwoty netto (i link 3D, jeśli jest). Nie zastępuje maila z linkiem 3D — oba wychodzą osobno. Plik PDF dołącza się ręcznie (poczta nie przyjmie go z samego `mailto`).

PDF jest ofertą handlową: marka firmy, klient, układ, pozycje, wymiary, ceny netto, dopłaty materiałowe. Na dole jest wprost napisane, że to nie jest rozkrój.

## Dane

Na ofercie w KV dochodzi pole `kuchnia`: układ (`ciag` albo `L`), długości ścian, opcjonalne pomieszczenie i elementy (id, nazwa, źródło `modul` albo `model`, `rodzaj`, strefa, wymiary, pozycja, obrót). Strefy: `dolna`, `gorna`, `wysoka`, `blat`, `polka`. Starsze oferty bez `rodzaj` są szafką. Ceny w tym polu nie ma.

Przy każdym zapisie z panelem funkcja `zCenaKuchni` nadpisuje `base` i `moduly`. Publiczny `GET /api/public/:slug` liczy kwotę jeszcze raz z aktualnego cennika, więc zmiana cennika w ustawieniach widać u klienta bez ponownego zapisu oferty. Przy ukrytej cenie kwot nie ma, geometria zostaje.

**Po wdrożeniu tej wersji** istniejąca oferta publiczna, w której plan miał płytę, okap, zlewozmywak, baterię, lodówkę wolnostojącą albo mikrofalówkę, pokaże **niższą kwotę**. Cena liczy się na żywo, bez tych urządzeń. Zabudowy (szafka, słupek, zmywarka do zabudowy) zostają w cenie.

Element z własnym GLB (`zrodlo: "model"`) może mieć obrys od 1×1×1 do 400×280×400 cm, żeby zmieścił się blat 240 cm, cienka płyta i panel boczny. Szafka parametryczna ma dotychczasowe widełki, szafy i komody na wymiar – własne (np. szafa przesuwna do 400 cm, do 280 cm wysokości).

Lista `moduly` z panelu przy ofercie z kreatora jest pomijana przy walidacji – i tak liczy ją serwer z planu. Wcześniej szła przez limity szafki na wymiar (4–120 cm) i zapis z modelem szerszym niż 120 cm (komoda 141 cm, blat 240 cm) kończył się błędem „Moduł 1: wymiar w poza zakresem 4–120 cm”.

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

## Biblioteka szaf, szafek i komód

Druga paczka: `seed/modele-szafy-komody-100/` (100 GLB, `katalog.json`, `id-map.json`). Id: `ms` + numer `001`–`100` + id z katalogu bez podkreśleń (np. `ms001szafa2d100`). Nie pokrywa się z `mk01`–`mk50`. Wszystkie mają `uzycie: "modul"`.

W katalogu kreatora są trzy grupy: Szafy, Szafki, Komody. Strefa `wysoka` jest dla szaf i innych mebli od podłogi o wysokości od 145 cm (słupek nie nachodzi na szafkę górną). Wiszące, nadstawka i szafka z lustrem mają strefę `gorna`. Komody, RTV, szafki na buty i łazienkowe z umywalką są `dolne`. Szafa narożna ma rodzaj `narozna`, umywalka `zlew`, komoda z szufladami `szuflady`.

Sprawdzenie plików, bez sieci (ma wypisać 100/100; kuchnia osobno zostaje 50):

```
node seed/modele-szafy-komody-100/seed.mjs --check
node seed/modele-kuchnia-50/seed.mjs --check
```

Wgranie jest idempotentne i dotyczy tylko tych 100 id. Skrypt odmawia zapisu i kasowania, gdy id albo plik należy do mk01–mk50. **Nie uruchamiać na produkcji, dopóki nie ma zgody na deploy.**

```
node seed/modele-szafy-komody-100/seed.mjs --local
SEED_CONFIRM=kuchnia-modele node seed/modele-szafy-komody-100/seed.mjs --remote
```

Ten sam bucket R2 `kuchnia-modele` i KV firmy `main` co biblioteka kuchni. Klucze: `model:<id>` i `modelowner:<id>` → `main`. Plik: `models/<id>/<wersja>.glb`.

## Lokalnie

```
npm run build
npx -y wrangler@4 pages dev out --kv OFFERS --r2 MODELS
```

Potem zalogowana firma: `/panel/kreator`. Sam `next dev` nie ma API ofert; kreator wtedy trzyma szkic w przeglądarce i pokazuje „Dane demo”. Link klienta i tak wymaga API.
