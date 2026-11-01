import { deltaMaterialu, type KatalogPozycja, type MaterialySnapshot } from "./katalogFirmy";
import type { Palette } from "./palettes";
import type { GrupyMaterialow } from "@/lib/opcjeProjektu";
import { doplataKolorow, doplataUchwytow, type KoloryProjektu } from "@/lib/kolory";
import type { PlanKuchni } from "@/lib/kuchnia";

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
 * palettes: pakiety RAL („ral:…”); katalog: pozycje katalogu firmy („cat:…”);
 * snapshot: dopłaty zapisane w ofercie – mają pierwszeństwo, żeby link klienta nie zmieniał ceny po edycji katalogu.
 * grupy: które materiały oferta w ogóle ma (opcjeProjektu.ts) – np. szafa bez blatu nie dolicza dopłaty za blat.
 * plan + kolory: meble w różnych kolorach (fronty, boki, środek – kolory.ts) – dopłata za kolor według powierzchni.
 */
export function totalPrice(
  selection: { front: string; countertop: string; hardware: string },
  base: number = BASE_PRICE,
  palettes: Palette[] = [],
  extra: {
    katalog?: readonly KatalogPozycja[];
    snapshot?: MaterialySnapshot | null;
    grupy?: GrupyMaterialow;
    plan?: PlanKuchni | null;
    kolory?: KoloryProjektu | null;
  } = {},
) {
  const ctx = { palettes, katalog: extra.katalog, snapshot: extra.snapshot };
  const g = extra.grupy;
  const kolorowe = !g || g.front || g.korpus || g.srodek;
  const zaKolor = extra.plan?.elementy.length
    ? doplataKolorow(extra.plan.elementy, selection.front, extra.kolory ?? extra.plan.kolory, (id) => deltaMaterialu("front", id, ctx)).kwota
    : deltaMaterialu("front", selection.front, ctx);
  return (
    base +
    (kolorowe ? zaKolor : 0) +
    (!g || g.blat ? deltaMaterialu("countertop", selection.countertop, ctx) : 0) +
    (!g || g.okucia
      ? extra.plan?.elementy.length
        ? doplataUchwytow(extra.plan.elementy, selection.hardware, (id) => deltaMaterialu("hardware", id, ctx))
        : deltaMaterialu("hardware", selection.hardware, ctx)
      : 0)
  );
}
