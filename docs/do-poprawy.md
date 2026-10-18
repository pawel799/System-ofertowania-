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

- **[zrobione]** **Kontrast** – opis nieaktywnego kroku w „Jak to działa” (`text-stone-600` na tle `#0c0b0a`)
  ma kontrast ok. 2,6:1, poniżej 4,5:1 (WCAG AA). Plik: `src/components/site/home/StepsShowcase.tsx`.
- **[zrobione]** **Autoodtwarzanie nagrań** – `MediaSlot` odtwarza wideo automatycznie (`autoPlay loop`) także przy
  `prefers-reduced-motion: reduce`. Przy reduced motion: bez autoplay albo z przyciskiem pauzy.
  Plik: `src/components/site/home/MediaSlot.tsx` (dotyczy, gdy w treści pojawią się nagrania).

## Scena 3D w hero

- **[zrobione]** **Pionowe pasy na frontach wyspy** – na zrzucie z prawdziwym GPU (D3D11) fronty wyspy w tle
  strony głównej mają pionowe pasy. Nie wynika to z commita da24887 (zmienia tylko pauzowanie
  renderu poza ekranem). Do sprawdzenia: `src/components/site/HeroScene.tsx` (materiały / cienie /
  z-fighting) albo model `public/models/kitchen-opt.glb`. Scena oferty (`/oferta/demo`) wygląda poprawnie.

## Otwarte po commitach e63ae13 i e6ea0de

### Teksty (`src/content/strona-glowna.ts`)

- **[zrobione]** **Obietnice kont** – kont użytkowników nie ma (rejestracja to wersja demo, panel ma jeden token):
  - FAQ: „Ile osób z firmy może korzystać z systemu? → Liczbę kont w każdym planie znajdziesz w cenniku.”
  - końcowe wezwanie: przycisk „Załóż konto firmy”,
  - Dla kogo → Salony: „Każdy sprzedawca wysyła oferty w tym samym, dopracowanym formacie…” (sugeruje wielu użytkowników).
- **Obietnica usługi** – „Modele i materiały przygotujemy pod Twoją ofertę” (Producenci) oraz FAQ
  „Skąd biorą się modele 3D kuchni?” (przygotowujemy razem z Tobą). Do potwierdzenia biznesowo.
- **[zrobione]** **Wysyłka** – „Wyślij link jednym kliknięciem” (krok 2): panel kopiuje wiadomość, sam jej nie wysyła.
- **Model kuchni** – nadal „Wybierasz model” (krok 1): w panelu wybiera się układ, model jest jeden.

### Media (`public/strona/`)

- **[zrobione]** **NIP na zrzucie** – `krok-1-nowa-oferta.webp` pokazuje NIP 123-456-32-18 (i KRS 0000123456).
  Dane są fikcyjne, ale NIP ma poprawną sumę kontrolną, więc może należeć do prawdziwej firmy.
  Zamazać albo podmienić na NIP z niepoprawną sumą kontrolną.
- **[zrobione]** **Nagranie bez pauzy** – `LoopVideo` (13 s w pętli) nie ma przycisku pauzy; WCAG 2.2.2 wymaga
  możliwości zatrzymania ruchu dłuższego niż 5 s. Plik: `src/components/site/home/LoopVideo.tsx`.
- **[zrobione]** **Kolejność źródeł** – `oferta-3d.webm` (754 KB) dać przed `oferta-3d.mp4` (1,2 MB).
- **[zrobione]** **Zmiana „ograniczonego ruchu”** – `LoopVideo` sprawdza `prefers-reduced-motion` tylko przy
  starcie; zmiana ustawienia w trakcie wizyty nie jest śledzona.

### Nadal otwarte z poprzedniej listy

- [zrobione] Kontrast w krokach „Jak to działa” (teraz ok. 5,3:1).
- „Wybierasz model” (patrz wyżej).
- [zrobione] Pionowe pasy na frontach wyspy w scenie hero.

## Po porządkach przed pokazem (październik 2026)

Zrobione: stopka/kontakt/cennik/logowanie/o nas bez lorem ipsum i zmyślonych danych (dane firmy w
`src/content/firma.ts`, puste pola się nie wyświetlają), formularz wyceny i pomiaru na stronie oferty
(`/api/zapytania`, KV), dopłaty za fronty i okucia, uchwyty w modelu, ciemniejszy granit, widok oferty
na telefonie, tło hero z kadrem zastępczym, ciemne tło body (białe prześwity przy przewijaniu), panel bez
mignięcia „Wczytywanie ofert…”.

Otwarte:

- **Dane firmy** – uzupełnić `src/content/firma.ts` (nazwa prawna, NIP, adres, e-mail, telefon).
- **[zrobione]** **Zgłoszenia z formularzy** – zapisują się w KV (`zapytanie:*`, 180 dni) i są dostępne przez
  `GET /api/zapytania` z kodem panelu, ale panel nie ma jeszcze widoku ani powiadomienia e-mail.
- **[zrobione]** **Regulamin i polityka prywatności** – treść paragrafów „w przygotowaniu”.
- **THREE.Clock** – ostrzeżenie w konsoli pochodzi z @react-three/fiber 8 (wewnętrzny zegar);
  nasz kod używa już THREE.Timer. Zniknie po przejściu na R3F 9 (wymaga React 19).
- **Uchwyty** – w modelu są tylko listwy (profil pod blatem), wydzielane automatycznie z materiału
  „Chrome” (`hardwareMaterials.ts`); zmiana jest widoczna, ale subtelna. Lepiej rozdzielić je w pliku modelu.

## Pakiet przed pokazem inwestorskim (18.10.2026) – zrobione

- Zgłoszenia: widok `/panel/zgloszenia` (obsłużone / usuń) + powiadomienie e-mail przez Resend
  (`RESEND_API_KEY`, `NOTIFY_EMAIL`, `NOTIFY_FROM`) – instrukcja w `docs/zgloszenia.md`. Obietnica na /kontakt bez „1 dnia roboczego”.
- Rejestracja, logowanie i reset hasła usunięte (przekierowania w `_redirects`); jedno wejście „Wejdź do panelu” (kod dostępu), CTA „Umów prezentację”. Przycisk „Wyloguj”.
- Regulamin i polityka prywatności – projekt treści w `src/content/prawne.ts` (dane z `firma.ts`, neutralne sformułowania przy pustych polach). Klauzula RODO pod formularzem kontaktowym i formularzem oferty. **Przed publikacją do przejrzenia przez prawnika.**
- Nazwa i logo firmy w Ustawieniach → Firma (KV `settings:brand`, logo ≤ 200 KB): strona oferty, mail i podgląd, nagłówek panelu. Fallback: `FIRMA.nazwaHandlowa`.
- Pusty panel z linkiem do Ustawień; cennik tylko z istniejącymi funkcjami; polska strona 404.
- Mail: „Umów pomiar” → `#pomiar`, data w podglądzie liczona na bieżąco.
- Wiadomość do klienta osobno dla e-maila, SMS-a i Messengera; przyciski „Wyślij e-mailem” (mailto:), „Wyślij SMS-em” (sms:), „Kopiuj i otwórz Messengera”; PIN w osobnej wiadomości z własnym przyciskiem kopiowania.
- Formularze czyszczą błąd pola przy zmianie; hero z nagłówkiem i podtytułem; menu sekcji na telefonie; pauza nagrania (z obsługą ograniczonego ruchu).
- Hero 3D: te same fronty co w ofercie – pasy na wyspie znikły (w modelu lamele przenikają korpus); nowy `hero-poster.webp`.
- Zrzut kroku 1: rozmyty NIP, REGON i KRS.
- Uchwyty: w miejscu cienkich listew grubsze pręty (min. 1,6 × 2,4 cm) dla mosiądzu i czarnego matu; push-to-open bez uchwytów.

### Nadal otwarte
- Dane firmy w `src/content/firma.ts` (nazwa prawna, NIP, adres, e-mail, telefon) – od nich zależą stopka, /kontakt, regulamin i polityka.
- Konfiguracja Resend w Cloudflare (patrz `docs/zgloszenia.md`).
- Czarny mat na czarnym granicie jest mało widoczny – to kwestia kontrastu kolorów, nie geometrii.
- Messenger nie ma oficjalnego linku „wyślij z treścią” bez aplikacji Facebooka – dlatego kopiujemy treść i otwieramy messenger.com.
