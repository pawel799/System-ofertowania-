"use client";

/*
 * Historia zmian planu w kreatorze: Ctrl+Z cofa, Ctrl+Shift+Z / Ctrl+Y ponawia.
 * Każde setPlan, które naprawdę coś zmienia, to jeden krok. Kilka setPlan w tej samej chwili (jedna akcja
 * użytkownika, np. operacja w kreatorze ścian) łączy się w jeden krok. reset() – wczytanie oferty, bez historii.
 */
import { useCallback, useRef, useState, type SetStateAction } from "react";

const MAX_KROKOW = 100;
/** Zmiany szybciej niż co tyle ms to jedna akcja. */
const SCAL_MS = 40;

type Stan<T> = { teraz: T; wstecz: T[]; naprzod: T[]; t: number };

const rowne = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/**
 * walidacja – strażnik zmian: zwraca komunikat, gdy zmiana jest niedozwolona (np. mebel za ścianą); wtedy plan
 * zostaje bez zmian, a onOdrzucone dostaje komunikat (raz – updater Reacta może się wykonać dwa razy).
 * normalizuj – poprawka każdej nowej wartości (start, setPlan, reset), np. domyślny pokój-prostokąt.
 */
export function useHistoria<T>(start: () => T, opcje: { walidacja?: (stary: T, nowy: T) => string | null; onOdrzucone?: (komunikat: string) => void; normalizuj?: (v: T) => T } = {}) {
  const [stan, setStan] = useState<Stan<T>>(() => ({ teraz: opcje.normalizuj ? opcje.normalizuj(start()) : start(), wstecz: [], naprzod: [], t: 0 }));
  const opcjeRef = useRef(opcje);
  opcjeRef.current = opcje;
  const odrzucone = useRef<string | null>(null);

  const ustaw = useCallback((next: SetStateAction<T>) => {
    setStan((s) => {
      const surowa = typeof next === "function" ? (next as (p: T) => T)(s.teraz) : next;
      const v = opcjeRef.current.normalizuj ? opcjeRef.current.normalizuj(surowa) : surowa;
      if (rowne(v, s.teraz)) return s;
      const blad = opcjeRef.current.walidacja?.(s.teraz, v) ?? null;
      if (blad) {
        if (odrzucone.current === null) {
          odrzucone.current = blad;
          queueMicrotask(() => {
            const k = odrzucone.current;
            odrzucone.current = null;
            if (k) opcjeRef.current.onOdrzucone?.(k);
          });
        }
        return s;
      }
      const t = Date.now();
      const scal = t - s.t < SCAL_MS && s.wstecz.length > 0;
      return { teraz: v, wstecz: scal ? s.wstecz : [...s.wstecz, s.teraz].slice(-MAX_KROKOW), naprzod: [], t };
    });
  }, []);

  const reset = useCallback((v: T) => setStan({ teraz: opcjeRef.current.normalizuj ? opcjeRef.current.normalizuj(v) : v, wstecz: [], naprzod: [], t: 0 }), []);

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
