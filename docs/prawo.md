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
| Polityka cookies z listą wszystkich plików i wpisów localStorage | Prawo komunikacji elektronicznej, art. 399 | `/polityka-cookies` |
| Informacja o cookies (nie zgoda – tylko niezbędne pliki) | art. 399 ust. 3 PKE | `src/components/InfoCookies.tsx` |
| Punkt kontaktowy i zgłaszanie nielegalnych treści, uzasadnienie decyzji | Akt o usługach cyfrowych (DSA), art. 11, 12, 16, 17 | `/regulamin` § 8 |
| Ceny netto z informacją o VAT (usługa dla firm) | | `/cennik` |
| Bez zewnętrznych zasobów przekazujących IP: dekoder Draco z `/draco/` (wcześniej Google gstatic), czcionka wbudowana przy budowaniu | RODO (minimalizacja, transfer) | `src/lib/draco.ts`, `public/_headers` |

**Zasada na przyszłość:** dopóki serwis ma tylko niezbędne pliki, wystarcza informacja. Dodanie analityki
(Google Analytics, Meta Pixel, Hotjar, nawet „anonimowej” statystyki zapisującej pliki) = obowiązek banera
**zgody** z odmową równie łatwą jak akceptacja, blokowanie skryptów do czasu zgody i aktualizacja polityki.

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
