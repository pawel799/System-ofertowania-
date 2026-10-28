# Katalog materiałów firmy

Każda firma prowadzi własny katalog: płyty frontów i korpusów, blaty, obrzeża, uchwyty i okucia –
z nazwami, jakich używa u klienta (np. „Egger H1180 Dąb Halifax 18 mm”), kolorem do 3D i dopłatą.
Pozycje frontów, blatów i uchwytów od razu trafiają do kreatora, oferty, linku dla klienta, PDF,
widżetu na stronie i sceny 3D. To katalog do oferty handlowej i wizualizacji – **nie rozkrój** i nie
lista formatek.

## W panelu

**Ustawienia → Katalog materiałów**:

- lista pozycji z filtrem rodzaju, próbką koloru, dopłatą i stanem (aktywna / wyłączona),
- „Dodaj pozycję” / „Edytuj”: rodzaj, nazwa, producent, kolekcja, kolor (#rrggbb), wykończenie
  (mat, satyna, połysk, struktura), grubość w mm, kod RAL, dopłata w zł, jednostka (szt, m², mb),
  „Aktywna”, a dla uchwytów „Bez uchwytów (push-to-open, Gola)” – wtedy w 3D uchwyty znikają,
- „Wczytaj zestaw startowy”, gdy katalog jest pusty – kopia materiałów wbudowanych + przykładowa
  płyta korpusu i obrzeże, do przerobienia na własne,
- „Wyłącz” chowa pozycję z nowych ofert; „Usuń” (przytrzymaj) kasuje ją na stałe.

Gdy firma ma choć jedną aktywną pozycję danego rodzaju, kreator i formularz nowej oferty pokazują
**tylko jej pozycje** tego rodzaju (fronty dodatkowo z pakietami RAL). Pusty rodzaj = materiały
wbudowane, więc firma bez katalogu działa jak dotąd.

Role w ofercie: front ← „Płyta frontu”, blat ← „Blat”, okucia ← „Uchwyt / okucie widoczne”.
Korpus, obrzeże, zawiasy, prowadnice i nogi są w katalogu, ale v1 nie wstawia ich jeszcze do oferty.

## Limity planów

`limits.katalog` w `src/lib/plans.ts`: Start 30 pozycji, Pracownia 200, Producent bez limitu.
Przekroczenie → 403 `plan_limit` z opisem planu (jak modele i pakiety RAL).

## Snapshot w ofercie

Przy każdym zapisie oferty serwer zapisuje `offer.materialy` – nazwę, kolor, grubość i dopłatę
wybranego frontu, blatu i okuć w tej chwili. Strona klienta, PDF z panelu i cena czytają najpierw
snapshot, więc **zmiana dopłaty w katalogu nie zmienia ceny w wysłanych linkach**. Nowe wartości
wchodzą do oferty przy jej następnym zapisie.

## Blokady (409)

- Usunięcie pozycji, której używa jakakolwiek oferta → 409 `in_use` z listą ofert (`oferty`).
- Wyłączenie albo zmiana rodzaju pozycji używanej w ofercie → 409 `in_use`.
- Oferta i widżet mogą wskazać tylko istniejącą, aktywną pozycję właściwego rodzaju (400).
  Pozycja wyłączona przechodzi tylko w ofercie, która już ją miała.

## Technicznie

- KV firmy (przez `scoped()`): `catalog:<id>` → `KatalogPozycja` (JSON). Id w ofercie: `cat:<id>`.
- `GET/POST /api/katalog`, `GET/PUT/DELETE /api/katalog/:id` (`functions/api/katalog`),
  walidacja i snapshot w `functions/_lib/katalog.ts`.
- Wspólna logika (wyszukiwanie, opcje, dopłaty, zestaw startowy): `src/components/katalogFirmy.ts`;
  magazyn w przeglądarce: `src/components/katalogStore.ts`.
- `GET /api/public/:slug` i `GET /api/osadz/:firm` zwracają `katalog` – aktywne pozycje trzech ról
  i pozycje wybrane w ofercie; przy ukrytej cenie dopłaty są zerowane (także w snapshocie).
- Wygląd 3D: `lookFor()` w `src/components/modelRoles.ts` (kolor + wykończenie), kuchnia demo:
  `frontMaterials.ts`, `countertopMaterials.ts`, `hardwareMaterials.ts`.
