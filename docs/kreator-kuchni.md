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
   - **moduły parametryczne** (szafka dolna, górna, słupek — ta sama bryła co na `/oferta/modul`),
   - **modele 3D firmy** wgrane w Ustawienia → Modele 3D. Bryła jest skalowana do podanych wymiarów. Gdy firma nie ma własnych plików, zostają presety szafek.
3. Na rzucie przeciągasz szafkę (albo strzałkami, co 5 cm) i obracasz o 90°. Gruba kreska to front. Szafka górna może stać nad dolną. Słupek nie może nachodzić na żadną inną szafkę.
4. Kolor frontów: próbki z katalogu albo pakiet RAL firmy, jeśli jest w ustawieniach. Jeden kolor na całą kuchnię, tak jak w dotychczasowej ofercie.
5. **Zapisz ofertę.** Serwer (nie przeglądarka) wpisuje cenę: `base` i lista modułów biorą się z wymiarów i cennika firmy (Ustawienia → Cennik modułów). Wzór jest ten sam co przy szafkach na wymiar. Dopłaty za front, blat i okucia dolicza strona klienta tak jak dotychczas.

„Wstaw przykład” kładzie typowy ciąg albo L, żeby nie zaczynać od pustego rzutu.

## Dwie wysyłki

- **Podgląd 3D** — „Utwórz link 3D”, potem „Wyślij podgląd 3D”. To dotychczasowy mail albo SMS z adresem `/oferta/…`. Ważność, PIN i ukrycie ceny doprecyzujesz w panelu oferty.
- **Oferta PDF** — osobne przyciski „Pobierz PDF” i „Wyślij ofertę PDF”.
  - Pobranie otwiera okno drukowania przeglądarki. Trzeba wybrać **Zapisz jako PDF**. Nie ma renderu 3D na serwerze. Jeśli scena zdążyła się narysować, na pierwszej stronie jest jeden zrzut.
  - Mail PDF ma pozycje, wymiary i kwoty netto. Nie zastępuje maila z linkiem 3D — oba wychodzą osobno. Plik PDF dołącza się ręcznie (poczta nie przyjmie go z samego `mailto`).

PDF jest ofertą handlową: marka firmy, klient, układ, pozycje, wymiary, ceny netto, dopłaty materiałowe. Na dole jest wprost napisane, że to nie jest rozkrój.

## Dane

Na ofercie w KV dochodzi pole `kuchnia`: układ (`ciag` albo `L`), długości ścian, opcjonalne pomieszczenie i elementy (id, nazwa, źródło `modul` albo `model`, wymiary, pozycja, obrót). Ceny w tym polu nie ma.

Przy każdym zapisie z panelem funkcja `zCenaKuchni` nadpisuje `base` i `moduly`. Publiczny `GET /api/public/:slug` liczy kwotę jeszcze raz z aktualnego cennika, więc zmiana cennika w ustawieniach widać u klienta bez ponownego zapisu oferty. Przy ukrytej cenie kwot nie ma, geometria zostaje.

Model użyty w kreatorze nie da się usunąć, dopóki jest w jakiejś ofercie (tak samo jak model całej kuchni). Link publiczny nie zwraca katalogu firmy — tylko modele wstawione w tę kuchnię.

## Lokalnie

```
npm run build
npx -y wrangler@4 pages dev out --kv OFFERS --r2 MODELS
```

Potem zalogowana firma: `/panel/kreator`. Sam `next dev` nie ma API ofert; kreator wtedy trzyma szkic w przeglądarce i pokazuje „Dane demo”. Link klienta i tak wymaga API.
