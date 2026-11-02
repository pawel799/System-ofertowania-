"use client";

/*
 * Bieżący wybór klienta na stronie oferty: opis kolorów / materiałów i szacunek ceny z paska materiałów
 * (MaterialsPanel go publikuje). Czyta go akceptacja oferty i informacja „klient zmienia kolory” dla firmy.
 */
import { useSyncExternalStore } from "react";

export type WyborKlienta = { opis: string; kwota: number | null };

let stan: WyborKlienta = { opis: "", kwota: null };
const sluchacze = new Set<() => void>();

export function ustawWyborKlienta(w: WyborKlienta) {
  if (w.opis === stan.opis && w.kwota === stan.kwota) return;
  stan = w;
  sluchacze.forEach((f) => f());
}

export const getWyborKlienta = () => stan;

export function useWyborKlienta() {
  return useSyncExternalStore(
    (f) => {
      sluchacze.add(f);
      return () => sluchacze.delete(f);
    },
    () => stan,
    () => stan,
  );
}
