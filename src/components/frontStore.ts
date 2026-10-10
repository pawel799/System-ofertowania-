import { useSyncExternalStore } from "react";
import { FRONTS } from "./catalog";

/*
 * Wybrany front kuchni – mały magazyn stanu na poziomie modułu.
 * MaterialsPanel (wybór próbki) i scena 3D (podmiana materiału) to osobne
 * komponenty na stronie, więc dzielą stan przez ten moduł zamiast przez propsy.
 */

export { FRONTS, type FrontSwatch } from "./catalog";

export const DEFAULT_FRONT_ID = FRONTS[0].id;

let currentFront: string = DEFAULT_FRONT_ID;
const frontListeners = new Set<() => void>();

export function getFront() {
  return currentFront;
}

export function setFront(id: string) {
  if (id === currentFront) return;
  currentFront = id;
  frontListeners.forEach((listener) => listener());
}

export function subscribeFront(listener: () => void) {
  frontListeners.add(listener);
  return () => {
    frontListeners.delete(listener);
  };
}

/** Aktualnie wybrany front (komponent odświeża się przy każdej zmianie). */
export function useFront() {
  return useSyncExternalStore(
    subscribeFront,
    getFront,
    () => DEFAULT_FRONT_ID, // render na serwerze
  );
}
