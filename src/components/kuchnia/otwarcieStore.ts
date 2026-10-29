import { useSyncExternalStore } from "react";

/*
 * Otwarte drzwi i szuflady w scenie 3D (kreator, strona klienta). Przycisk „Otwórz drzwi i szuflady”
 * przełącza wszystko; dwuklik na meblu przełącza tylko ten jeden (odwrotnie niż reszta).
 */
type Stan = { wszystkie: boolean; inne: ReadonlySet<string> };

let stan: Stan = { wszystkie: false, inne: new Set() };
const sluchacze = new Set<() => void>();
const emit = () => sluchacze.forEach((l) => l());
const PUSTY: Stan = { wszystkie: false, inne: new Set() };

export function przelaczWszystkie(na?: boolean) {
  stan = { wszystkie: na ?? !stan.wszystkie, inne: new Set() };
  emit();
}

export function przelaczElement(id: string) {
  const inne = new Set(stan.inne);
  if (inne.has(id)) inne.delete(id);
  else inne.add(id);
  stan = { ...stan, inne };
  emit();
}

const subskrybuj = (l: () => void) => {
  sluchacze.add(l);
  return () => {
    sluchacze.delete(l);
  };
};
const pobierz = () => stan;

export function useOtwarcie() {
  return useSyncExternalStore(subskrybuj, pobierz, () => PUSTY);
}

export const otwarty = (s: Stan, id: string) => s.wszystkie !== s.inne.has(id);
