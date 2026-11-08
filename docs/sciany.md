# Ściany, kształt pokoju, kolory i sufit

Dane leżą w `plan.sciany`. Logika jest w `src/lib/sciany.ts` (ściany, walidacja `parseUstawieniaScian`) i `src/lib/ksztaltPokoju.ts` (zmiany kształtu). Ściany i sufit są tylko do wizualizacji. Do formatek, okuć ani ceny nie wchodzą.

## Kształt pokoju

W kroku **Pomiar** pierwsze pytanie brzmi: „Ściany pomieszczenia: Standardowe – 4 ściany / Inny kształt”.

### Standardowe

Prostokąt jak dotąd: wymiary pokoju, ściany A, B, C (naprzeciw A) i D (naprzeciw B).

### Inny kształt

Otwiera się okno **Kreator ścian**. Pokój to wielokąt `obrys` z 3–16 narożnikami, ściany mają litery A–P.

Zasady obrysu:
- v0 = (0, 0) to narożnik zabudowy i stoi w miejscu;
- v1 leży na osi x;
- wszystkie punkty mają x, z ≥ 0;
- litery: A = v0→v1, B = v0→v(n−1), C = v(n−1)→v(n−2) i dalej dookoła pokoju;
- dla prostokąta litery A–D wychodzą takie jak w trybie standardowym.

Każda ściana ma okna, drzwi i gniazdka. Wybór ściany przy oknie ma przyciski przy 2–4 ścianach i listę przy większej liczbie.

Kreator ścian zawiera:
- gotowe kształty: prostokąt, L, ścięty narożnik, wnęka, T;
- rzut z narożnikami do przeciągania (co 5 cm, z Shift co 1 cm, przyciąganie do pionu i poziomu sąsiadów);
- chwycenie ściany przesuwa ją prostopadle – sąsiednie ściany się wydłużają albo skracają (`przesunScianeObrysu`);
  ściana A albo B przesuwa resztę pokoju (narożnik zabudowy stoi);
- „+” w połowie ściany, który ją dzieli;
- „Usuń” przy ścianie (albo kliknięcie ściany na rzucie i Delete) – usuwa ścianę (`usunSciane`): sąsiednie ściany wydłużają się do przecięcia (ścięty narożnik wraca do prostego), a gdy się nie da – ściana scala się z sąsiednią; ściany A (i B w układzie L) nie usuwa się, pokój ma min. 3 ściany;
- Ctrl+Z / Ctrl+Shift+Z cofa i ponawia zmiany (historia całego planu w kreatorze);
- długość ściany z pola;
- „jest” – odznaczenie robi otwartą przestrzeń;
- kolor ściany;
- wysokość, sufit i ścianki działowe;
- podgląd 3D z kolorowaniem ścian kliknięciem.

Przeniesienia okien, drzwi, gniazdek i wody:
- Zmiana geometrii (narożnik, długość) zostawia litery – elementy jadą ze swoją ścianą i muszą się na niej zmieścić.
- Zmiana układu (podział, scalenie, gotowy kształt, przejście prostokąt ↔ obrys) przenosi je po położeniu w pokoju na ścianę, na której teraz leżą (`przeniesNaSciany`).
- Usunięte ściany i kolory przechodzą tak samo.
- Gdy coś nie ma gdzie zostać, zmiana nie przechodzi i pojawia się komunikat.

Synchronizacja z resztą planu:
- `pomieszczenie` to prostokąt opisany na obrysie;
- `scianaA` = długość ściany A;
- `scianaB` = długość ściany B, gdy biegnie wzdłuż osi z.

Meble:
- „przy ścianie” i granice pokoju (`meblaPrzyScianie`, `wGranicachPokoju`) liczą się geometrycznie, dla ścian pod dowolnym kątem.

## Lewy panel kreatora

Pod przełącznikiem „Ściana A / Ściana B” jest blok **Ściany**:
- opis kształtu;
- przycisk „Kreator ścian”;
- sufit;
- ścianki działowe (dodawanie, obrót, kolor, usuwanie).

## Kolory

- **„Kolor ścian”** nad sceną to kolor domyślny wszystkich ścian. Klient może go zmienić u siebie.
- **Kolor pojedynczej ściany** (`koloryScian`): kliknięcie ściany w 3D w kreatorze otwiera okienko z kolorami w lewym dolnym rogu sceny. W kreatorze ścian kolor ustawia przycisk „Kolor” przy ścianie albo kliknięcie ściany na rzucie. „Jak reszta” usuwa własny kolor.
- **Ścianka działowa** ma własny `kolor` (kliknięcie w 3D albo pole koloru na karcie).

## Ścianki działowe (`dodatkowe`)

Każda ścianka ma:
- środek `x`, `z`;
- `dlugosc`;
- `kat` od 0 do 179°;
- `grubosc`;
- opcjonalnie `wysokosc` i `kolor`.

Edycja:
- pola w kreatorze ścian;
- na rzucie: przeciąganie przesuwa, kółko na końcu obraca i zmienia długość;
- w 3D: przeciąganie po podłodze.

Zabezpieczenia:
- ścianka nie wchodzi na meble;
- mebel nie wchodzi w ściankę;
- niższa ścianka nie blokuje szafek wiszących nad nią.

## Sufit (`sufit`)

- Płaszczyzna w kształcie pokoju (prostokąt albo wielokąt) na wysokości pokoju.
- Widać ją tylko od spodu.
- Od góry: płyta stropowa z teksturą betonu (generowana w przeglądarce, łączenia co 1 m), leży na ścianach razem z grubością murów.
- „Ukryj ściany” chowa ją razem ze ścianami.

## Skróty klawiszowe w kreatorze

Historia planu: `src/components/panel/useHistoria.ts`. Lista skrótów: okno „?” w kreatorze (`SKROTY` w `KreatorApp.tsx`).

- Ctrl+Z – cofnij, Ctrl+Shift+Z / Ctrl+Y – ponów (też w kreatorze ścian; w polach tekstowych działa zwykłe cofanie tekstu);
- Ctrl+S – zapisz ofertę;
- Delete / Backspace – usuń zaznaczony mebel (w kreatorze ścian – wybraną ścianę);
- Ctrl+D – duplikuj, R – obróć o 90°, strzałki – przesuń o 5 cm (Shift: 1 cm), Enter – wymiary i wnętrze, Esc – odznacz.

## Telefon

Do 767 px szerokości (`src/components/panel/telefon.ts`) panel jest tylko podglądem ofert: bez nowej oferty, kreatora, rozkroju,
zmian materiałów i szafek oraz usuwania oferty. `/panel/kreator` na telefonie pokazuje tylko informację i odsyła do ofert.

## Ściany pokoju edytowane jak ścianki działowe

Domyślne ściany pokoju (A, B, C, D… – także sama ściana A bez wymiarów pokoju) mają w lewym panelu kreatora kartę jak ścianka działowa
(`ScianyPokoju` w `KreatorScian.tsx`): litery do wyboru albo klik w ścianę na rzucie.

- kolor, długość (`zmianaDlugosci`), grubość (`grubosci`, domyślnie 12 cm, na zewnątrz od wewnętrznej strony), wysokość (`wysokosci`, niższa niż sufit);
- obrót ±15° (`obrotSciany`) – poza A i B, na których stoi zabudowa;
- usuwanie – poza A (i B w L); w prostokącie ściana znika (otwarta przestrzeń), w innym kształcie sąsiednie ściany się łączą;
- na rzucie zaznaczona ściana ma uchwyty (`uchwytyScianyPokoju`): kółko na końcu – długość / narożnik, kwadrat w połowie – przesunięcie ściany.
  Zmiany idą przez `zastosujZmianePokoju` (okna, drzwi i gniazdka muszą się zmieścić).

Grubość widać na rzucie (mur ze skosem w narożnikach, `muryPokoju`) i w 3D jako wierzch muru; sama ściana w 3D zostaje płaszczyzną,
żeby nie zasłaniać wnętrza.

## Łączenie ścian

Przeciągany koniec ścianki działowej przyciąga się (18 cm) do końców innych ścianek, narożników pokoju, a potem do linii ścian
(połączenie w „T”) – `przyciagnijKoniec`, `ruchScianki`. Alt wyłącza przyciąganie. Ścianki połączone końcami ruszają się razem
(przesunięcie albo przeciągnięcie wspólnego narożnika ciągnie drugą ściankę), a narożnik jest domknięty (`scianaZPolaczeniami`).
Działa na rzucie i przy przeciąganiu w 3D.

## Podłoga

Podłoga w 3D i kadr rzutu obejmują wszystkie ściany (kształt pokoju, grubość, ścianki działowe także poza pokojem) – `zasiegScian`.

## Wgrywanie modeli 3D – sprawdzenie i wymiary

Ustawienia → Modele 3D (`SettingsApp.tsx`, logika `modelOptimize.ts`). Po wybraniu pliku `analizujModel()`:
- błędy (blokują, chyba że „Wgraj mimo błędów”): brak bryły, błędne współrzędne (NaN), zerowy rozmiar;
- uwagi: zdegenerowane trójkąty, zdublowane płaszczyzny (migotanie), krawędzie łączące > 2 płaszczyzny (non-manifold),
  brak normalnych, bardzo dużo trójkątów; informacje: otwarte krawędzie, linie/punkty, model nie stoi na podłodze;
- wymiary z pliku w cm; jednostki zgadywane (≤ 12 → m, ≤ 1200 → cm, więcej → mm), do zmiany; wymiary do wpisania, z proporcjami albo bez.

`przygotujModel()` usuwa złe trójkąty, liczy brakujące normalne, zapisuje skalę w pliku (model w metrach, środek podstawy w 0, 0, 0)
i optymalizuje. Wymiary idą na serwer (`X-Model-Wymiary`, `ModelMeta.wymiary`); w kreatorze model firmy wstawia się w tych wymiarach.
Plik z kompresją Draco nie da się sprawdzić – wymiary wpisuje się ręcznie.

## Kreator – pełny ekran (kiosk)

Przycisk „Pełny ekran” (albo klawisz F, albo `?kiosk=1` w adresie): scena (rzut i 3D) i kroki na całym ekranie, bez nawigacji panelu.
Na pasku: katalog (wysuwany), wymiary, kreator ścian, cofnij/ponów, zapis, wyjście. Esc wychodzi z pełnego ekranu.

Osobno: sam edytor (rzut) albo sam podgląd 3D na pełnym ekranie – przycisk „Pełny ekran” pod rzutem i w narzędziach 3D.
Pasek: cofnij/ponów, wymiary, przełączenie na drugi widok, wyjście (Esc); przy rzucie także wysuwany katalog i kreator ścian.

## Katalog i wyszukiwarka

Kategorie katalogu to listy rozwijane (stan zapamiętany w przeglądarce, przy szukaniu otwarte są te z wynikami).
Wyszukiwarka (`src/lib/szukaj.ts`) toleruje brak polskich znaków i błędy (gurne = górne, rz/ż, ch/h), literówki,
odmianę (szafka = szafki = szafek) i słowa pokrewne (lodówka = chłodziarka, okap = wyciąg, piekarnik = piec).
Gdy nic nie pasuje, pokazuje „Może chodziło o…”.

## Wygląd pokoju w 3D

Tekstury rysowane w przeglądarce (`src/components/kuchnia/teksturyPokoju.ts`, bez plików do pobrania), UV w metrach:
- ściany pokoju to pełne mury: tynk po obu stronach (mnoży kolor ściany), wierzch, ościeża okien i drzwi, wolne końce,
  listwa przypodłogowa przerwana w drzwiach;
- przycinanie (jak w grach o budowaniu domu): ściana, za którą stoi kamera, obniża się do cokołu 32 cm – wnętrze widać,
  a ściana dalej ma bryłę i tynk; przycisk „Pełne ściany” / „Przycinaj ściany” nad sceną (scianyStore `przyciete`);
- podłoga pokoju (`sciany.podloga`): panele (deski 20 × 120 cm) albo płytki 60 × 60 cm, kolor z gotowych odcieni albo własny
  – wybór w lewym panelu kreatora i w kreatorze ścian; zapisuje się w ofercie, klient widzi tę samą podłogę;
- krawędź podłogi bez ściany (pokój bez wymiarów, otwarta przestrzeń) łagodnie przechodzi w tło;
- wokół pokoju podłoże w kolorze tła (bez linii horyzontu) z samymi cieniami;
- wierzch sufitu: jednolita płyta stropowa (bez fug), spód sufitu – tynk w kolorze sufitu.

## Meble nie stoją za ścianami

`mebelZaSciana(plan, rect)` (`src/lib/sciany.ts`):
- żadna ściana pokoju nie może przecinać mebla (mebel dosunięty do ściany – w porządku, luz 1 cm);
- pokój zamknięty (obrys albo prostokąt z wymiarami, bez otwartych ścian) – środek mebla w środku pokoju,
  więc mebel nie stanie też w „wyciętym” narożniku pokoju w kształcie L;
- pokój otwarty (sama ściana A / A i B, ściana usunięta jako otwarta przestrzeń) – mebel nie stoi za żadną ścianą na jej długości.

Pilnowane w dwóch miejscach:
- **przeciąganie** (rzut i 3D, `wPokoju` w `src/lib/kuchnia.ts`): mebel ślizga się po ścianie, a gdy nie da się – zostaje
  w ostatnim dobrym miejscu; strzałki zatrzymują się na ścianie;
- **strażnik planu** (`useHistoria` z `walidacja` w `KreatorApp.tsx`): każda zmiana – obrót, wymiary, katalog, przykład,
  przesunięcie lub usunięcie ściany, kształt pokoju – która postawiłaby mebel za ścianą, jest odrzucana z komunikatem.
  Mebel, który stał za ścianą już wcześniej (stary projekt) i się nie zmienia, nie blokuje innych zmian.
