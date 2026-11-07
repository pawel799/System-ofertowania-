"use client";

/*
 * Telefon: w panelu sam podgląd ofert – bez tworzenia (nowa oferta, kreator, rozkrój) i bez zmian w ofercie.
 * Ta sama szerokość co w CSS (.bez-telefonu w src/app/panel/panel.css).
 */
import { useEffect, useState } from "react";

export const TELEFON = "(max-width: 767px)";

export function useTelefon() {
  const [telefon, setTelefon] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(TELEFON);
    const on = () => setTelefon(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return telefon;
}
