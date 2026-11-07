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
- „+” w połowie ściany, który ją dzieli;
- „Scal”, który usuwa narożnik;
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
- „Ukryj ściany” chowa ją razem ze ścianami.
