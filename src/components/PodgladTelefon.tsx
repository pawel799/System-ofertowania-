"use client";

import { useCallback, useEffect, useState } from "react";

/*
 * Telefon: „Otwórz podgląd” – oferta w poziomie, cała na jednym ekranie:
 * u góry cienki pasek (nazwa, „Umów pomiar”, cena, „Poproś o wycenę”), scena 3D na całą szerokość,
 * na dole jeden rząd materiałów.
 *
 * To ta sama strona (ta sama scena WebGL i wybrane materiały), tylko w innym układzie:
 * <main data-oferta> dostaje data-podglad, a układ robią reguły w globals.css.
 * Gdzie przeglądarka pozwala (Android: Chrome, Samsung), włączamy pełny ekran i blokujemy poziom.
 * iPhone nie ma pełnego ekranu ani blokady obrotu dla stron – tam prosimy o obrócenie telefonu.
 */
const DESK = "(min-width: 768px) and (min-height: 501px)";

type ScreenOrientationLock = ScreenOrientation & { lock?: (o: "landscape") => Promise<void> };

function mainOferty() {
  return document.querySelector<HTMLElement>("main[data-oferta]");
}

export default function PodgladTelefon() {
  const [telefon, setTelefon] = useState(false);
  const [otwarty, setOtwarty] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(DESK);
    const ustaw = () => setTelefon(!mq.matches);
    ustaw();
    mq.addEventListener("change", ustaw);
    return () => mq.removeEventListener("change", ustaw);
  }, []);

  const zamknij = useCallback(() => {
    setOtwarty(false);
    try {
      (screen.orientation as ScreenOrientationLock | undefined)?.unlock?.();
    } catch {}
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    const main = mainOferty();
    if (!main) return;
    if (otwarty) main.setAttribute("data-podglad", "");
    else main.removeAttribute("data-podglad");
    // Scena 3D liczy rozmiar z kontenera – po zmianie układu niech przeliczy od razu.
    window.dispatchEvent(new Event("resize"));
    // Ciemne tło strony: iPhone w poziomie zostawia pasy po bokach (wycięcie ekranu) w kolorze tła strony.
    const tlo = otwarty ? "#0c0b0a" : "";
    document.documentElement.style.overflow = otwarty ? "hidden" : "";
    document.documentElement.style.background = tlo;
    document.body.style.background = tlo;
    return () => {
      main.removeAttribute("data-podglad");
      document.documentElement.style.overflow = "";
      document.documentElement.style.background = "";
      document.body.style.background = "";
    };
  }, [otwarty]);

  // Wyjście z pełnego ekranu przyciskiem systemu (wstecz) zamyka też podgląd.
  useEffect(() => {
    if (!otwarty) return;
    let byl = !!document.fullscreenElement;
    const zmiana = () => {
      if (document.fullscreenElement) byl = true;
      else if (byl) setOtwarty(false);
    };
    document.addEventListener("fullscreenchange", zmiana);
    return () => document.removeEventListener("fullscreenchange", zmiana);
  }, [otwarty]);

  // Na komputerze (albo po obróceniu tabletu) podgląd nie ma sensu – wracamy do zwykłego widoku.
  useEffect(() => {
    if (!telefon && otwarty) zamknij();
  }, [telefon, otwarty, zamknij]);

  const otworz = async () => {
    setOtwarty(true);
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen({ navigationUI: "hide" });
      }
      await (screen.orientation as ScreenOrientationLock | undefined)?.lock?.("landscape");
    } catch {
      // iPhone i część przeglądarek: bez pełnego ekranu / blokady – zostaje prośba o obrót.
    }
  };

  if (!telefon) return null;
  return otwarty ? (
    <>
      <button type="button" onClick={zamknij} className="oferta-podglad-zamknij" aria-label="Zamknij podgląd" title="Zamknij podgląd">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden>
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      <div className="oferta-obroc" role="dialog" aria-modal="true" aria-label="Obróć telefon">
        <svg viewBox="0 0 48 48" width="56" height="56" fill="none" aria-hidden>
          <rect x="14" y="6" width="20" height="34" rx="3" stroke="currentColor" strokeWidth="2" />
          <path d="M36 14a14 14 0 0 1 4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="m42 24-2 4-4-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p>Obróć telefon poziomo – zobaczysz całą ofertę na jednym ekranie.</p>
        <button type="button" onClick={zamknij}>
          Wróć
        </button>
      </div>
    </>
  ) : (
    <button type="button" onClick={() => void otworz()} className="oferta-podglad-otworz">
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden>
        <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Otwórz podgląd
    </button>
  );
}
