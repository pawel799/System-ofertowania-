import { useSyncExternalStore } from "react";

/*
 * Wybrany blat – ten sam wzorzec co frontStore.ts: MaterialsPanel i scena 3D
 * są osobnymi komponentami na stronie, więc dzielą stan przez moduł.
 */

export type CountertopOption = {
  id: string;
  name: string;
  /** Dopłata w zł (0 = w cenie). */
  delta: number;
};

export const COUNTERTOPS: CountertopOption[] = [
  { id: "kwarcyt-calacatta", name: "Kwarcyt Calacatta", delta: 0 },
  { id: "granit-absolute-black", name: "Granit Absolute Black", delta: 1_200 },
  { id: "laminat-dab", name: "Laminat dąb", delta: -800 },
];

export const DEFAULT_COUNTERTOP_ID = COUNTERTOPS[0].id;

let currentCountertop: string = DEFAULT_COUNTERTOP_ID;
const countertopListeners = new Set<() => void>();

export function getCountertop() {
  return currentCountertop;
}

export function setCountertop(id: string) {
  if (id === currentCountertop) return;
  currentCountertop = id;
  countertopListeners.forEach((listener) => listener());
}

export function subscribeCountertop(listener: () => void) {
  countertopListeners.add(listener);
  return () => {
    countertopListeners.delete(listener);
  };
}

/** Aktualnie wybrany blat (komponent odświeża się przy każdej zmianie). */
export function useCountertop() {
  return useSyncExternalStore(
    subscribeCountertop,
    getCountertop,
    () => DEFAULT_COUNTERTOP_ID, // render na serwerze
  );
}
