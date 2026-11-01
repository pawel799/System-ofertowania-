# Motyw jasny i ciemny

Przełącznik (ikona słońca / księżyca) jest na stronie (pasek u góry, na stronie głównej także w hero), na stronie oferty klienta (obok „Umów pomiar”) i w panelu (pasek u góry: oferty, kreator, zgłoszenia, ustawienia). Wybór zapisuje się w przeglądarce (`localStorage` „motyw”) i obowiązuje wszędzie w tej domenie.

Bez wyboru wszystko wygląda jak dotąd: strona i oferta ciemne, panel według ustawień systemu.

## Jak to działa

- `src/lib/motywSkrypt.ts` – skrypt w `<head>` (`layout.tsx`) ustawia `<html data-motyw="jasny|ciemny">` przed pierwszym malowaniem (bez mignięcia). `src/lib/motyw.ts` – `useMotyw()`, `ustawMotyw()`; `PrzelacznikMotywu.tsx` – przycisk.
- Strona i oferta: kolory Tailwinda `stone`, `neutral`, `red`, `white`, `black` oraz `tlo` (#0c0b0a) i `tlo2` (#141311) idą przez zmienne `--k-*` (`tailwind.config.ts`, `globals.css`). Domyślne wartości = zwykła paleta.
  - `data-strona="ciemna"` (strona główna, podstrony, 404, oferta klienta, osadzenie, PIN) – w jasnym motywie skala jest odwrócona: jasne tło, ciemny tekst, ciemne przyciski „solid”.
  - `data-wyspa` – elementy jasne także w ciemnym motywie (pasek materiałów i ceny, okno zgłoszenia, wybór koloru ścian): zostają przy zwykłej palecie.
  - `data-strona="jasna"` (kalkulator modułu na wymiar) – w ciemnym motywie odwrócony.
  - Logo strony jest wstawione jako SVG (`Logo.tsx`), więc w jasnym motywie jest ciemne.
- Sceny 3D: w jasnym motywie zawsze jasne „studio” (`tloMotywu` w `tloSceny.ts`; kuchnia z kreatora, model GLB, wgrany model, scena na stronie głównej). Kalkulator modułu w ciemnym – ciemne tło.
- Panel: zmienne `.pnl` w `panel.css` – ciemne przy `data-motyw="ciemny"` albo przy ciemnym systemie bez wyboru jasnego.

## Kontrast tekstu (WCAG AA, 4,5:1)

Sprawdzone axe-core (reguła color-contrast) w 55 widokach: wszystkie strony, oferta klienta (także okno zgłoszenia i kolor ścian), oferta demo, panel, zgłoszenia, ustawienia i kreator – motyw domyślny (system ciemny i jasny), jasny i ciemny. Wynik: 0 elementów z za małym kontrastem. Poprawione przy okazji:

- szary tekst `stone-500` na ciemnej stronie (#78716c na #0c0b0a = 4,1) – na ciemnych stronach jaśniejszy odcień (#8f8984), na jasnych wyspach bez zmian;
- panel: `--text-3` (numery ofert, okruszki, podpowiedzi) – jasny #8d8e98 → #62636c, ciemny #6f707a → #8a8b95;
- panel: napis „Przytrzymaj…” na czerwonym w ciemnym motywie – ciemny tekst zamiast białego.
