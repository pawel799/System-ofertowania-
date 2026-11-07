"use client";

/*
 * Historia zmian planu w kreatorze: Ctrl+Z cofa, Ctrl+Shift+Z / Ctrl+Y ponawia.
 * Każde setPlan, które naprawdę coś zmienia, to jeden krok. Kilka setPlan w tej samej chwili (jedna akcja
 * użytkownika, np. operacja w kreatorze ścian) łączy się w jeden krok. reset() – wczytanie oferty, bez historii.
 */
import { useCallback, useState, type SetStateAction } from "react";

const MAX_KROKOW = 100;
/** Zmiany szybciej niż co tyle ms to jedna akcja. */
const SCAL_MS = 40;

type Stan<T> = { teraz: T; wstecz: T[]; naprzod: T[]; t: number };

const rowne = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

export function useHistoria<T>(start: () => T) {
  const [stan, setStan] = useState<Stan<T>>(() => ({ teraz: start(), wstecz: [], naprzod: [], t: 0 }));

  const ustaw = useCallback((next: SetStateAction<T>) => {
    setStan((s) => {
      const v = typeof next === "function" ? (next as (p: T) => T)(s.teraz) : next;
      if (rowne(v, s.teraz)) return s;
      const t = Date.now();
      const scal = t - s.t < SCAL_MS && s.wstecz.length > 0;
      return { teraz: v, wstecz: scal ? s.wstecz : [...s.wstecz, s.teraz].slice(-MAX_KROKOW), naprzod: [], t };
    });
  }, []);

  const reset = useCallback((v: T) => setStan({ teraz: v, wstecz: [], naprzod: [], t: 0 }), []);

  const cofnij = useCallback(() => {
    setStan((s) => {
      if (!s.wstecz.length) return s;
      return { teraz: s.wstecz[s.wstecz.length - 1], wstecz: s.wstecz.slice(0, -1), naprzod: [s.teraz, ...s.naprzod], t: 0 };
    });
  }, []);

  const ponow = useCallback(() => {
    setStan((s) => {
      if (!s.naprzod.length) return s;
      return { teraz: s.naprzod[0], wstecz: [...s.wstecz, s.teraz], naprzod: s.naprzod.slice(1), t: 0 };
    });
  }, []);

  return { wartosc: stan.teraz, ustaw, reset, cofnij, ponow, moznaCofnac: stan.wstecz.length > 0, moznaPonowic: stan.naprzod.length > 0 };
}
