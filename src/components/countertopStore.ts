import { useSyncExternalStore } from "react";
import { COUNTERTOPS } from "./catalog";

/*
 * Wybrany blat – ten sam wzorzec co frontStore.ts: MaterialsPanel i scena 3D
 * są osobnymi komponentami na stronie, więc dzielą stan przez moduł.
 */

export { COUNTERTOPS, type CountertopOption } from "./catalog";

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
