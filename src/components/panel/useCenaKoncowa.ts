"use client";

/*
 * Hook ceny końcowej oferty z kreatora: meble + dodatki z cennika + dopłaty za wybrane materiały.
 * Liczy cenaKoncowa (src/lib/cenaKoncowa.ts) – tę samą funkcję co PDF i serwer – z bieżącym wyborem materiałów,
 * tylko dla grup, które projekt ma (szafa bez blatu nie dolicza blatu).
 */
import { useMemo } from "react";
import { cenaKoncowa, type CenaKoncowa } from "@/lib/cenaKoncowa";
import type { PlanKuchni } from "@/lib/kuchnia";
import type { ModulCennik } from "@/lib/modul";
import type { GrupyMaterialow } from "@/lib/opcjeProjektu";
import { findMaterial, type KontekstMaterialow } from "../katalogFirmy";
import { formatPln } from "../pricing";

export type WyborMaterialow = { front: string; countertop: string; hardware: string };

/** Dopłaty za materiały do rozbicia ceny (nazwa + kwota), bez grup, których projekt nie ma. */
export function doplatyMaterialow(wybor: WyborMaterialow, grupy: GrupyMaterialow, ctx: KontekstMaterialow) {
  const out: { klucz: string; nazwa: string; kwota: number }[] = [];
  const dodaj = (klucz: string, etykieta: string, m: { name: string; delta: number } | undefined) => {
    if (m?.delta) out.push({ klucz, nazwa: `${etykieta}: ${m.name}`, kwota: m.delta });
  };
  if (grupy.front) dodaj("front", "Fronty", findMaterial("front", wybor.front, ctx));
  if (grupy.blat) dodaj("blat", "Blat", findMaterial("countertop", wybor.countertop, ctx));
  if (grupy.okucia) dodaj("okucia", "Okucia", findMaterial("hardware", wybor.hardware, ctx));
  return out;
}

export function useCenaKoncowa(args: {
  plan: PlanKuchni;
  cennik: ModulCennik;
  wybor: WyborMaterialow;
  grupy: GrupyMaterialow;
  materialy: KontekstMaterialow;
}): CenaKoncowa {
  const { plan, cennik, wybor, grupy, materialy } = args;
  const { front, countertop, hardware } = wybor;
  const { palettes, katalog, snapshot } = materialy;
  return useMemo(
    () =>
      cenaKoncowa({
        plan,
        cennik,
        doplaty: doplatyMaterialow({ front, countertop, hardware }, grupy, { palettes, katalog, snapshot }),
        zl: formatPln,
      }),
    [plan, cennik, front, countertop, hardware, grupy, palettes, katalog, snapshot],
  );
}
