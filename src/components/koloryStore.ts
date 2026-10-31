import { useSyncExternalStore } from "react";
import type { KoloryProjektu } from "@/lib/kolory";

/*
 * Wspólne kolory boków i środka mebli (front ma własny magazyn – frontStore.ts).
 * Pusty = „jak fronty” (boki) / „jak boki” (środek). Kolory pojedynczych mebli są w planie (element.kolory).
 * Scena 3D i pasek materiałów to osobne komponenty, więc dzielą stan przez ten moduł (jak front, blat i okucia).
 */

let stan: KoloryProjektu = {};
const sluchacze = new Set<() => void>();

export const getKoloryProjektu = () => stan;

export function setKoloryProjektu(k: KoloryProjektu | null | undefined) {
  const nowy: KoloryProjektu = { ...(k?.korpus ? { korpus: k.korpus } : {}), ...(k?.srodek ? { srodek: k.srodek } : {}) };
  if (nowy.korpus === stan.korpus && nowy.srodek === stan.srodek) return;
  stan = nowy;
  sluchacze.forEach((l) => l());
}

const subskrybuj = (l: () => void) => {
  sluchacze.add(l);
  return () => {
    sluchacze.delete(l);
  };
};

const PUSTE: KoloryProjektu = {};
export function useKoloryProjektu() {
  return useSyncExternalStore(subskrybuj, getKoloryProjektu, () => PUSTE);
}
