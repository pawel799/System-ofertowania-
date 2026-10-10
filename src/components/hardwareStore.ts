import { useSyncExternalStore } from "react";
import { HARDWARE } from "./catalog";

/*
 * Wybrane okucia – ten sam wzorzec co frontStore.ts i countertopStore.ts.
 */

export { HARDWARE, type HardwareOption } from "./catalog";

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
