# Do poprawy później

Lista uwag z przeglądu sekcji promocyjnych strony głównej (commit da24887).
Strona poszła w obecnej wersji; poniższe rzeczy do zrobienia przed szerszą promocją.

## Teksty: funkcje, których jeszcze nie ma

Plik: `src/content/strona-glowna.ts`

- **Konta i zespoły** – „Szef dodaje sprzedawców i widzi oferty całego zespołu” (Dla kogo → Salony i sieci)
  oraz FAQ „Ile osób z firmy może korzystać z panelu?”. Panel ma dziś jeden wspólny token,
  bez kont użytkowników i zespołów.
- **Własne modele i katalog** – „Własne modele i katalog materiałów w ofercie dla klienta”
  (Dla kogo → Producenci). Dziś jest jeden model kuchni i stały katalog (`src/components/catalog.ts`).
- **Abonament i plany** – „Abonament miesięczny, bez umowy na lata” i „Plany dla jednego projektanta,
  studia i sieci salonów” (Cennik). Model cenowy nie jest jeszcze ustalony.

## Teksty: sformułowania na wyrost

- **Otwarcia** – „Panel pokazuje każde otwarcie linku – na komputerze i telefonie”: panel liczy
  otwarcia, ale nie rozróżnia urządzeń.
- **Historia uwag** – „widzisz je w panelu razem z historią”: zapisywane są tylko ostatnie uwagi
  (`offer.comment`), starsze zostają jako skróty (do 200 znaków) w historii zdarzeń.
- **Mail** – „Wiadomość z linkiem i podsumowaniem, gotowa do wysłania”: szablon maila istnieje
  (`src/lib/offerEmail.ts`, podgląd `/podglad-maila`), ale panel go sam nie wysyła.
- **Model kuchni** – „wybierz model kuchni” (krok 1): w panelu wybiera się układ (I / L / U / wyspa),
  model jest jeden.

## Dostępność

- **Kontrast** – opis nieaktywnego kroku w „Jak to działa” (`text-stone-600` na tle `#0c0b0a`)
  ma kontrast ok. 2,6:1, poniżej 4,5:1 (WCAG AA). Plik: `src/components/site/home/StepsShowcase.tsx`.
- **Autoodtwarzanie nagrań** – `MediaSlot` odtwarza wideo automatycznie (`autoPlay loop`) także przy
  `prefers-reduced-motion: reduce`. Przy reduced motion: bez autoplay albo z przyciskiem pauzy.
  Plik: `src/components/site/home/MediaSlot.tsx` (dotyczy, gdy w treści pojawią się nagrania).

## Scena 3D w hero

- **Pionowe pasy na frontach wyspy** – na zrzucie z prawdziwym GPU (D3D11) fronty wyspy w tle
  strony głównej mają pionowe pasy. Nie wynika to z commita da24887 (zmienia tylko pauzowanie
  renderu poza ekranem). Do sprawdzenia: `src/components/site/HeroScene.tsx` (materiały / cienie /
  z-fighting) albo model `public/models/kitchen-opt.glb`. Scena oferty (`/oferta/demo`) wygląda poprawnie.
