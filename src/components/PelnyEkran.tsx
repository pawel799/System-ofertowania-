"use client";

/*
 * Pełny ekran podglądu 3D u klienta: przycisk w prawym dolnym rogu sceny. Na pełnym ekranie jest tylko scena –
 * bez materiałów, ceny i przycisków; żeby coś zmienić, klient wychodzi z pełnego ekranu (×, Esc, „wstecz”).
 *
 * Komputer, Android, iPad: Fullscreen API na samej scenie (.oferta-scena) – znikają też karty i pasek adresu.
 * iPhone: Safari nie pozwala stronie wejść w pełny ekran (Fullscreen API działa tam tylko dla wideo), więc scena
 * zakrywa całą stronę od krawędzi do krawędzi (viewport-fit=cover, także pod wycięciem ekranu w poziomie),
 * a krótka podpowiedź mówi, jak schować pasek Safari. Ta sama scena WebGL – bez drugiego kontekstu.
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

type Tryb = "api" | "css" | null;

let tryb: Tryb = null;
const sluchacze = new Set<() => void>();
const ustaw = (t: Tryb) => {
  tryb = t;
  sluchacze.forEach((l) => l());
};
const subskrybuj = (l: () => void) => {
  sluchacze.add(l);
  return () => {
    sluchacze.delete(l);
  };
};
const useTryb = () => useSyncExternalStore(subskrybuj, () => tryb, () => null);

type ZWebkit = HTMLElement & { webkitRequestFullscreen?: () => void };
type DokWebkit = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void; webkitFullscreenEnabled?: boolean };

const scena = () => document.querySelector<HTMLElement>("main[data-oferta] .oferta-scena");
const naPelnym = () => document.fullscreenElement ?? (document as DokWebkit).webkitFullscreenElement ?? null;

async function wejdz() {
  const el = scena() as ZWebkit | null;
  if (!el) return;
  const d = document as DokWebkit;
  try {
    if (document.fullscreenEnabled && el.requestFullscreen) {
      await el.requestFullscreen({ navigationUI: "hide" });
      ustaw("api");
      return;
    }
    if (d.webkitFullscreenEnabled && el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
      ustaw("api");
      return;
    }
  } catch {
    // Przeglądarka odmówiła (np. ramka bez allow="fullscreen") – zostaje wariant bez API.
  }
  ustaw("css");
}

function wyjdz() {
  const d = document as DokWebkit;
  if (naPelnym()) {
    if (document.exitFullscreen) void document.exitFullscreen().catch(() => {});
    else d.webkitExitFullscreen?.();
  }
  ustaw(null);
}

const IkonaPelny = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden>
    <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Przycisk „Pełny ekran”. Komputer: w rogu nad paskiem materiałów; telefon: w prawym dolnym rogu sceny. */
export function PrzyciskPelnegoEkranu({ className }: { className?: string }) {
  const t = useTryb();
  if (t) return null;
  return (
    <button type="button" className={className} onClick={() => void wejdz()} aria-label="Pełny ekran">
      <IkonaPelny />
      <span>Pełny ekran</span>
    </button>
  );
}

const iPhone = () => /iPhone|iPod/.test(navigator.userAgent);

/**
 * Warstwa w scenie: przycisk wyjścia, obsługa Esc / „wstecz” i wariant bez Fullscreen API (iPhone).
 * Montowana raz, wewnątrz .oferta-scena (tylko ona jest widoczna na pełnym ekranie).
 */
export function PelnyEkranWarstwa() {
  const t = useTryb();
  const [podpowiedz, setPodpowiedz] = useState(false);

  // Wyjście z pełnego ekranu systemowo (Esc, gest, przycisk przeglądarki) zamyka też nasz stan.
  useEffect(() => {
    const zmiana = () => {
      if (!naPelnym() && tryb === "api") ustaw(null);
    };
    document.addEventListener("fullscreenchange", zmiana);
    document.addEventListener("webkitfullscreenchange", zmiana);
    return () => {
      document.removeEventListener("fullscreenchange", zmiana);
      document.removeEventListener("webkitfullscreenchange", zmiana);
    };
  }, []);

  // Scena liczy rozmiar z kontenera – po wejściu i wyjściu niech przeliczy od razu.
  useEffect(() => {
    window.dispatchEvent(new Event("resize"));
  }, [t]);

  const zamknij = useCallback(() => {
    if (tryb === "css" && window.history.state?.opPelny) window.history.back();
    else wyjdz();
  }, []);

  // Wariant bez API: scena na całą stronę, pod wycięciem ekranu; „wstecz” zamyka pełny ekran zamiast strony.
  useEffect(() => {
    if (t !== "css") return;
    const main = document.querySelector<HTMLElement>("main[data-oferta]");
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    const bylo = meta?.content ?? null;
    main?.setAttribute("data-pelny", "");
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.background = "#0c0b0a";
    document.body.style.background = "#0c0b0a";
    if (meta && bylo && !/viewport-fit/.test(bylo)) meta.content = `${bylo}, viewport-fit=cover`;
    window.scrollTo(0, 0);
    window.history.pushState({ ...(window.history.state ?? {}), opPelny: true }, "");
    const wstecz = () => ustaw(null);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && zamknij();
    window.addEventListener("popstate", wstecz);
    window.addEventListener("keydown", esc);
    if (iPhone()) setPodpowiedz(true);
    return () => {
      main?.removeAttribute("data-pelny");
      document.documentElement.style.overflow = "";
      document.documentElement.style.background = "";
      document.body.style.background = "";
      if (meta && bylo !== null) meta.content = bylo;
      window.removeEventListener("popstate", wstecz);
      window.removeEventListener("keydown", esc);
      setPodpowiedz(false);
    };
  }, [t, zamknij]);

  useEffect(() => {
    if (!podpowiedz) return;
    const czas = setTimeout(() => setPodpowiedz(false), 8000);
    return () => clearTimeout(czas);
  }, [podpowiedz]);

  // Po opuszczeniu strony oferty stan nie może zostać.
  useEffect(() => () => ustaw(null), []);

  return (
    <>
      <PrzyciskPelnegoEkranu className="oferta-pelny-wejdz inline-flex desk:hidden" />
      {t ? (
        <button type="button" className="oferta-pelny-zamknij" onClick={zamknij} aria-label="Zamknij pełny ekran" title="Zamknij pełny ekran (Esc)">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span>Zamknij</span>
        </button>
      ) : null}
      {podpowiedz ? (
        <p className="oferta-pelny-podpowiedz" role="status" onClick={() => setPodpowiedz(false)}>
          Pasek Safari schowasz: dotknij ikony po lewej stronie adresu → „Ukryj pasek narzędzi”.
        </p>
      ) : null}
    </>
  );
}
