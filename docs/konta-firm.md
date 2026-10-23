# Konta firm (wiele stolarni w jednym systemie)

Każda stolarnia zakłada konto na `/rejestracja` (NIP, nazwa firmy, imię i nazwisko, e-mail, hasło)
i dostaje własny panel: swoje oferty, linki, zgłoszenia, modele 3D, pakiety RAL, nazwę i logo, domenę.
Właściciel konta dodaje pracowników w **Ustawienia → Zespół**. Nowa firma ma okres próbny
(`TRIAL_DAYS` w `src/lib/plans.ts`, 30 dni) na planie wybranym przy rejestracji.

## Jak to działa

- **Dane firmy w KV** – każda firma ma prefiks `t:<firmId>:` (oferty, modele, pakiety, marka, domena,
  zgłoszenia). Endpointy dalej czytają `offer:…`, `model:…` – prefiks dokleja `scoped()`
  w `functions/_lib/tenant.ts`.
- **Dotychczasowe dane** (bez prefiksu) należą do firmy `main` – to właściciel systemu, wejście kodem
  `PANEL_TOKEN`. Nic nie trzeba migrować; stare linki klientów działają.
- **Linki klientów** (`slug:<link>`) są wspólne: wartość `"<firmId>|<klucz oferty>"` mówi, do której
  firmy należy oferta (dla `main` – sam klucz, jak dotąd). Firma nie zajmie linku innej firmy (409).
- **Zgłoszenia** z formularza na stronie oferty trafiają do firmy, która wysłała link (pole `link`
  w `POST /api/zapytania`); z `/kontakt` i oferty demo – do `main`. Powiadomienie e-mail (Resend)
  idzie do właściciela konta firmy, a dla `main` na `NOTIFY_EMAIL`.
- **Pliki modeli 3D** są publiczne (strona klienta); `modelowner:<id>` mówi, w której firmie szukać opisu.

## Logowanie i bezpieczeństwo

- Hasła: PBKDF2-SHA256, losowa sól, 100 000 iteracji (maksimum w Workers; zmienna
  `PASSWORD_ITERATIONS` może to obniżyć). Liczba iteracji jest zapisana przy haśle.
- Sesja: losowy token w ciasteczku `so_sesja` (HttpOnly, SameSite=Lax, Secure na https, 30 dni);
  w KV tylko skrót tokenu (`sess:<sha256>`). Zmiana hasła unieważnia starsze sesje.
- CSRF: SameSite=Lax + odrzucanie zmian z obcym nagłówkiem `Origin` (403).
- Zgadywanie haseł: 10 błędnych prób na konto i 20 na IP w ciągu 15 minut, potem 429.
  Rejestracja: 5 na godzinę z IP. Reset hasła: 5 próśb na godzinę z IP.
- Zawieszona firma (`status: suspended`): panel 403, logowanie 403, linki jej klientów 404.
- Cloudflare Pages Functions na planie Free mają 10 ms CPU na żądanie. Logowanie (PBKDF2) zwykle się
  mieści, ale gdyby Cloudflare zwracał błąd 1102 przy logowaniu – plan Workers Paid (5 USD/mies.)
  albo `PASSWORD_ITERATIONS=50000`.

## Klucze globalne w KV

| Klucz | Wartość |
|---|---|
| `firm:<id>` | firma: nazwa, NIP, plan, status, `trialEnds`, `paidUntil`, `billing` |
| `firmnip:<nip>` | id firmy (jedno konto na NIP) |
| `firmusers:<id>` | lista e-maili kont firmy |
| `user:<email>` | konto: imię, rola (`owner`/`member`), skrót hasła |
| `sess:<sha256>` | sesja (30 dni) |
| `pwreset:<sha256>` | e-mail, link do zmiany hasła (1 godzina) |
| `modelowner:<id>` | firma, do której należy model 3D |
| `loginfail:…`, `rate:reg:…`, `rate:reset:…` | liczniki prób |

## Endpointy

| Metoda i adres | Kto | Co robi |
|---|---|---|
| `POST /api/auth/register` | każdy | `{ firma, nip, imie, email, haslo, plan?, zgoda }` → konto firmy + właściciela, od razu zalogowany |
| `POST /api/auth/login` | każdy | `{ email, haslo }` → ciasteczko sesji |
| `POST /api/auth/logout` | zalogowany | koniec sesji |
| `GET /api/auth/me` | zalogowany | `{ role, user, firm }` (administrator: `role: "admin"`) |
| `POST /api/auth/password` | konto | `{ obecne, nowe }` – zmiana hasła |
| `POST /api/auth/reset` | każdy | `{ email }` → mail z linkiem (gdy jest `RESEND_API_KEY`); `{ mail: false }` bez poczty |
| `POST /api/auth/reset/confirm` | każdy | `{ token, haslo }` – nowe hasło z linku |
| `GET /api/team`, `POST /api/team` | firma / właściciel | lista kont, nowe konto pracownika `{ email, imie, haslo }` |
| `PATCH /api/team/:email`, `DELETE /api/team/:email` | właściciel | nowe hasło pracownika, usunięcie konta |
| `GET /api/admin/firms` | administrator | lista firm z kontami |
| `PUT /api/admin/firms/:id` | administrator | `{ plan?, status?, trialEnds?, paidUntil? }` |

## Administrator systemu

Wejście kodem `PANEL_TOKEN` (w oknie logowania: „Mam kod administratora”) to firma `main` +
zakładka **Ustawienia → Firmy**: plan, status (okres próbny / aktywna / zawieszona) i „opłacone do”
dla każdej stolarni. Ręcznie, dopóki nie ma płatności online.
