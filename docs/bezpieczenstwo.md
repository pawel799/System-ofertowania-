# Bezpieczeństwo: przegląd i poprawki

Przegląd z 13.10.2026 według listy: nieużywane paczki, sekrety w git, limity, dostęp, hasła, klucze API, logowanie,
aktualizacje, formularze, XSS, tryb debug, zmienne środowiskowe, odsłonięte pliki, panel, API, CORS, nagłówki i baza.
Zakres: strona, panel, strona oferty klienta i Pages Functions, w tym moduły z paczki backend-4 (modele, RAL, domena).

**Wynik:** nie znalazłem dziury, przez którą ktoś z zewnątrz dostałby się do ofert. Poprawione zostały cztery rzeczy:

- nie było limitu zgadywania tokenu panelu,
- licznik otwarć dało się zaśmiecać,
- nie było nagłówków bezpieczeństwa (w tym CSP),
- `.gitignore` nie chronił zwykłego `.env`.

Reszta była w porządku albo jest zaleceniem do zrobienia w panelu Cloudflare.

| Punkt | Stan | Co jest / co zrobiono |
| --- | --- | --- |
| Nieużywane paczki | Poprawione | Usunięty `autoprefixer` (PostCSS uruchamia tylko Tailwind). `@types/three` przeniesione do devDependencies. |
| Sekrety w git | OK | Przeszukana cała historia wszystkich branchy: brak tokenów, kluczy, plików `.env` / `.dev.vars`. `.gitignore` uzupełniony o `.env`, `.env.*`, `.dev.vars.*`. |
| Limity zapytań | Poprawione | Było: PIN 10 prób na godzinę na link, uwagi 10 na godzinę na link, NIP w rejestracji 10 na godzinę na IP i 50 dziennie. Doszło: 20 błędnych tokenów panelu w 15 minut z jednego IP blokuje to IP (także z dobrym tokenem). Otwarcie oferty liczy się raz na 30 minut z jednego IP. |
| Dostęp | OK | Wszystkie endpointy panelu (oferty, firma po NIP-ie, modele, pakiety, domena) wymagają tokenu. Publiczne: oferta pod losowym linkiem (10+ znaków, opcjonalnie PIN), plik modelu pod losowym id (16 znaków), podpowiedź nazwy firmy w rejestracji (z limitem). |
| Hashowanie haseł | Nie dotyczy | System nie przechowuje haseł. Logowanie i rejestracja na stronie to wersja demo bez backendu. Token panelu jest porównywany przez skrót SHA-256 w stałym czasie. |
| Klucze API | OK | `PANEL_TOKEN` i `CF_API_TOKEN` są tylko sekretami w Cloudflare. W zbudowanej stronie (`out/`) nie ma kluczy ani plików `.map`. Token panelu leży w localStorage przeglądarki; chronią go CSP i nowy przycisk „Wyloguj” w ustawieniach. |
| Uwierzytelnianie | OK na teraz | Jeden wspólny token dla panelu. Docelowo konta firm z osobnymi sesjami. |
| Aktualizacje | Opisane | `npm audit` zgłasza Next 14 (krytyczne) i PostCSS (wysokie). Wszystkie błędy Next dotyczą jego serwera (Server Actions, Image Optimization, rewrites, middleware), a strona to statyczny eksport bez serwera Next, więc w produkcji nie działają. PostCSS dotyczy budowania z obcego CSS. Poprawka to Next 16 + React 19 + R3F 9, czyli osobny, większy krok. |
| Formularze | OK | Serwer sprawdza każde pole: długości, dozwolone wartości, NIP z sumą kontrolną, kody RAL, domeny, pliki GLB po nagłówku. Limity rozmiaru: JSON 200 kB, model 40 MB. |
| XSS | Poprawione | React escapuje treść. Nigdzie nie wstawiamy surowego HTML poza podglądem maila (dane demo, `esc()`). Doszło CSP. |
| Tryb debug | OK | Brak `console.log`, brak source map, błędy API bez śladu stosu, brak endpointów testowych. `CF_API_BASE` jest tylko do testów (nie ustawiać w produkcji). |
| Zmienne środowiskowe | OK | Sekrety: `PANEL_TOKEN`, `CF_API_TOKEN`. Zwykłe: `CF_ZONE_ID`, `CF_CNAME_TARGET`. Bindingi: `OFFERS` (KV), `MODELS` (R2). |
| Odsłonięte pliki | OK | Pages serwuje tylko `out/`. Sprawdzone, że `/.env`, `/.dev.vars`, `/.git/config`, `/package.json`, `/functions/…`, `/docs/…` i `/next.config.mjs` nie oddają treści. |
| Panel (ścieżki admina) | OK | `/panel` i `/panel/ustawienia` to strony bez danych; dane idą tylko przez API z tokenem. Doszło `X-Robots-Tag: noindex`. |
| API | OK | Token, walidacja, limity. Klucze KV budowane tylko ze sprawdzonych id. Zewnętrzne zapytania tylko do API MF i KRS (sprawdzony NIP/KRS) i do API Cloudflare (adres ze zmiennej), więc nie ma SSRF. |
| CORS | OK | API nie wysyła nagłówków CORS, więc inne strony nie przeczytają odpowiedzi. Doszło `Cross-Origin-Resource-Policy: same-origin`. Token idzie w nagłówku, nie w ciasteczku, więc nie ma CSRF. |
| Nagłówki | Poprawione | Szczegóły niżej. |
| Baza (KV, R2) | OK | Dostęp tylko przez bindingi w Functions; z zewnątrz nie ma publicznego adresu bazy. |

## Nagłówki

**Strony** (`public/_headers`):

- `Content-Security-Policy`:
  - skrypty tylko z własnej domeny i z gstatic (dekoder Draco),
  - WebAssembly dozwolone,
  - bez `eval`, bez ramek, bez wtyczek, formularze tylko do własnej domeny.
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`: wyłączone kamera, mikrofon, lokalizacja, płatności, USB.
- `Cross-Origin-Opener-Policy: same-origin`

**API** (`functions/api/_middleware.ts`): `Content-Security-Policy: default-src 'none'`, `X-Frame-Options: DENY`,
`nosniff`, `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy: same-origin`.

**Dwa świadome wyjątki w CSP:**

1. `script-src 'unsafe-inline'`: Next w eksporcie statycznym wstawia skrypty inline z danymi strony, a bez serwera nie da się dodać nonce.
   CSP dalej blokuje skrypty z obcych domen i `eval`. Dlatego tak ważne jest, że nigdzie nie wstawiamy surowego HTML od użytkownika.
2. `'unsafe-eval'` **tylko na `/panel/ustawienia`**: biblioteka optymalizacji modeli (gltf-transform, przez ndarray)
   tworzy funkcje przez `new Function`. To strona za tokenem, bez treści od klientów.

## Zalecenia (Cloudflare, do zrobienia ręcznie)

- **Limit na `/api/*` w Cloudflare (Security → WAF → Rate limiting rules).** Liczniki w KV są przybliżone (KV synchronizuje się z opóźnieniem),
  więc przy prawdziwym ataku lepiej mieć dodatkową regułę na brzegu, np. 100 zapytań na minutę z IP na `/api/`.
- **2FA** na kontach Cloudflare i GitHub. Token API Cloudflare z minimalnymi uprawnieniami, tylko dla jednej strefy.
- **`PANEL_TOKEN`**: co najmniej 32 losowe znaki. Wymienić, jeśli kiedyś trafił do czatu, maila albo na zrzut ekranu.
- **PIN oferty** ma 4 cyfry: przy 10 próbach na godzinę zgadnięcie zajmuje średnio setki godzin.
  Przy wrażliwych ofertach można przejść na 6 cyfr (serwer przyjmuje 4–8; trzeba zmienić `newPin` i pole PIN na stronie klienta).
- **Aktualizacja do Next 15/16** razem z React 19 i R3F 9 jako osobne zadanie, z testem sceny 3D.

## Testy

- `e2e-sec` (28 sprawdzeń):
  - blokada tokenu po 20 próbach (także dla dobrego tokenu z tego IP, inne IP działa),
  - licznik otwarć,
  - nagłówki na stronach, w panelu, w ustawieniach i w API,
  - brak plików `.env`, `.git`, `package.json`, kodu funkcji i dokumentacji na serwerze,
  - brak CORS i śladu stosu,
  - CSP nie psuje sceny 3D, nagrania, Draco ani panelu.
- `e2e-be` (52 sprawdzenia): wgrywanie i optymalizacja modeli, edytor, RAL i domena pod nowym CSP, bez naruszeń CSP.
- Wcześniejsze testy: panel 15/15, uwagi klienta 21/21, strona główna 27/27.
