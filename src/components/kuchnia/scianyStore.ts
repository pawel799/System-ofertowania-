import { useSyncExternalStore } from "react";

/*
 * Ściany w scenie 3D (kreator, strona klienta): widoczne albo schowane (przycisk jak „Otwórz drzwi i szuflady”)
 * i kolor. Kolor startowy przychodzi z planu (plan.sciany.kolor – ustawia firma w kreatorze), klient może go zmienić u siebie.
 */
type Stan = { widoczne: boolean; kolor: string | null };

let stan: Stan = { widoczne: true, kolor: null };
const sluchacze = new Set<() => void>();
const emit = () => sluchacze.forEach((l) => l());
const START: Stan = { widoczne: true, kolor: null };

export function przelaczSciany(na?: boolean) {
  stan = { ...stan, widoczne: na ?? !stan.widoczne };
  emit();
}

export function ustawKolorScian(kolor: string | null) {
  if (stan.kolor === kolor) return;
  stan = { ...stan, kolor };
  emit();
}

/** Nowy projekt / nowa oferta: ściany widoczne, kolor z planu. */
export function zresetujSciany(kolor: string | null | undefined) {
  stan = { widoczne: true, kolor: kolor ?? null };
  emit();
}

const subskrybuj = (l: () => void) => {
  sluchacze.add(l);
  return () => {
    sluchacze.delete(l);
  };
};

export function useSciany() {
  return useSyncExternalStore(subskrybuj, () => stan, () => START);
}
