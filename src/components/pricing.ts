import { COUNTERTOPS, FRONTS, HARDWARE } from "./catalog";
import { findRalFront, type Palette } from "./palettes";

/*
 * Wspólny cennik: używa go pasek materiałów na stronie oferty (MaterialsPanel)
 * i panel ofert (/panel), żeby obie strony liczyły kwotę tak samo.
 */

/** Cena bazowa kuchni demo (netto, bez AGD). */
export const BASE_PRICE = 24_900;

const NBSP = " ";

// Polski zapis kwot: spacja (nierozdzielająca) co 3 cyfry, np. "24 900 zł", "1 200 zł".
// Intl.NumberFormat("pl-PL") nie grupuje liczb 4-cyfrowych ("1200"), dlatego
// grupujemy ręcznie – tak samo na serwerze i w przeglądarce.
export function formatPln(value: number) {
  const digits = Math.abs(Math.round(value))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${value < 0 ? "−" : ""}${digits}${NBSP}zł`;
}

/**
 * Kwota netto: cena bazowa + dopłaty za front, blat i okucia.
 * palettes: pakiety RAL, gdy front pochodzi z pakietu ("ral:…") – wtedy dopłata pakietu.
 */
export function totalPrice(
  selection: { front: string; countertop: string; hardware: string },
  base: number = BASE_PRICE,
  palettes: Palette[] = [],
) {
  return (
    base +
    (FRONTS.find((f) => f.id === selection.front)?.delta ?? findRalFront(palettes, selection.front)?.delta ?? 0) +
    (COUNTERTOPS.find((c) => c.id === selection.countertop)?.delta ?? 0) +
    (HARDWARE.find((h) => h.id === selection.hardware)?.delta ?? 0)
  );
}
