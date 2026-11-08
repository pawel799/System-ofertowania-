# Zgodność z prawem – co jest w serwisie i co musicie zrobić sami

Treść dokumentów: `src/content/prawne.ts`. Strony: `/regulamin`, `/umowa-powierzenia` (Załącznik nr 1),
`/polityka-prywatnosci`, `/polityka-cookies`. Linki w stopce strony i na stronie oferty u klienta.
**To projekt przygotowany starannie, ale przed startem sprzedaży powinien go przejrzeć prawnik.**

## Co jest zrobione w kodzie

| Wymóg | Podstawa | Gdzie |
| --- | --- | --- |
| Regulamin świadczenia usług (rodzaje usług, wymagania techniczne, zagrożenia, zawarcie i rozwiązanie umowy, reklamacje) | ustawa o świadczeniu usług drogą elektroniczną, art. 8 | `/regulamin` |
| Umowa powierzenia – OP RZUT przetwarza dane klientów firm w ich imieniu | RODO art. 28 | `/umowa-powierzenia`, akceptacja przy rejestracji |
| Dowód akceptacji: wersja dokumentów, data, e-mail | RODO art. 7 / rozliczalność | `firm.akceptacja` (`WERSJA_DOKUMENTOW`) |
| Polityka prywatności: role (administrator / podmiot przetwarzający), cele, podstawy, okresy, odbiorcy, transfer poza EOG, prawa | RODO art. 13–14 | `/polityka-prywatnosci` |
| Klauzule informacyjne przy formularzach | RODO art. 13 | `/kontakt`, formularz na ofercie (administratorem jest firma) |
| Polityka cookies z listą wszystkich plików (niezbędne i za zgodą) | Prawo komunikacji elektronicznej, art. 399 | `/polityka-cookies` |
| Baner zgód: „Akceptuj wszystkie” / „Odrzuć wszystkie” na pierwszym ekranie (równorzędne), „Ustawienia” z kategoriami | art. 399 ust. 1 PKE, RODO art. 7, wytyczne EDPB 03/2022 | `src/components/ZgodyCookies.tsx` |
| Google Consent Mode v2: `consent default` = denied w `<head>` przed tagami, `consent update` po decyzji | wymogi Google dla EOG (od marca 2024) | `src/lib/zgodySkrypt.ts`, `src/lib/zgody.ts` |
| Zmiana i wycofanie zgody w każdej chwili („Ustawienia cookies” w stopce i w polityce) | RODO art. 7 ust. 3 | stopka, `/polityka-cookies` |
| Rejestr zgód bez danych osobowych (losowe id, wersja, kategorie, data; 3 lata) | RODO art. 7 ust. 1 | `functions/api/zgody.ts` (KV: `zgoda:*`) |
| Punkt kontaktowy i zgłaszanie nielegalnych treści, uzasadnienie decyzji | Akt o usługach cyfrowych (DSA), art. 11, 12, 16, 17 | `/regulamin` § 8 |
| Ceny netto z informacją o VAT (usługa dla firm) | | `/cennik` |
| Bez zewnętrznych zasobów przekazujących IP: dekoder Draco z `/draco/` (wcześniej Google gstatic), czcionka wbudowana przy budowaniu | RODO (minimalizacja, transfer) | `src/lib/draco.ts`, `public/_headers` |

## Google Analytics / Google Ads – jak włączyć

Identyfikatory podaje się przy budowaniu (zmienne środowiskowe, wbudowywane w eksport statyczny):

```bash
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX npm run build        # GA4 przez gtag.js
NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX npm run build        # albo Google Tag Manager
```

- Bez identyfikatora baner i Consent Mode działają, ale żaden tag się nie ładuje.
- Tryb „basic”: tagi ładują się **dopiero po zgodzie** na analityczne lub marketingowe – bez zgody przeglądarka
  nie łączy się z Google (tryb „advanced” z pingami bez zgody jest w UE ryzykowny – nie włączamy go).
- W GTM: tagi GA4/Ads z wbudowanym sprawdzaniem zgody (Consent Overview) – sygnały przychodzą z `dataLayer`.
- Bez tagów i banera: linki ofert firm (`/oferta/<link>` – klienci firm, których administratorem jest firma)
  i kuchnia osadzana u firm (`/osadz`). Tylko `/oferta/demo` i `/oferta/modul` są naszymi stronami.
- Nowe narzędzie (np. Meta Pixel, Hotjar): dopisać do kategorii w `ZgodyCookies.tsx`, ładować w `zaladujTagi()`
  dopiero po zgodzie, dopisać pliki do tabeli w polityce cookies, dodać domeny do CSP w `public/_headers`
  i podnieść `WERSJA_ZGOD` w `src/lib/zgodyStale.ts` (wszyscy zostaną zapytani ponownie).
- Google Ads w EOG wymaga przekazywania sygnałów Consent Mode v2 – to jest zrobione. Certyfikowany CMP Google
  jest wymagany tylko dla wydawców wyświetlających reklamy (AdSense, Ad Manager) – tego nie robimy.

## Co musicie zrobić sami (bez tego nie startujcie)

1. **Uzupełnić `src/content/firma.ts`**: pełna nazwa prawna, adres, NIP (REGON, KRS), e-mail, telefon.
   Ustawa o świadczeniu usług drogą elektroniczną (art. 5) wymaga ich podania; e-mail jest też punktem
   kontaktowym DSA. Dane trafią automatycznie do stopki, regulaminu i polityk.
2. **Umowy powierzenia z dostawcami**: Cloudflare (DPA jest częścią warunków – sprawdźcie w panelu
   Cloudflare, że jest zaakceptowana), dostawca VPS, biuro rachunkowe, operator płatności (gdy będzie).
   Gdy wybierzecie dostawcę VPS, wpiszcie jego nazwę w polityce prywatności i umowie powierzenia.
3. **Rejestr czynności przetwarzania** (RODO art. 30 ust. 1 – jako administrator, art. 30 ust. 2 – jako podmiot
   przetwarzający). Przetwarzanie danych klientów firm nie jest „sporadyczne”, więc zwolnienie dla firm
   poniżej 250 osób nie ma zastosowania. To dokument wewnętrzny (arkusz) – nie publikujecie go.
4. **Procedura naruszeń ochrony danych**: kto i jak zgłasza naruszenie do UODO (72 godziny) i powiadamia
   firmy (umowa powierzenia: 36 godzin).
5. **Firmy, które już mają konta**: przy zmianie regulaminu wyślijcie im e-mail z nową wersją co najmniej
   14 dni przed wejściem w życie (regulamin § 13).
6. **Przegląd przez prawnika** – szczególnie ograniczenie odpowiedzialności, okres próbny i płatności,
   gdy podłączycie operatora płatności online.

## Przy zmianie dokumentów

- Zmiana regulaminu albo umowy powierzenia: nowa data w `WERSJA_DOKUMENTOW` i `LEGAL_UPDATED`.
- Nowy plik cookie lub wpis localStorage: dopisać do tabeli w `COOKIES` (polityka cookies).
- Nowy dostawca przetwarzający dane: dopisać w polityce prywatności (§ 5) i umowie powierzenia (§ 4)
  oraz powiadomić firmy 14 dni wcześniej.
