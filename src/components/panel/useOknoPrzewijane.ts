"use client";

/*
 * Okna kreatora z własnym przewijaniem (Biblioteka modeli, okno elementu) na iPhonie.
 *
 * Safari na iOS nie przewija palcem listy w oknie, które właśnie wjechało z animacją (opacity + transform):
 * warstwa przewijania powstaje w trakcie animacji i nie łapie dotyku, dopóki coś nie przebuduje listy
 * (np. zmiana grupy w bibliotece). Dlatego lista dostaje overflow: auto dopiero po animacji
 * (atrybut data-przewijanie) – Safari tworzy wtedy warstwę od nowa, już na swoim miejscu.
 * Do tego strona pod oknem nie przewija się (gest nie „ucieka” do kreatora pod spodem).
 */
import { useEffect, useState } from "react";

/** Czas animacji .overlay/.modal w panel.css (250 ms) z zapasem. */
const PO_ANIMACJI = 300;

export function useOknoPrzewijane(open: boolean) {
  const [przewijanie, setPrzewijanie] = useState(false);
  useEffect(() => {
    if (!open) {
      setPrzewijanie(false);
      return;
    }
    const czas = window.setTimeout(() => setPrzewijanie(true), PO_ANIMACJI);
    const html = document.documentElement;
    const bylo = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      window.clearTimeout(czas);
      html.style.overflow = bylo;
    };
  }, [open]);
  return przewijanie;
}
