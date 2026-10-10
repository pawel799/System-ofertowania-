# Automatyczny deploy z Gita (Cloudflare Pages)

Cel: każdy push na `main` w `pawel799/System-ofertowania-` sam buduje i wdraża stronę
z Pages Functions, KV `OFFERS` i sekretem `PANEL_TOKEN`. Ręczny deploy wranglerem zostaje
jako zapas.

To jest tylko instrukcja – nic w Cloudflare nie zostało zmienione.

## Stan dziś

| Co | Wartość |
| --- | --- |
| Projekt Pages | `system-ofertowania` → https://system-ofertowania.pages.dev |
| Tryb | **Direct Upload** (`wrangler pages deploy out`), push na GitHub nic nie wdraża |
| KV | `kuchnia-oferty`, id `28b882fa9c3d416fac025765aabcba52`, binding `OFFERS` |
| Sekret | `PANEL_TOKEN` (Production) – wartość w pliku na pulpicie Pawła, nie w repo ani na czacie |
| Compatibility date | `2026-10-01` (z niecommitowanego `wrangler.toml` w klonie do deployu) |
| Build | `npm run build` → `out/`, Node 22, npm 10.9.2 (`npm ci`) |

## Zanim zaczniesz – trzy rzeczy, które decydują o kolejności

1. **Projektu Direct Upload nie da się przełączyć na Gita.** Cloudflare pozwala podpiąć repo
   tylko przy tworzeniu projektu. Trzeba założyć **nowy projekt Pages** z repo, a stary zostawić,
   dopóki nowy nie działa.
2. **Nowy projekt = nowy adres `*.pages.dev`.** Nazwa `system-ofertowania` jest zajęta przez stary
   projekt, więc nowy dostanie np. `system-ofertowania-git.pages.dev`.
   Linki, które klienci już dostali, prowadzą do `system-ofertowania.pages.dev`:
   **stary projekt musi działać, dopóki te linki są ważne** (link żyje 1–30 dni, max 365).
   Oba projekty mogą mieć podpięty ten sam KV, więc widzą te same oferty.
3. **`wrangler.toml` nie wrzucać do repo** (chyba że świadomie przechodzicie na konfigurację w pliku).
   Gdy w repo jest plik konfiguracyjny wranglera z `pages_build_output_dir`, Cloudflare traktuje go
   jako źródło prawdy dla projektu i ustawień z punktów 4–6 nie da się wtedy zmieniać w panelu.
   Klon do deployu ma ten plik niecommitowany – tak ma zostać.

## Kroki

### 1. Dostęp do repo

**Workers & Pages → Create → Pages → Connect to Git (Import an existing Git repository) → GitHub.**
Cloudflare instaluje swoją aplikację GitHub. Musi to zrobić konto **pawel799** (właściciel repo).
Przy instalacji wybierz **Only select repositories → `System-ofertowania-`**.

### 2. Ustawienia buildu (formularz tworzenia projektu)

| Pole | Wartość |
| --- | --- |
| Project name | np. `system-ofertowania-git` (patrz „Zanim zaczniesz”, pkt 2) |
| Production branch | `main` |
| Framework preset | `Next.js (Static HTML Export)` albo `None` – i tak nadpisujemy pola niżej |
| Build command | `npm run build` |
| Build output directory | `out` |
| Root directory | puste (repo w korzeniu) |
| Environment variables | `NODE_VERSION` = `22` |

`functions/` w korzeniu repo Cloudflare wykrywa i buduje sam (Pages Functions), `public/_redirects`
trafia do `out/` przy buildzie – nic więcej nie trzeba.

Instalacja zależności: obraz buildu widzi `package-lock.json` i robi `npm ci`. Lockfile musi być
zgodny z `package.json` (generowany przez `npx -y npm@10.9.2 install`), inaczej build padnie na
`@emnapi`.

Po „Save and Deploy” od razu leci pierwszy build. **API będzie w nim zwracać 503** (brak bindingu
i sekretu) – to normalne, punkt 6 robi ponowny deploy.

### 3. KV dla podglądów (zalecane)

**Workers & Pages → KV → Create namespace** → `kuchnia-oferty-preview`.
Dzięki temu deploye gałęzi innych niż `main` nie czytają ani nie piszą prawdziwych ofert.

### 4. Binding `OFFERS`

**Projekt → Settings → Bindings → Add → KV namespace**

| Środowisko | Variable name | KV namespace |
| --- | --- | --- |
| Production | `OFFERS` | `kuchnia-oferty` |
| Preview | `OFFERS` | `kuchnia-oferty-preview` |

### 5. Sekret `PANEL_TOKEN`

**Projekt → Settings → Variables and Secrets → Add → Type: Secret**

| Środowisko | Name | Value |
| --- | --- | --- |
| Production | `PANEL_TOKEN` | **ta sama wartość co dziś** (z pliku na pulpicie) – wtedy zapisany w przeglądarkach token dalej działa |
| Preview | `PANEL_TOKEN` | **inna** długa losowa wartość |

`NODE_VERSION` z punktu 2 sprawdź tu w obu środowiskach (Production i Preview).

### 6. Runtime i ponowny deploy

- **Settings → Runtime → Compatibility date**: `2026-10-01` (jak w obecnym `wrangler.toml`),
  bez compatibility flags.
- **Deployments → ostatni deploy → … → Retry deployment.** Bindingi i sekrety działają od
  następnego wdrożenia.

### 7. Które gałęzie budować

**Settings → Builds → Branch control**

- Production branch: `main`.
- Preview deployments: **None** albo **Custom branches** (np. tylko `preview/*`).
  Adresy podglądów (`<hash>.system-ofertowania-git.pages.dev`) są domyślnie publiczne; jeśli
  podglądy mają zostać włączone, rozważ **Access policy** na podglądy (Cloudflare Access).
- Opcjonalnie **Build watch paths**: wyklucz `docs/**` i `*.md`, żeby zmiana dokumentacji nie
  uruchamiała buildu.

Pojedynczy push bez buildu: w opisie commita `[skip ci]` (albo `[CI Skip]`, `[CF-Pages-Skip]`).

### 8. Sprawdzenie (jak przy ręcznym deployu)

Na `https://<nowy-projekt>.pages.dev`:

| Adres | Oczekiwane |
| --- | --- |
| `/panel` | 200; po wpisaniu tokenu lista ofert **taka sama jak na starym adresie** (ten sam KV) |
| `/oferta/demo` | 200, scena 3D się wczytuje |
| `/podglad-maila` | 200 |
| `/api/offers` bez tokenu | **401** (nie 503 – 503 znaczy brak bindingu albo sekretu) |
| `/oferta/<istniejący-link>` | ta sama oferta co na starym adresie |

### 9. Przełączenie

- Nowe linki z panelu biorą adres strony, na której panel jest otwarty (`window.location.origin`),
  więc **od teraz panel otwieraj pod nowym adresem**.
- Najlepiej podpiąć **własną domenę** (Settings → Custom domains) do nowego projektu – wtedy przyszłe
  zmiany hostingu nie zmienią adresów w mailach do klientów.
- Stary projekt `system-ofertowania` zostaw (bez nowych deployów), aż wygasną wysłane z niego linki.
  Usuń go dopiero potem.
- Martwy Worker z kopii `pawel799/system-ofertowania` (cloudflare[bot]) można usunąć od razu –
  nie ma z nim związku.

## Po przełączeniu – nowa procedura

1. Zmiana na gałęzi → przegląd → merge/push na `main`.
2. Cloudflare buduje i wdraża sam (**Deployments** pokazuje log i commit).
3. Sprawdzenie z punktu 8.
4. Coś nie tak → **Deployments → poprzedni deploy → … → Rollback** (kilka sekund, bez buildu).

Ręczny deploy wranglerem do nowego projektu dalej działa jako zapas:
`npx wrangler pages deploy out --project-name <nowy-projekt> --branch main --commit-hash <sha>`.

## Do potwierdzenia w panelu Cloudflare

Opisane z dokumentacji i doświadczenia, ale bez dostępu do panelu ani aktualnych stron dokumentacji
w momencie pisania. Nazwy menu Cloudflare czasem się zmieniają; sprawdź przy pierwszym przejściu:

- dokładne nazwy pól i przycisków (Create / Connect to Git / Import an existing Git repository),
- czy obraz buildu ma domyślnie Node 22 (`NODE_VERSION` i tak wymusza 22),
- czy nazwa projektu po usunięciu starego projektu wraca do puli (gdyby chcieć odzyskać
  `system-ofertowania.pages.dev` dla projektu z Gita),
- dostępność „Build watch paths” i „Access policy” dla podglądów w waszym planie.

Dokumentacja:
[Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/) ·
[Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/) ·
[Konfiguracja wranglera w Pages](https://developers.cloudflare.com/pages/functions/wrangler-configuration/) ·
[Obraz buildu](https://developers.cloudflare.com/pages/configuration/build-image/) ·
[Znane problemy](https://developers.cloudflare.com/pages/platform/known-issues/)
