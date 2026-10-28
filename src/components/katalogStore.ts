import { useSyncExternalStore } from "react";
import type { KatalogPozycja, MaterialySnapshot } from "./katalogFirmy";

/*
 * Katalog materiałów firmy i snapshot materiałów oferty – magazyn na poziomie modułu (jak paletteStore):
 * pasek materiałów, cena i scena 3D czytają te same dane. Panel ładuje katalog z /api/katalog,
 * strona klienta z /api/public/:slug (razem ze snapshotem).
 */
type Stan = { katalog: KatalogPozycja[]; snapshot: MaterialySnapshot | null };

let stan: Stan = { katalog: [], snapshot: null };
const listeners = new Set<() => void>();
const PUSTY: Stan = { katalog: [], snapshot: null };

const emit = () => listeners.forEach((l) => l());

export function getKatalog() {
  return stan.katalog;
}
export function getSnapshot() {
  return stan.snapshot;
}
export function setKatalog(katalog: KatalogPozycja[]) {
  stan = { ...stan, katalog };
  emit();
}
export function setSnapshotMaterialow(snapshot: MaterialySnapshot | null) {
  stan = { ...stan, snapshot };
  emit();
}
export function subscribeKatalog(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
const getStan = () => stan;
export function useKatalogStan() {
  return useSyncExternalStore(subscribeKatalog, getStan, () => PUSTY);
}
export function useKatalog() {
  return useKatalogStan().katalog;
}
