# K3D-MEBLE-02 — recon (ETAP 1, tylko odczyt)

Repo: `System-ofertowania-` @ `main` 4f2bdf2. Plan: `kitchen3d-plan` @ d67e3f4 (prompt identyczny z wgranym).
Bez zmian w kodzie. Jedyny nowy plik: ten raport.

## 0. Uwagi wstępne / blokery
- **Brak `/workspace/rekurencja-skills`** (AGENTS.md, context-relay, frame-review, visual-lab) w tym kontenerze. Bez nich review wizualne zrobię świeżym subagentem read-only wg opisu z promptu — albo Paweł dorzuca repo skilli do sesji.
- **Nazwa gałęzi:** prompt mówi `feat/meble-cargo-lemans`, środowisko sesji wymusza `claude/funny-tesla-non55g`. Proponuję pracować lokalnie na `feat/meble-cargo-lemans` (wynik i tak jako .zip), pushować tylko jeśli Paweł zechce — do potwierdzenia.
- **Brak runnera testów jednostkowych** — jest tylko Playwright E2E (`npm run test:e2e`). Propozycja: `node --test` + `tsx` (jedna lekka devDependency) i skrypt `npm test`; testy rozkroju w `src/**/*.test.ts`. Alternatywa bez zależności: Node 22 `--experimental-strip-types` nie obsłuży aliasu `@/` — więc `tsx` jest prostsze. Wymaga zgody Pawła.
- `node_modules` nie zainstalowane (Node v22.23.5) — `npm ci` dopiero w ETAPIE 2.

## 1. Typy szafek, parametry, 3D, rozkrój, PDF
- **Model danych:** `src/lib/kuchnia.ts`
  - `RodzajElementu` (l.26–54) + `RODZAJE` (l.56) — szafka, szuflady, narozna, zlew, AGD, polka, blat, meble (szafa, komoda…).
  - `Strefa` = `dolna | gorna | wysoka | blat | polka` — „dolna/górna/słupek” to **ta sama `szafka` w innej strefie** (słupek = `strefa: "wysoka"`).
  - `ElementKuchni` (l.93–122): `w/h/d` w **cm**, `x/z/rot/kat`, `wnetrze?`, `kolory?`, `cena?`. Brak pola strony drzwi.
  - `PRESETY` (l.230) — biblioteka presetów (dolne 40/60/80, szuflady 45/60, narożna 90×90, słupek 60×210…).
  - `limityRodzaju()` (l.298) — widełki w cm; domyślna **min. szerokość 30 cm** → cargo 15/20 wymaga własnego `case`.
  - `parseKuchnia()` (l.1092–1222) — walidacja przy zapisie (serwer używa tej samej funkcji: `functions/_lib/offers.ts:420`). **Nieznane pola są wycinane** → każde nowe pole (hinge, prowadnice, waterfall, LeMans) trzeba dopisać do parsera, inaczej zniknie po zapisie.
- **Wnętrze:** `src/lib/wnetrze.ts` — `Wnetrze { front: drzwi|przesuwne|otwarte, kolumny[{sekcje: polka|szuflada|drazek}] }`, `kategoriaWnetrza()` (l.121) mapuje rodzaj+strefa → dolna/gorna/slupek/…, `PLYTA_CM = 1.8`.
- **3D:** `src/components/kuchnia/AgdBryla.tsx` (dyspozytor po rodzaju, l.329) → `MebelParametryczny.tsx` (korpus, przegrody, półki, szuflady `Przesuw`, drzwi `Zawias`). Narożna 90 rysuje się dziś jak zwykły prostopadłościan z wnętrzem (bez geometrii L/blendy).
- **Rozkrój:** `src/components/produkcja/formatki.ts` (mm, T=18, plecy HDF 3)
  - `korpus()` l.155: bok = H × (D−3) ×2, **wieniec = W − 2·18** (szafka 60 → 600−36 = **564** ✔), plecy HDF (H−4)×(W−4).
  - `parametryczny()` l.169: półki/szuflady/fronty z `frontyElementu()` (rysunek), okucia przez `z.okucie(nazwa, ilość, jedn.)` — **lista okuć już istnieje** (zawiasy, prowadnice `Prowadnice 450 mm`, uchwyty, nóżki, zawieszki).
  - `formatkiProjektu()` l.304 — dyspozytor po rodzaju; tu dojdą `cargo`, `lemans`, waterfall.
  - `blatyPlanu()` l.269 — blaty jako odcinki ciągów dolnych.
- **PDF / CSV produkcji:** `produkcja/dokument.ts` (`csvFormatek` l.59 — kolumny: Nr;Materiał;Grubość;Długość;Szerokość;Ilość;Słoje;Okleina D1..S2;Mebel;Element;Uwagi), `Produkcja.tsx` (UI, przycisk „Pobierz CSV” l.204), `FormatkiOkno.tsx` (okno z kreatora, `KreatorApp.tsx:1557`). PDF przez `panel/pdfPlik.ts` (html-to-image + jsPDF, lazy).
- **PDF oferty:** `panel/ofertaPdf.ts` (`danePdf` l.76 — pozycje z cenami). **Rysunek techniczny:** `rysunek/rysunekTechniczny.ts` (`frontyElementu` l.96, `frontySvg` l.162 — **trójkąt otwierania już jest**, rysowany z `zawiasLewy`).
- Demo-silnik na stronie głównej (`site/home/kreator/silnik/*`) — osobny, marketingowy; poza zakresem.

## 2. Drzwi i animacja (oś zawiasu)
- `MebelParametryczny.tsx` l.228–270: drzwi dzielone na ciągi nie-szuflad; skrzydło >60 cm → dwa skrzydła. Jednoskrzydłowe: `lewy = n === 1 || c < n/2` (l.252) → **pojedyncze drzwi zawsze na zawiasie lewym**. `Zawias` (l.44) obraca grupę wokół `pivot=[hx, 0, zFront+T/2]` o `±KAT_DRZWI`; uchwyt po przeciwnej stronie (l.264).
- **Ta sama reguła zduplikowana** w `rysunekTechniczny.ts:151` (`zawiasLewy: k === 1 || c < k/2`).
- Otwieranie: `otwarcieStore.ts` (wszystkie / dwuklik na meblu) → prop `otwarte`.
- **Gdzie dodać stronę:** pole `hinge?: 'L'|'P'` w `ElementKuchni` + parser; jedna funkcja `zawiasLewy(el, c, n)` w `wnetrze.ts` używana w 3D i w rysunku (brak pola = dzisiejsze zachowanie). Przełącznik w `panel/KreatorWlasciwosci.tsx` (obok wymiarów, l.179) — widoczny tylko gdy mebel ma dokładnie jedno skrzydło. Uwaga: dotyczy też szaf jednodrzwiowych i słupków; dla 2 kolumn po 1 skrzydle zostaje obecna reguła.

## 3. Blat i narożnik
- **3D:** blat rysowany **osobno na każdej szafce dolnej** (`AgdBryla.tsx:28`, grubość na sztywno **28 mm**, nawis 1 cm z przodu). Brak ciągłego blatu i brak łączenia w narożniku — w L dwa blaty nachodzą w rogu.
- **Rozkrój:** `blatyPlanu()` skleja stykające się szafki wzdłuż ściany w jeden odcinek (dł. = suma, szer. = gł. + nawis 20 mm), osobne elementy „blat” dokłada 1:1; przy L tylko dopisek „narożnik – dolicz zakładkę na łączenie blatów”. Grubość blatu nigdzie nie jest liczona (nazwa z katalogu `countertop`; `findMaterial(...).thicknessMm` istnieje w katalogu).
- **Waterfall** wejdzie tu: `blatyPlanu()` → dodatkowa formatka „bok waterfall” (wys. × gł. blatu, gr. blatu) + uwaga o 45°; w 3D pionowa płyta przy boku skrajnej szafki ciągu.
- **Rozbieżność wysokości do wyjaśnienia:** w 3D szafka `h=72` stoi na podłodze (blat na 72 cm, bez cokołu), a rozkrój traktuje `h` jako korpus i dolicza nóżki 100 mm. Wysokość boku waterfall: proponuję `h_korpusu + nóżki + 0` (do spodu blatu) = dopisane w formatce jako „do podłogi: X mm, sprawdź na pomiarze”. Do potwierdzenia z Kubą.

## 4. Ceny i gdzie je wyłączyć
- Jedna ścieżka: `lib/cenaKoncowa.ts` → `sumaMebli`/`cenaPozycji` (`kuchnia.ts:976`) → `modulCena` (`lib/modul.ts`: baza + płyta m² + front m² + mb) + `doplataWnetrza` (szuflady, drążki). Serwer nadpisuje `base` (`functions/_lib/kuchnia.ts`). Tryby: `ceny: "cennik" | "reczne"`, `cenaOgolna`, `doplaty`.
- Okucia w cenie: dziś tylko szuflady (`cennik.szuflada`) i drążki; katalog firmy ma kategorię `prowadnica` (`katalogFirmy.ts:22`) — cargo/LeMans/typ prowadnic dojdą jako dopłata wnętrza (`doplataWnetrza`) z kwot w cenniku z domyślnymi, i jako pozycje okuć w formatkach.
- Ukrywanie cen istnieje tylko dla **linku klienta** (`link.showPrice`, `functions/_lib/offers.ts:524`, `OfferView`, `MaterialsPanel`). Dokument produkcyjny (`dokument.ts`) **już jest bez cen**.
- **„Bez cen”**: pole `plan.bezCen?: boolean` (parser), przełącznik w kroku oferty; `ofertaPdf.ts` `danePdf` → pozycje bez kwot i bez sumy; Produkcja/CSV — nowy format hurtowni + zestawienie okleiny i okuć. Cena dalej liczy się na serwerze (base), tylko się nie wyświetla.

## 5. Pliki do zmiany i ryzyka
| Plik | Zmiana |
|---|---|
| `src/lib/kuchnia.ts` | rodzaje `cargo`, `lemans`; pola `hinge`, `prowadnice`, `lemans{strona, blenda}`, `waterfall`; `plan.bezCen`; presety; `limityRodzaju`; parser; etykiety/skróty |
| `src/lib/wnetrze.ts` | `zawiasLewy()`; kategoria/wnętrze cargo i LeMans (bez półek); dopłata okuć |
| `src/components/kuchnia/MebelParametryczny.tsx` | strona zawiasu; geometria cargo (kosze 2 / 5–6 poziomów, front na prowadnicach), LeMans (blenda, „nerka” z obrotem) — własna prosta geometria three.js |
| `src/components/kuchnia/AgdBryla.tsx` | blat: grubość parametrem; waterfall |
| `src/components/kuchnia/RzutKuchni.tsx` | symbol cargo/LeMans/waterfall na rzucie |
| `src/components/rysunek/rysunekTechniczny.ts` | `zawiasLewy` wspólne; LeMans (blenda) i waterfall w widoku |
| `src/components/produkcja/formatki.ts` | cargo, słupek cargo, LeMans, waterfall, typ prowadnic w okuciach |
| `src/components/produkcja/dokument.ts`, `Produkcja.tsx` | CSV hurtowni (`materiał;grubość;długość;szerokość;ilość;okleina_dł1;okleina_dł2;okleina_szer1;okleina_szer2;słoje;opis`), mb okleiny per materiał, liczba formatek/cięć, okucia, „jak liczony bok/dno” |
| `src/components/panel/KreatorWlasciwosci.tsx`, `KreatorBiblioteka.tsx`, `KreatorWnetrze.tsx` | przełącznik L/P, typ prowadnic, LeMans, waterfall, ostrzeżenie kolizji LeMans |
| `src/components/panel/ofertaPdf.ts`, `KreatorApp.tsx` | tryb „bez cen”, pozycja okuć (wysuwy) z ilością |
| `src/lib/opcjeProjektu.ts` | cargo/LeMans → grupy front + okucia |
| `package.json` + `src/**/*.test.ts` | runner `node --test` + `tsx` (po zgodzie) |

**Ryzyka**
1. **Stare oferty w KV:** odczyt oferty nie przechodzi przez parser (`offers.ts:521` zwraca `o.kuchnia` jak zapisano), więc wszystkie nowe pola muszą być opcjonalne z obecnym zachowaniem jako domyślnym. Test: parsowanie i render planu sprzed zmian (fixture z E2E / seed) bez różnic w formatkach.
2. **Nowe rodzaje a stara wersja kodu:** oferta z `cargo`/`lemans` zapisana po deployu nie otworzy się na starszym buildzie (rollback) — `jedno(e.rodzaj, RODZAJE)` rzuci błąd. Alternatywa: cargo = `szafka` + `wnetrze.cargo` (stare buildy pokażą zwykłą szafkę). Rekomenduję **nowe rodzaje** (czytelniej), rollback akceptowalny — do decyzji Pawła.
3. **Duplikacja logiki zawiasu** (3D vs rysunek) — wspólna funkcja, inaczej rozjazd trójkąta i animacji.
4. **Kolizje LeMans:** `konfliktElementow` liczy prostokąty; ślepa część LeMans w L stoi przed sąsiednim ciągiem bez nakładania — nowa kontrola: szafka prostopadła nie może wchodzić w część z frontem (ostrzeżenie, nie blokada zapisu, żeby stare plany przechodziły).
5. **Ceny:** nowe dopłaty (kosz cargo, mechanizm LeMans, typ prowadnic) zmienią `base` tylko dla nowych elementów; brak pól = 0 zł dopłaty → stare oferty bez zmian kwot.
6. **Równoległe K3D-PLYTY-01:** nie ruszam `katalogFirmy.ts`/materiałów; grubość blatu biorę z `findMaterial("countertop").thicknessMm ?? 28` jako parametr.
7. **Wydajność 3D:** kosze cargo i LeMans jako kilka `Box` na mebel (instancjonowane materiały jak dziś); pomiar FPS ~12 szafek przed/po.
8. **Git:** prompt chce autora `pawel799` i brak wzmianek o Claude w commitach — stosuję się do tego (bez stopki Co-Authored-By).

## Pytania do Pawła (przed ETAPEM 2)
1. Gałąź: `feat/meble-cargo-lemans` lokalnie + .zip, czy push na gałąź sesji?
2. Zgoda na `tsx` (devDependency) do testów jednostkowych `node --test`?
3. Nowe rodzaje `cargo`/`lemans` (rekomendacja) czy wariant przez `wnetrze` (zgodny z rollbackiem)?
4. Wysokość boku waterfall: do podłogi z nóżkami (realnie ~820 + blat) czy wg 3D (h)?
