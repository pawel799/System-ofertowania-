/*
 * Katalog materiałów: fronty, blaty, okucia z dopłatami.
 * Zwykły moduł bez Reacta – mogą go używać i komponenty, i kod serwerowy
 * (mail z ofertą, Pages Functions w functions/). Magazyny stanu (*Store.ts)
 * go re-eksportują, a walidacja API (functions/_lib/offers.ts) bierze z niego id.
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

export type HardwareOption = {
  id: string;
  name: string;
  /** Dopłata w zł (0 = w cenie). */
  delta: number;
};

export const HARDWARE: HardwareOption[] = [
  { id: "mosiadz", name: "Mosiądz", delta: 0 },
  { id: "czarny-mat", name: "Czarny mat", delta: 0 },
  { id: "push-to-open", name: "Push-to-open", delta: 0 },
];
