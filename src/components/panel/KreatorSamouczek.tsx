"use client";

/*
 * Samouczek kreatora: kilka dymków przy najważniejszych miejscach (kroki, katalog, rzut, 3D, dalej, zapis).
 * Sam startuje przy pierwszej nowej ofercie w tej przeglądarce; potem przycisk „Samouczek” w nagłówku.
 * Pamięć „widziany” w localStorage – tylko wygoda; gdy przeglądarka jej nie da, samouczek po prostu pokaże się znowu.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { TYP_PROJEKTU, type TypProjektu } from "@/lib/projekt";

const KLUCZ = "op-rzut:samouczek-kreatora";

export function samouczekWidziany() {
  try {
    return window.localStorage.getItem(KLUCZ) === "1";
  } catch {
    return false;
  }
}

function zapamietaj() {
  try {
    window.localStorage.setItem(KLUCZ, "1");
  } catch {
    // tryb prywatny / zablokowane dane – trudno
  }
}

type Krok = { cel: string; tytul: string; tekst: string };

function kroki(typ: TypProjektu): Krok[] {
  const co = TYP_PROJEKTU[typ].label.toLowerCase();
  return [
    { cel: "kroki", tytul: "Krok po kroku", tekst: `Kreator prowadzi od pomiaru do oferty: pomieszczenie, okna i instalacje, wyposażenie, meble, materiały, klient. Możesz skakać między krokami.` },
    { cel: "katalog", tytul: "Katalog elementów", tekst: `Elementy pasujące do projektu (${co}). Kliknięcie otwiera okno z wymiarami i wnętrzem – półki, szuflady, drążki – i dopiero wtedy „Dodaj”.` },
    { cel: "rzut", tytul: "Rzut z góry", tekst: "Przeciągaj meble po rzucie – przyciągają się do ścian i sąsiadów. Dwuklik (albo Enter) na meblu otwiera jego wymiary i wnętrze." },
    { cel: "widok3d", tytul: "Podgląd 3D", tekst: "Obracaj myszą albo palcem. „Otwórz drzwi i szuflady” pokazuje, co jest w środku; dwuklik otwiera jeden mebel." },
    { cel: "dalej", tytul: "Cena i kolejny krok", tekst: "Suma liczy się na bieżąco z Twojego cennika (z dopłatą za wnętrze). „Dalej” prowadzi do następnego kroku." },
    { cel: "zapisz", tytul: "Zapis i wysyłka", tekst: "Zapisz ofertę w każdej chwili. W ostatnim kroku pobierzesz PDF z kodem QR i utworzysz link 3D dla klienta." },
  ];
}

export function KreatorSamouczek({ typ, onKoniec }: { typ: TypProjektu; onKoniec: () => void }) {
  const lista = kroki(typ);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const dymek = useRef<HTMLDivElement>(null);
  const [poz, setPoz] = useState<{ top: number; left: number }>({ top: 80, left: 20 });
  const krok = lista[i];

  const koniec = useCallback(() => {
    zapamietaj();
    onKoniec();
  }, [onKoniec]);

  useLayoutEffect(() => {
    const licz = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${krok.cel}"]`);
      if (!el) return setRect(null);
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
      setRect(el.getBoundingClientRect());
    };
    licz();
    window.addEventListener("resize", licz);
    window.addEventListener("scroll", licz, true);
    return () => {
      window.removeEventListener("resize", licz);
      window.removeEventListener("scroll", licz, true);
    };
  }, [krok.cel]);

  // Dymek pod celem, a gdy brak miejsca – nad nim albo obok; zawsze w oknie.
  useLayoutEffect(() => {
    const d = dymek.current;
    if (!d) return;
    const w = d.offsetWidth;
    const h = d.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!rect) return setPoz({ top: Math.max(16, vh / 2 - h / 2), left: Math.max(16, vw / 2 - w / 2) });
    let top = rect.bottom + 12;
    if (top + h > vh - 12) top = rect.top - h - 12;
    if (top < 12) top = Math.min(vh - h - 12, Math.max(12, rect.top + 12));
    let left = rect.left + rect.width / 2 - w / 2;
    left = Math.max(12, Math.min(vw - w - 12, left));
    setPoz({ top, left });
  }, [rect, i]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") koniec();
      if (e.key === "ArrowRight") setI((x) => Math.min(lista.length - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [koniec, lista.length]);

  return (
    <div className="kr-tour" role="dialog" aria-modal="true" aria-labelledby="kr-tour-t">
      {rect ? <div className="kr-tour-cel" style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }} /> : <div className="kr-tour-tlo" />}
      <div ref={dymek} className="kr-tour-dymek" style={{ top: poz.top, left: poz.left }}>
        <p className="kr-hint">
          Samouczek · {i + 1} z {lista.length}
        </p>
        <h3 id="kr-tour-t">{krok.tytul}</h3>
        <p>{krok.tekst}</p>
        <div className="actions">
          <button type="button" className="btn btn-plain" onClick={koniec}>
            Pomiń
          </button>
          {i > 0 ? (
            <button type="button" className="btn btn-ghost" onClick={() => setI(i - 1)}>
              Wstecz
            </button>
          ) : null}
          {i < lista.length - 1 ? (
            <button type="button" className="btn btn-ink" autoFocus onClick={() => setI(i + 1)}>
              Dalej
            </button>
          ) : (
            <button type="button" className="btn btn-ink" autoFocus onClick={koniec}>
              Zaczynam
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
