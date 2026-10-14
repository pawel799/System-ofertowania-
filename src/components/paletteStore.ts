import { useSyncExternalStore } from "react";
import type { Palette } from "./palettes";

/*
 * Pakiety RAL widoczne na stronie (panel albo oferta klienta) – magazyn na poziomie
 * modułu, jak frontStore: pasek materiałów, cena i scena 3D czytają te same dane.
 */

let palettes: Palette[] = [];
const listeners = new Set<() => void>();
const EMPTY: Palette[] = [];

export function getPalettes() {
  return palettes;
}

export function setPalettes(next: Palette[]) {
  palettes = next;
  listeners.forEach((l) => l());
}

export function subscribePalettes(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePalettes() {
  return useSyncExternalStore(subscribePalettes, getPalettes, () => EMPTY);
}
