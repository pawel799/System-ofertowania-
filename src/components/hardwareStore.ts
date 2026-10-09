import { useSyncExternalStore } from "react";

/*
 * Wybrane okucia – ten sam wzorzec co frontStore.ts i countertopStore.ts.
 */

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

export const DEFAULT_HARDWARE_ID = HARDWARE[0].id;

let currentHardware: string = DEFAULT_HARDWARE_ID;
const hardwareListeners = new Set<() => void>();

export function getHardware() {
  return currentHardware;
}

export function setHardware(id: string) {
  if (id === currentHardware) return;
  currentHardware = id;
  hardwareListeners.forEach((listener) => listener());
}

export function subscribeHardware(listener: () => void) {
  hardwareListeners.add(listener);
  return () => {
    hardwareListeners.delete(listener);
  };
}

/** Aktualnie wybrane okucia (komponent odświeża się przy każdej zmianie). */
export function useHardware() {
  return useSyncExternalStore(
    subscribeHardware,
    getHardware,
    () => DEFAULT_HARDWARE_ID, // render na serwerze
  );
}
