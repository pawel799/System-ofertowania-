"use client";

/*
 * Strona klienta: „Rysunek techniczny” – rzut z wymiarami i widoki ścian (rysunekTechniczny.ts) w nowym oknie,
 * do obejrzenia, wydruku albo zapisu jako PDF. Rysowany z planu oferty (bez kolorów wybranych przez klienta – to wymiary).
 */
import { useBrand } from "@/lib/brand";
import type { PlanKuchni } from "@/lib/kuchnia";
import { rysunekTechnicznyDokument } from "./rysunekTechniczny";

export default function PrzyciskRysunku({ plan, kod, tytul, className }: { plan: PlanKuchni; kod: string; tytul: string; className?: string }) {
  const brand = useBrand();
  const otworz = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const data = new Date().toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
    w.document.open();
    w.document.write(rysunekTechnicznyDokument(plan, { firma: brand.name, id: kod, tytul, data }));
    w.document.close();
  };
  return (
    <button type="button" className={className} onClick={otworz}>
      Rysunek techniczny
    </button>
  );
}
