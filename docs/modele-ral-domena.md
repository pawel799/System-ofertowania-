# Modele 3D, kolory RAL i własna domena

Trzy nowe rzeczy w panelu, wszystkie w **/panel/ustawienia** (przycisk „Ustawienia” w nagłówku panelu ofert):

1. **Modele 3D**: wgrywanie własnego modelu kuchni (GLB albo OBJ) zamiast kuchni demo.
2. **Oznaczanie elementów**: w podglądzie 3D zaznaczasz, co jest frontem, blatem i uchwytem. Tylko te elementy zmieniają kolor w ofercie.
3. **Pakiety kolorów RAL**: zestawy kolorów frontów z wykończeniem (mat, satyna, połysk) i dopłatą.
4. **Własna domena** linków do ofert (np. `oferty.firma.pl`) przez Cloudflare for SaaS.

Kuchnia demo działa jak wcześniej. Doszło tylko to, że front może mieć kolor z pakietu RAL (dopisane w `frontMaterials.ts`, bez zmian dla istniejących próbek).

---

## Co ustawić w Cloudflare

### 1. R2 na pliki modeli (wymagane do wgrywania modeli)

1. R2 → **Create bucket**, np. `system-ofertowania-modele` (lokalizacja: automatyczna albo EU).
2. Projekt Pages → Settings → **Bindings** → Add → **R2 bucket**: nazwa zmiennej `MODELS`, bucket z punktu 1.
   Ustaw dla Production (i Preview, jeśli go używacie).
3. Redeploy.

Bez bindingu `MODELS` panel pokaże w zakładce Modele 3D komunikat „Brak bindingu R2 o nazwie MODELS”, a reszta działa normalnie.

Pakiety RAL i ustawienia domeny zapisują się w tym samym KV co oferty (`OFFERS`), więc tu nic nie trzeba dodawać.

### 2. Własna domena (opcjonalne)

Do własnych domen potrzebna jest strefa (domena systemu) w Cloudflare z włączonym **SSL for SaaS / Cloudflare for SaaS**.

1. Strefa systemu → SSL/TLS → **Custom Hostnames** → włącz. Ustaw **fallback origin**, np. `klienci.<domena-systemu>`.
   To jest nazwa, na którą firmy ustawiają u siebie CNAME.
2. Ruch z domen firm musi trafić do projektu Pages. Według dokumentacji Cloudflare robi się to Workerem jako originem
   ([Workers as your fallback origin](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/advanced-settings/worker-as-origin/)):
   rekord `klienci.<domena-systemu> AAAA 100::` (proxied) i trasa Workera `*/*` w tej strefie.
   Worker może przekazywać żądania do `https://<projekt>.pages.dev` albo projekt można przenieść na Workers ze statycznymi plikami.
   **Do potwierdzenia przez Pawła:** dokumentacja nie mówi wprost, czy Pages może być fallback originem bez Workera.
3. Token API: My Profile → API Tokens → Create Token → uprawnienie strefy **SSL and Certificates: Edit**, tylko dla strefy systemu.
   **Do potwierdzenia:** czy do custom hostnames wystarcza to uprawnienie (tak było w dokumentacji, którą pamiętam).
4. Projekt Pages → Settings → Variables and Secrets (Production):
   - `CF_API_TOKEN`: token z punktu 3, jako **Secret**,
   - `CF_ZONE_ID`: Zone ID strefy systemu (Overview strefy, prawa kolumna),
   - `CF_CNAME_TARGET`: nazwa z punktu 1, np. `klienci.<domena-systemu>`.
5. Redeploy.

Bez tych zmiennych zakładka Domena pokazuje, że funkcja nie jest włączona na serwerze. Nic się nie psuje.

Jak to działa dla firmy: w panelu wpisuje `oferty.firma.pl`, a panel pokazuje rekord CNAME do ustawienia u jej dostawcy domeny.
Po ustawieniu klika „Sprawdź status”. Gdy Cloudflare potwierdzi nazwę i wystawi certyfikat, status zmienia się na „Aktywna”,
a nowe linki w panelu mają adres `https://oferty.firma.pl/oferta/…`.

---

## Lokalnie

```
npm run build
npx -y wrangler@4 pages dev out --kv OFFERS --r2 MODELS --binding PANEL_TOKEN=test-token
```

(`npm run pages:dev` ma już `--r2 MODELS`.) Do testu domeny bez prawdziwego Cloudflare można podać
`--binding CF_API_BASE=http://127.0.0.1:<port>/client/v4` z atrapą API. Tak robił test e2e w paczce.

---

## Szczegóły

### Wgrywanie modelu

- **GLB** (np. Winner Flex: Design → Export → Export glTF/glb, od wersji 12.6a3) albo **OBJ** (np. PRO100).
  Do OBJ można dołączyć `.mtl` i tekstury, wybierając je razem z plikiem.
- Przed wysłaniem panel przerabia model w przeglądarce (`src/components/panel/modelOptimize.ts`, biblioteka gltf-transform):
  - OBJ zamienia na GLB,
  - nadaje elementom unikalne nazwy bez spacji i kropek (na nich wiszą oznaczenia),
  - usuwa duplikaty i nieużywane dane, skleja wierzchołki,
  - pomniejsza tekstury do maks. 2048 px,
  - kompresuje geometrię (meshopt).
- Plik, który już ma kompresję Draco, idzie bez zmian (bez dekodera Draco nie da się go przepisać). Nazwy elementów zostają wtedy z pliku.
- Limit po kompresji: **40 MB** (`MAX_MODEL_BYTES` w `functions/_lib/assets.ts`).
- Plik jest publiczny pod `/api/models/<id>/file?v=<wersja>`, tak jak link do oferty: losowe 16 znaków, cache „immutable”.

### Oznaczanie elementów

- Klik na podglądzie zaznacza element (Shift + klik zaznacza kilka). Potem wybierasz rolę: Front, Blat, Uchwyt albo Bez roli.
- Zakładka „Materiały” nadaje rolę hurtem wszystkim elementom z danym materiałem. To zwykle najszybsza droga.
- Zapis: `PUT /api/models/<id>` z `{ tags: { "<nazwa elementu>": "front" | "blat" | "uchwyt" } }`.
- W ofercie (`src/components/modelRoles.ts`):
  - **front** dostaje kolor próbki albo RAL z połyskiem wg wykończenia,
  - **blat** dostaje kwarcyt (bez zmian), granit albo laminat,
  - **uchwyt** dostaje mosiądz albo czarny mat; przy „Push-to-open” uchwyt znika.

### Pakiety RAL

- Lista RAL Classic: 215 kolorów (`src/components/ral.ts`). Dane kolorów pochodzą z paczki `ral-colors` 1.0.1 (licencja MIT), nazwy przetłumaczone na polski.
  Kolory na ekranie są przybliżone. W panelu i na stronie jest dopisek o wzorniku.
- Front z pakietu ma w ofercie id `ral:<id pakietu>:<kod>`, np. `ral:Ab12Cd34Ef56:9010`. API sprawdza, czy taki pakiet i kolor istnieją.
- Pakietu ani koloru użytego w ofercie nie da się usunąć (409 z listą ofert). Modelu użytego w ofercie też nie.

### Nowe endpointy

| Metoda i adres | Dostęp | Co robi |
| --- | --- | --- |
| `GET/POST /api/models` | token | lista modeli / wgranie GLB (treść = plik, nagłówek `X-Model-Name`) |
| `GET/PUT/DELETE /api/models/:id` | token | opis / nazwa i oznaczenia / usunięcie |
| `GET /api/models/:id/file` | publiczny | plik GLB |
| `GET/POST /api/palettes`, `PUT/DELETE /api/palettes/:id` | token | pakiety RAL |
| `GET/PUT/DELETE /api/settings/domain` | token | stan, dodanie i usunięcie domeny |
| `POST /api/settings/domain/refresh` | token | status z Cloudflare |

`GET /api/public/:slug` zwraca teraz też `model` (adres pliku i role) oraz `palettes`. Przy ukrytej cenie dopłaty są zerowane.

### Co jeszcze nie jest zrobione

- Konta firm: wszystko działa dla jednej firmy na jednym `PANEL_TOKEN`, jak oferty.
  Dane są tak ułożone, żeby dało się je przypisać do firm (klucze w KV i R2 per id).
- Strefy frontów (np. górne i dolne w innym kolorze): teraz jest jedna rola „front”.
- Podmiana pliku modelu z zachowaniem oznaczeń: teraz wgrywa się nowy model i oznacza go od nowa.
