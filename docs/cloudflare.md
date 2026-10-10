# Cloudflare Pages: oferty w KV

Strona dalej jest statycznym eksportem Next.js (`output: "export"` → `out/`).
Backend to **Cloudflare Pages Functions** z katalogu `functions/` (Cloudflare
buduje je sam przy deployu), a oferty leżą w **Workers KV**.

## Dlaczego KV, a nie D1

- Jedna osoba obsługuje oferty, danych jest mało (dziesiątki–setki ofert), zapytania
  są proste: „lista” i „jedna oferta po linku”. KV nie wymaga schematu ani migracji.
- Ograniczenia KV, o których warto wiedzieć: zmiana może być widoczna w innych
  lokalizacjach dopiero po ok. 60 s, a zapis to „ostatni wygrywa”. API łagodzi to
  przy zapisie z panelu (nie gubi otwarć klienta, licznik bierze większą wartość).
  Darmowy plan KV: 100 000 odczytów i 1 000 zapisów dziennie (panel zapisuje
  zmiany po krótkiej pauzie, nie na każdy znak).
- Na D1 warto przejść, gdy dojdzie kilku handlowców pracujących równocześnie,
  raporty/filtry po stronie serwera albo dużo zapisów dziennie.

## Klucze w KV (binding `OFFERS`)

| Klucz | Wartość |
| --- | --- |
| `offer:KUCH-2026_12` | pełna oferta (JSON); numer oferty z `/` zamienionym na `_` |
| `slug:<id-linku>` | klucz oferty, żeby strona klienta znalazła ofertę po linku |
| `pinfail:<id-linku>` | licznik błędnych PIN-ów (wygasa po godzinie, max 10 prób) |
| `firma:<nip>` | odpowiedź wyszukiwania firmy (znaleziona / brak w wykazie), wygasa po 24 h |

## API

| Metoda i ścieżka | Kto | Co robi |
| --- | --- | --- |
| `GET /api/offers` | panel (token) | lista ofert |
| `POST /api/offers` | panel (token) | nowa oferta (409, gdy numer zajęty) |
| `GET/PUT/DELETE /api/offers/:id` | panel (token) | jedna oferta; `:id` = `KUCH-2026_12` |
| `GET /api/public/:link` | klient | tylko materiały i podstawowe dane oferty (404 / 410 wygasła / 401 PIN) |
| `POST /api/public/:link/open` | klient | zapis otwarcia (licznik, historia, status „Otwarta”) |
| `GET /api/firma?nip=…` | panel (token) | dane firmy po NIP: biała lista VAT (MF) + KRS; wynik 24 h w KV pod `firma:<nip>` |

Panel wysyła nagłówek `Authorization: Bearer <PANEL_TOKEN>`. Token wpisuje się
raz w panelu, zostaje w localStorage tej przeglądarki. W kodzie nie ma żadnego sekretu.
Oferta z PIN-em wymaga nagłówka `X-Offer-Pin` (strona klienta pyta o PIN).

Alternatywa dla tokenu: **Cloudflare Access** (Zero Trust) na ścieżki `/panel*`
i `/api/offers*`: logowanie mailem/Google bez wspólnego hasła. Wtedy token może
zostać jako druga warstwa albo zostać zastąpiony sprawdzaniem nagłówka
`Cf-Access-Jwt-Assertion` w `functions/_lib/offers.ts`.

## Linki dla klientów

Link ma postać `https://<domena>/oferta/<12 znaków base62>`, np.
`/oferta/DrVyjD1zcdiO` (losowe z `crypto.getRandomValues`, nie po kolei).
Eksport statyczny nie zbuduje strony dla każdego linku, więc budowana jest jedna
strona `/oferta/view`, a `public/_redirects` podaje ją pod każdym `/oferta/<id>`
(rewrite 200, adres w przeglądarce się nie zmienia). `/oferta/demo` jest
wyłączone wcześniejszą regułą, bo na Cloudflare reguły `_redirects` działają
nawet wtedy, gdy plik istnieje. Przy zwykłym `next dev` działa `/oferta/view?id=<id>`.

## Co ustawić w Cloudflare (jednorazowo)

1. **Workers & Pages → KV → Create namespace**, np. `kuchnia-oferty`
   (opcjonalnie drugi, np. `kuchnia-oferty-preview`, żeby podglądy gałęzi nie
   mieszały się z prawdziwymi ofertami).
2. **Pages → projekt → Settings → Bindings → Add → KV namespace**:
   nazwa zmiennej **`OFFERS`**, namespace jak wyżej. Osobno dla
   **Production** i **Preview**.
3. **Settings → Variables and Secrets → Add → typ Secret**:
   **`PANEL_TOKEN`** = długie losowe hasło (np. 32+ znaki z menedżera haseł).
   Też dla Production i Preview. To samo hasło wpisuje się w panelu.
4. **Settings → Build**: polecenie `npm run build`, katalog wyjściowy `out`,
   zmienna środowiskowa **`NODE_VERSION` = `22`**.
5. **Repozytorium**: projekt `system-ofertowania` jest wdrażany ręcznie
   (Direct Upload, `wrangler pages deploy`) i nie da się go przełączyć na Gita.
   Automatyczny deploy z **`pawel799/System-ofertowania-`** wymaga nowego
   projektu Pages – krok po kroku w [`deploy-z-gita.md`](deploy-z-gita.md).
6. Po zmianie bindingów/sekretów zrób ponowny deploy (bindingi działają od
   następnego wdrożenia).

Bez bindingu `OFFERS` API zwraca 503 „Brak bindingu KV”, bez `PANEL_TOKEN`
panel dostaje 503 „Na serwerze nie ustawiono sekretu PANEL_TOKEN” (celowo:
bez sekretu nic nie jest otwarte).

`wrangler.toml` celowo nie ma w repo: bindingi są w panelu Cloudflare, więc nie
trzeba wpisywać do repo identyfikatorów namespace’ów.

## Lokalnie z API

```bash
npm run build                 # tworzy out/
echo PANEL_TOKEN=lokalny-token > .dev.vars   # plik w .gitignore
npm run pages:dev             # http://localhost:8788, KV lokalne w .wrangler/
```

`pages:dev` uruchamia `npx -y wrangler@4 pages dev out --kv OFFERS` (wrangler
wymaga Node 22+; nie jest w zależnościach, żeby build na Cloudflare był lżejszy).
Zwykłe `npm run dev` działa jak dotąd, ale bez API: panel przechodzi wtedy
w „Dane demo” (localStorage + przykładowe oferty).

## Wyszukiwanie firmy po NIP

`functions/api/firma.ts` (dawniej Next route handler, który nie działa w eksporcie
statycznym). Ta sama odpowiedź (`CompanyLookup` z `src/components/panel/company.ts`)
i te same kody: 400 zły NIP, 404 brak w wykazie, 429 limit, 502 usługa nie odpowiada.
Wymaga tokenu panelu (401 bez niego), bo wykaz VAT ma limit 100 zapytań dziennie
z jednego IP. Bufor w KV, bo pamięć funkcji nie przetrwa między instancjami, a Cache
API nie działa na domenach `*.pages.dev`. Bez bindingu `OFFERS` działa bez bufora.
