import { useSyncExternalStore } from "react";

/*
 * Wybrany front kuchni – mały magazyn stanu na poziomie modułu.
 * MaterialsPanel (wybór próbki) i scena 3D (podmiana materiału) to osobne
 * komponenty na stronie, więc dzielą stan przez ten moduł zamiast przez propsy.
 */

export type FrontSwatch = {
  id: string;
  name: string;
  /** Kolor próbki w panelu. */
  color: string;
  /** Dopłata w zł (0 = w cenie). */
  delta: number;
};

// Lista frontów (przeniesiona z MaterialsPanel bez zmian, żeby scena 3D
// i panel korzystały z tych samych identyfikatorów).
export const FRONTS: FrontSwatch[] = [
  { id: "dab-naturalny", name: "Dąb naturalny", color: "#b8875a", delta: 0 },
  { id: "dab-bielony", name: "Dąb bielony", color: "#d8c7a8", delta: 0 },
  { id: "dab-wedzony", name: "Dąb wędzony", color: "#6b4a32", delta: 0 },
  { id: "kaszmir", name: "Kaszmir", color: "#c9bcaa", delta: 0 },
  { id: "grafit", name: "Grafit", color: "#3a3936", delta: 0 },
];

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
