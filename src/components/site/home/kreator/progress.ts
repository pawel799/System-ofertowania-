/*
 * Postęp przewinięcia pokazu kreatora (0–1). Zwykła zmienna + subskrybenci:
 * scena 3D i kursor czytają ją w każdej klatce bez renderu Reacta,
 * a interfejs subskrybuje tylko zmiany zaokrąglone (patrz useStep w KreatorShow).
 */
let value = 0;
const listeners = new Set<(v: number) => void>();

export const getProgress = () => value;

export function setProgress(v: number) {
  if (v === value) return;
  value = v;
  listeners.forEach((l) => l(v));
}

export function subscribeProgress(l: (v: number) => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
