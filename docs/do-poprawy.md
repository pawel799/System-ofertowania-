# Do poprawy później

Lista uwag z przeglądu sekcji promocyjnych strony głównej (commit da24887).
Strona poszła w obecnej wersji; poniższe rzeczy do zrobienia przed szerszą promocją.
Pozycje oznaczone **[zrobione]** poprawiły commity e63ae13 i e6ea0de (teksty pod sprzedaż, zrzuty i nagranie).

## Teksty: funkcje, których jeszcze nie ma

Plik: `src/content/strona-glowna.ts`

- **[zrobione]** **Konta i zespoły** – „Szef dodaje sprzedawców i widzi oferty całego zespołu” (Dla kogo → Salony i sieci)
  oraz FAQ „Ile osób z firmy może korzystać z panelu?”. Panel ma dziś jeden wspólny token,
  bez kont użytkowników i zespołów.
- **[zrobione]** **Własne modele i katalog** – „Własne modele i katalog materiałów w ofercie dla klienta”
  (Dla kogo → Producenci). Dziś jest jeden model kuchni i stały katalog (`src/components/catalog.ts`).
- **[zrobione]** **Abonament i plany** – „Abonament miesięczny, bez umowy na lata” i „Plany dla jednego projektanta,
  studia i sieci salonów” (Cennik). Model cenowy nie jest jeszcze ustalony.

## Teksty: sformułowania na wyrost

- **[zrobione]** **Otwarcia** – „Panel pokazuje każde otwarcie linku – na komputerze i telefonie”: panel liczy
  otwarcia, ale nie rozróżnia urządzeń.
- **[zrobione]** **Historia uwag** – „widzisz je w panelu razem z historią”: zapisywane są tylko ostatnie uwagi
  (`offer.comment`), starsze zostają jako skróty (do 200 znaków) w historii zdarzeń.
- **[częściowo]** **Mail** – (teraz „System przygotowuje maila… Wystarczy go wysłać” – panel ma „Kopiuj wiadomość”, to w porządku) „Wiadomość z linkiem i podsumowaniem, gotowa do wysłania”: szablon maila istnieje
  (`src/lib/offerEmail.ts`, podgląd `/podglad-maila`), ale panel go sam nie wysyła.
- **Model kuchni** – „wybierz model kuchni” (krok 1): w panelu wybiera się układ (I / L / U / wyspa),
  model jest jeden.

## Dostępność

- **Kontrast** – opis nieaktywnego kroku w „Jak to działa” (`text-stone-600` na tle `#0c0b0a`)
  ma kontrast ok. 2,6:1, poniżej 4,5:1 (WCAG AA). Plik: `src/components/site/home/StepsShowcase.tsx`.
- **[zrobione]** **Autoodtwarzanie nagrań** – `MediaSlot` odtwarza wideo automatycznie (`autoPlay loop`) także przy
  `prefers-reduced-motion: reduce`. Przy reduced motion: bez autoplay albo z przyciskiem pauzy.
  Plik: `src/components/site/home/MediaSlot.tsx` (dotyczy, gdy w treści pojawią się nagrania).

## Scena 3D w hero

- **Pionowe pasy na frontach wyspy** – na zrzucie z prawdziwym GPU (D3D11) fronty wyspy w tle
  strony głównej mają pionowe pasy. Nie wynika to z commita da24887 (zmienia tylko pauzowanie
  renderu poza ekranem). Do sprawdzenia: `src/components/site/HeroScene.tsx` (materiały / cienie /
  z-fighting) albo model `public/models/kitchen-opt.glb`. Scena oferty (`/oferta/demo`) wygląda poprawnie.

## Otwarte po commitach e63ae13 i e6ea0de

### Teksty (`src/content/strona-glowna.ts`)

- **Obietnice kont** – kont użytkowników nie ma (rejestracja to wersja demo, panel ma jeden token):
  - FAQ: „Ile osób z firmy może korzystać z systemu? → Liczbę kont w każdym planie znajdziesz w cenniku.”
  - końcowe wezwanie: przycisk „Załóż konto firmy”,
  - Dla kogo → Salony: „Każdy sprzedawca wysyła oferty w tym samym, dopracowanym formacie…” (sugeruje wielu użytkowników).
- **Obietnica usługi** – „Modele i materiały przygotujemy pod Twoją ofertę” (Producenci) oraz FAQ
  „Skąd biorą się modele 3D kuchni?” (przygotowujemy razem z Tobą). Do potwierdzenia biznesowo.
- **Cennik** – „Ceny netto, płatność miesięczna” (sekcja Cennik): sprawdzić zgodność z `/cennik`.
- **Wysyłka** – „Wyślij link jednym kliknięciem” (krok 2): panel kopiuje wiadomość, sam jej nie wysyła.
- **Model kuchni** – nadal „Wybierasz model” (krok 1): w panelu wybiera się układ, model jest jeden.

### Media (`public/strona/`)

- **NIP na zrzucie** – `krok-1-nowa-oferta.webp` pokazuje NIP 123-456-32-18 (i KRS 0000123456).
  Dane są fikcyjne, ale NIP ma poprawną sumę kontrolną, więc może należeć do prawdziwej firmy.
  Zamazać albo podmienić na NIP z niepoprawną sumą kontrolną.
- **Nagranie bez pauzy** – `LoopVideo` (13 s w pętli) nie ma przycisku pauzy; WCAG 2.2.2 wymaga
  możliwości zatrzymania ruchu dłuższego niż 5 s. Plik: `src/components/site/home/LoopVideo.tsx`.
- **Kolejność źródeł** – `oferta-3d.webm` (754 KB) dać przed `oferta-3d.mp4` (1,2 MB).
- **Zmiana „ograniczonego ruchu”** – `LoopVideo` sprawdza `prefers-reduced-motion` tylko przy
  starcie; zmiana ustawienia w trakcie wizyty nie jest śledzona.

### Stopka

- **Dane firmy** – w stopce (`src/components/site/SiteFooter.tsx`) nadal jest zastępczy wpis
  „Lorem ipsum sp. z o.o. · NIP 000-000-00-00 · ul. Lorem 1, 00-000 Warszawa”. Wpisać prawdziwe dane firmy.

### Nadal otwarte z poprzedniej listy

- Kontrast `text-stone-600` w krokach „Jak to działa” (ok. 2,6:1).
- „Wybierasz model” (patrz wyżej).
- Pionowe pasy na frontach wyspy w scenie hero.
