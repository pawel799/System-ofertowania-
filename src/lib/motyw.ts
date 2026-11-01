"use client";

/*
 * Motyw jasny / ciemny dla całej aplikacji (strona, oferta klienta, panel).
 * Wybór zapisuje się w przeglądarce (localStorage „motyw”) i ląduje w <html data-motyw="jasny|ciemny">
 * jeszcze przed malowaniem (skrypt w layout.tsx – bez mignięcia). Bez wyboru wszystko wygląda jak dotąd:
 * strona i oferta ciemne, panel według ustawień systemu.
 *
 * Kolory: zmienne --k-* w globals.css (Tailwind: stone, neutral, red, white, black, tlo, tlo2) – w jasnym motywie
 * ciemne strony (data-strona="ciemna") dostają odwróconą skalę, jasne wyspy (data-wyspa) zostają jasne.
 * Panel: zmienne .pnl w panel.css.
 */
import { useSyncExternalStore } from "react";

export type Motyw = "jasny" | "ciemny";
import { KLUCZ_MOTYWU as KLUCZ } from "./motywSkrypt";


const sluchacze = new Set<() => void>();

function odczyt(): Motyw | null {
  if (typeof document === "undefined") return null;
  const m = document.documentElement.getAttribute("data-motyw");
  return m === "jasny" || m === "ciemny" ? m : null;
}

export function ustawMotyw(m: Motyw) {
  document.documentElement.setAttribute("data-motyw", m);
  try {
    localStorage.setItem(KLUCZ, m);
  } catch {
    /* tryb prywatny – motyw tylko do końca wizyty */
  }
  sluchacze.forEach((f) => f());
}

/** Wybrany motyw (null = nie wybrano, obowiązuje domyślny wygląd danego miejsca). */
export function useMotyw(): Motyw | null {
  return useSyncExternalStore(
    (f) => {
      sluchacze.add(f);
      const zInnejKarty = (e: StorageEvent) => {
        if (e.key !== KLUCZ) return;
        if (e.newValue === "jasny" || e.newValue === "ciemny") document.documentElement.setAttribute("data-motyw", e.newValue);
        f();
      };
      window.addEventListener("storage", zInnejKarty);
      return () => {
        sluchacze.delete(f);
        window.removeEventListener("storage", zInnejKarty);
      };
    },
    odczyt,
    () => null,
  );
}

/** Jasny motyw na stronie i w ofercie (domyślnie ciemne). */
export const useJasnaStrona = () => useMotyw() === "jasny";
