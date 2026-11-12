# Ochrona modeli 3D

Model kuchni ze strony głównej i oferty demo nie leży już jako zwykły plik GLB.

- `public/models/kitchen.enc` – model zaszyfrowany AES-256-GCM (12 B IV + szyfrogram).
  Pobrany bezpośrednio jest bezużyteczny.
- `GET /api/model-key` (`functions/api/model-key.ts`) – klucz wydawany tylko zapytaniom `fetch`
  ze skryptu tej samej strony (nagłówki `Sec-Fetch-Site: same-origin`, `Sec-Fetch-Dest: empty`,
  których strona nie może podrobić). Wpisanie adresu, link „pobierz” i inna domena dostają 403.
  Limit: 60 zapytań na IP na 10 minut, bez cache.
- `src/lib/protectedModel.ts` – pobiera plik, odszyfrowuje go w pamięci (WebCrypto) i podaje
  loaderowi adres `blob:`. Pobieranie raz na wizytę.
- Modele wgrywane przez studio (`/api/models/:id/file`) mają tę samą blokadę bezpośredniego
  otwierania i pobierania z innej domeny.

**Ważne: to utrudnia pobranie, a nie uniemożliwia.** Model wyświetlany w WebGL musi trafić do
przeglądarki, więc osoba z narzędziami deweloperskimi może go wyciągnąć. Blokada zatrzymuje
zwykłe „zapisz jako”, linki do pliku i podkradanie z innych stron.

## Wdrożenie

1. W Cloudflare Pages: **Settings → Variables and Secrets → `MODEL_KEY`** (Secret) – ten sam klucz
   co w `.dev.vars`. Bez niego `/api/model-key` zwraca 503 i scena 3D się nie wczyta
   (strona działa dalej, zamiast sceny jest kadr).
2. Oryginał modelu trzymaj w `modele-zrodlowe/` (folder w `.gitignore`).
   Po zmianie modelu: `node scripts/szyfruj-model.mjs` i commit `public/models/kitchen.enc`.

## Repozytorium jest publiczne

`public/models/kitchen-opt.glb` został usunięty z repo, ale **nadal jest w historii gita**
(i w kopiach repo). Żeby go stamtąd usunąć, trzeba przepisać historię (np. `git filter-repo`)
albo ustawić repozytorium jako prywatne. To decyzja właściciela repo.
