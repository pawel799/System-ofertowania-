# Ściany i sufit

Kreator → krok **Pomiar** → sekcja **Ściany i sufit**. Dane leżą w `plan.sciany` (`src/lib/sciany.ts`, walidacja `parseUstawieniaScian`).

## Ściany pokoju

- A, B, C i D jak dotąd. C i D są tylko przy podanych wymiarach pokoju.
- Ścianę B, C albo D można odznaczyć (otwarta przestrzeń). Lista usuniętych ścian jest w `bez`.
- A zostaje zawsze. B zostaje w układzie L.
- Ściany nie da się usunąć, gdy jest na niej okno, drzwi, gniazdko albo woda – najpierw trzeba je przenieść.
- `scianyPokoju()` pomija usunięte ściany. Dlatego otwory, gniazdka, granice mebli, 3D i rysunek widzą to samo.

## Dodatkowe ściany (`dodatkowe`)

Służą jako działowe, skosy, wnęki albo ścianki przy wyspie.

Każda ściana ma:
- środek `x`, `z` w cm;
- `dlugosc`;
- `kat` od 0 do 179° (0 = wzdłuż A, 90 = wzdłuż B);
- `grubosc`;
- opcjonalnie `wysokosc` (brak = do sufitu).

Limit: najwyżej 30 ścian.

Edycja:
- **Pola w kroku „Pomiar”:** długość, kąt, grubość, środek od ściany B i od A, wysokość. Przyciski ↺ 15°, ↻ 15° i 90°.
- **Rzut:** przeciągnięcie ściany ją przesuwa. Przeciągnięcie kółka na końcu obraca ją i zmienia długość wokół drugiego końca (co 15° i 5 cm, z Shift co 1° i 1 cm).
- **3D:** przeciągnięcie po podłodze przesuwa ścianę.

Zabezpieczenia:
- Ściana nie może wejść na meble (`sprawdzScianeDodatkowa`).
- Mebel nie może wejść w ścianę – sprawdza to `meblaWOtworze`, czyli rzut, strzałki i przeciąganie w 3D.
- Niższa ściana nie blokuje szafek wiszących nad nią.

Rysunek techniczny rysuje dodatkowe ściany jako mur z numerem i długością.

## Sufit (`sufit`)

- Płaszczyzna na wysokości pokoju, nad całym pokojem, domyślnie w kolorze `#f4f2ee`.
- Widać ją tylko od spodu. Z góry, w zwykłym widoku kreatora, znika jak ściany zwrócone tyłem.
- „Ukryj ściany” chowa też sufit i dodatkowe ściany.

Otwory (okna, drzwi) i gniazdka są na razie tylko na ścianach A–D.
