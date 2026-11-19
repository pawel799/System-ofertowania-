# K3D-MEBLE-02 – prompt kontynuacji

Czytaj najpierw: `kitchen3d-plan/prompty/PROMPT_2_nowe_meble.md` (zasady i definicja gotowego), `.krn/runs/K3D-MEBLE-02/recon.md`, `git log --oneline main..feat/meble-cargo-lemans`.

## Zgody i zakazy Pawła (dosłownie)
- Gałąź lokalna `feat/meble-cargo-lemans`, wynik jako paczka .zip, **bez pusha**. Nie dotykać `main`.
- Zgoda na `tsx` jako devDependency i `node --test` (`npm test`).
- Cargo i LeMans jako nowe typy szafek (rollback deployu nie jest planowany).
- Waterfall: bok od podłogi do spodu blatu (nóżki + korpus z ustawień, typowo 100 + 720 = 820 mm), blat osobno. Do potwierdzenia z Kubą (stolarz).
- Z promptu: bez modeli/zdjęć/logo producentów okuć (Blum, Hettich, Rehau, Kesseböhmer, GTV), nazwy tylko opisowo („typu LeMans”); bez nowych płatnych usług i ciężkich zależności; sekrety nigdy w repo/logach; git: autor pawel799, bez wzmianek o Claude/Anthropic, bez force, bez `--no-verify`; bez deployu; nie zmieniać plików materiałów/płyt (K3D-PLYTY-01) – wyjątek: 2 linie w `src/lib/kolory.ts` (części cargo/LeMans) i `gruboscBlatu` w `produkcja/zrodloOferty.ts`.

## Stan (commity na feat/meble-cargo-lemans)
1. `27b5994` strona zawiasu (hinge L/P) – wnetrze.ts `zawiasLewy`, `jednoSkrzydlo`; panel `KreatorOpcjeMebla.tsx`.
2. `83e18ea` cargo dolne + wysokie (kroki 2 i 3 w jednym commicie) – `lib/okucia.ts`, `kuchnia/MebelOkucia.tsx` (CargoBryla), formatki `cargo()`.
3. `630dfcb` LeMans – `lib/lemans.ts`, `ostrzezeniaLemans`, LemansBryla, formatki `lemans()`.
4. `342cc32` waterfall – `ostrzezeniaWaterfall`, Blat w AgdBryla, `blatyPlanu` (boki), `UstawieniaFormatek.nozki`.
Testy: `npm test` (16 zielonych). Pomiar przed: `.krn/runs/K3D-MEBLE-02/pomiar-przed.md`. Narzędzia: `narzedzia/fps.mjs`, `zrzut.mjs`, `plany.ts`.

## Dalej (w tej kolejności)
6. Wysuwy: pole `prowadnice` (rolkowe/kulkowe/ukryte) dla szuflad i cargo; okucia oferty już liczą to w `okuciaElementu` (brak pola = stara cena przez `cennik.szuflada`); dopisać: pole w ElementKuchni + parser, wybór w panelu, `cenaElementu` bez dopłaty `szuflada` przy wybranym typie, nazwa prowadnic w formatkach, wiersze okuć w PDF oferty (`ofertaPdf.ts`: dziś `razem` zawiera okucia, a tabela ich nie pokazuje – do naprawy), ceny okuć w cenniku (CennikTab + `functions/_lib/modul.ts` – pole `okucia`).
7. Tryb „bez cen”: `plan.bezCen` (parser), przełącznik oferty; PDF oferty bez kwot; CSV hurtowni `materiał;grubość;długość;szerokość;ilość;okleina_dł1;okleina_dł2;okleina_szer1;okleina_szer2;słoje;opis`, okleina mb per materiał, liczba formatek/cięć, okucia; w UI wzór boku/dna (dno = W − 2×18).
Potem: build, pomiar po (FPS desktop/telefon, `out/`), zrzuty nowych szafek do `.krn/runs/K3D-MEBLE-02/zrzuty/`, niezależne review (świeży subagent read-only, folder `.krn/review/K3D-MEBLE-02-r1/`, BLOCKER/ERROR/OK), raport `raport.md`, paczka .zip (`OPIS.txt`, `zmiany.diff` od main, `pliki/`).

## Ryzyka / nie powtarzać
- `useMaterialyMebla`: każdy materiał zwalniany w osobnym efekcie (wspólny dispose psuł front).
- Metaliczny chrom bez envMap renderuje się czarno – kosze mają materiał `useDrut`.
- W skrypcie zrzutów obrót kamery zaczynać na podłodze (przeciąganie mebla!). Dev server: `npx next dev -p 3100`.
- Stara oferta: wszystkie nowe pola opcjonalne; test parsera „stary plan bez zmian”.
