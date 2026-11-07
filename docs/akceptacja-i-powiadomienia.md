# Akceptacja oferty, wersje i powiadomienia

## Akceptacja przez klienta

Na stronie z linku jest przycisk **„Akceptuję ofertę”**. Okno pokazuje wersję oferty (i co się zmieniło od poprzedniej), szacunek netto i materiały, które klient ma wybrane na dole strony. Klient wpisuje imię i nazwisko i zaznacza zgodę („to nie jest jeszcze umowa ani zamówienie – firma odezwie się w sprawie pomiaru i umowy”).

- `POST /api/public/:slug/akceptuj` – `{ imie, wersja, zgoda: true, wybor?, kwota? }`. Serwer przyjmuje tylko bieżącą wersję (starsza → 409 „oferta została właśnie zmieniona”), zapisuje `offer.akceptacja` (wersja, data, imię, kwota, wybór), status „Zaakceptowana”, zdarzenie w historii; limit 5 prób na godzinę.
- Po akceptacji klient widzi „Zaakceptowano 2 lis 2026, 22:30”. Gdy firma zmieni ofertę później, klient widzi „Akceptuję nową wersję” i informację, że oferta zmieniła się po jego akceptacji.

## Wersje oferty

`src/lib/wersje.ts`. Wersja to skrót tego, co widzi klient: cena netto, fronty, blat, okucia, kolory boków i środka, meble (wymiary, własne kolory, wnętrze), dodatki, płyta. Serwer dopisuje nową wersję przy zapisie (`functions/_lib/wersjeOferty.ts`), gdy oferta ma link dla klienta, a skrót różni się od ostatniej wersji – szkic bez linku wersji nie robi. Pamiętamy 20 ostatnich.

Panel → oferta → **„Wersje i akceptacja”**: kto i kiedy zaakceptował (i czy oferta zmieniła się później), lista wersji z różnicami („Cena netto: 5 551 zł → 6 071 zł”, „Dodano: Szafka dolna 40 (40×72×56 cm)”, „Zmieniono: … – 60×72×56 cm → 80×72×56 cm”). W historii aktywności: „Nowa wersja oferty: 2 (…)”.

Pola `wersje`, `akceptacja`, `przypomnienie` pisze tylko serwer – zapis z panelu ich nie nadpisuje.

## Powiadomienia e-mail

Wysyłka przez własny serwer poczty (`functions/_lib/notify.ts` → `mail-relay/` na VPS) – potrzebne `MAIL_API_URL`, `MAIL_API_KEY` (sekret) i `NOTIFY_FROM`; instrukcja w `docs/poczta.md`. Bez nich nic nie wychodzi, reszta działa.

Do firmy (właściciele konta; firma „main” – `NOTIFY_EMAIL`), z linkiem `/panel?oferta=<numer>`, który otwiera tę ofertę:

| Zdarzenie | Kiedy |
| --- | --- |
| Klient otworzył ofertę | pierwsze otwarcie linku |
| Oferta zaakceptowana | z imieniem, wersją, kwotą i wyborem klienta |
| Uwagi klienta | treść uwag |
| Klient zmienia kolory | 20 s po ostatniej zmianie w pasku materiałów; zdarzenie w historii najwyżej co 30 min, e-mail najwyżej co 6 h na link (`POST /api/public/:slug/wybor`) |

Do klienta – **przypomnienie 3 dni przed wygaśnięciem linku** (gdy w kontakcie jest e-mail, oferta nie jest zaakceptowana i link ma włączone „Przypomnij klientowi przed wygaśnięciem” – domyślnie tak). Pages Functions nie mają harmonogramu (crona), więc przypomnienia wysyła w tle lista ofert w panelu (`GET /api/offers`) – firma otwiera panel codziennie; znacznik w KV pilnuje, żeby mail poszedł raz. W panelu przy linku: stan przypomnienia, przełącznik „Auto” i przycisk **„Przypomnij klientowi teraz”** (`POST /api/offers/:id/przypomnij`, limit 3 na dobę).

**Ustawienia → Powiadomienia**: włączanie i wyłączanie każdego z pięciu (zapis `powiadomienia` w KV firmy, zmienia właściciel konta), adresy, na które idą maile, i informacja, czy poczta jest skonfigurowana.

Testy lokalne: `MAIL_API_URL` może wskazywać na atrapę API poczty.
