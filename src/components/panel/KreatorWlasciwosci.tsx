"use client";

import { useEffect, useState } from "react";
import {
  katElementu,
  dlugoscRzedu,
  limityElementu,
  RODZAJ_LABEL,
  rodzajElementu,
  STREFA_LABEL,
  type ElementKuchni,
  type PlanKuchni,
} from "@/lib/kuchnia";
import { formatPln } from "../pricing";
import { maWnetrze, opisWnetrza, wnetrzeDomyslne } from "@/lib/wnetrze";

export function PoleCm({
  id,
  label,
  value,
  min,
  max,
  onCommit,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (n: number) => boolean | void;
}) {
  const [tekst, setTekst] = useState(String(value));
  useEffect(() => setTekst(String(value)), [value]);
  const zatwierdz = () => {
    const n = Math.round(Number(tekst));
    if (!Number.isFinite(n) || tekst === "") {
      setTekst(String(value));
      return;
    }
    const v = Math.min(max, Math.max(min, n));
    if (onCommit(v) === false) setTekst(String(value));
    else setTekst(String(v));
  };
  return (
    <label htmlFor={id}>
      {label}
      <input
        id={id}
        className="input"
        inputMode="numeric"
        autoComplete="off"
        min={min}
        max={max}
        value={tekst}
        onChange={(e) => setTekst(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
        onBlur={zatwierdz}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
      <span className="kr-hint">
        {min}–{max} cm
      </span>
    </label>
  );
}

/** Kąt obrotu mebla: pole 0–359° i szybkie ±15°; „Prosto” wraca do najbliższego kierunku ściany. */
function PoleKata({ kat, onKat }: { kat: number; onKat: (stopnie: number) => void }) {
  const [tekst, setTekst] = useState(String(kat));
  useEffect(() => setTekst(String(kat)), [kat]);
  const zatwierdz = () => {
    const n = Math.round(Number(tekst.replace(",", ".")));
    if (!Number.isFinite(n) || tekst.trim() === "") return setTekst(String(kat));
    const v = ((n % 360) + 360) % 360;
    setTekst(String(v));
    if (v !== kat) onKat(v);
  };
  const krzywo = kat % 90 !== 0;
  return (
    <div className="kr-kat">
      <label htmlFor="k-kat">
        Obrót
        <span className="kr-kat-pole">
          <input
            id="k-kat"
            className="input"
            inputMode="numeric"
            autoComplete="off"
            value={tekst}
            onChange={(e) => setTekst(e.target.value.replace(/[^\d-]/g, "").slice(0, 4))}
            onBlur={zatwierdz}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
          °
        </span>
      </label>
      <div className="kr-kat-przyciski" role="group" aria-label="Obrót mebla">
        <button type="button" className="btn btn-ghost" aria-label="Obróć o 15° w prawo" onClick={() => onKat((kat + 345) % 360)}>
          ↻ 15°
        </button>
        <button type="button" className="btn btn-ghost" aria-label="Obróć o 15° w lewo" onClick={() => onKat((kat + 15) % 360)}>
          ↺ 15°
        </button>
        {krzywo ? (
          <button type="button" className="btn btn-plain" onClick={() => onKat(Math.round(kat / 90) * 90 % 360)}>
            Prosto
          </button>
        ) : null}
      </div>
      <span className="kr-hint">Dowolny kąt 0–359° (np. mebel w narożniku albo wyspa). Na rzucie kolizje liczą się z obrysu wokół mebla.</span>
    </div>
  );
}

export function KreatorWlasciwosci({
  plan,
  element,
  cena,
  agd = false,
  onNazwa,
  onWymiar,
  onObrot,
  onKat,
  onUsun,
  onKopiuj,
  onDociagnij,
  onWnetrze,
}: {
  plan: PlanKuchni;
  element: ElementKuchni | null;
  cena: number | null;
  /** Urządzenie AGD – nie wchodzi do ceny zabudowy. */
  agd?: boolean;
  onNazwa: (nazwa: string) => void;
  onWymiar: (key: "w" | "h" | "d", value: number) => boolean | void;
  onObrot: () => void;
  /** Dowolny kąt [°, 0–359] – mebel pod kątem (np. narożnik pokoju, wyspa). */
  onKat?: (stopnie: number) => void;
  onUsun: () => void;
  onKopiuj: () => void;
  onDociagnij: () => void;
  /** Okno wymiarów i wnętrza (półki, szuflady, drążki). */
  onWnetrze?: () => void;
}) {
  if (!element) {
    return (
      <div className="kr-card kr-selected">
        <h3>Właściwości</h3>
        <p className="lede">Kliknij element na rzucie albo w 3D. Tu zmienisz nazwę i wymiary — rząd obok zostaje dosunięty. Dwuklik otwiera okno z wnętrzem (półki, szuflady, drążki).</p>
      </div>
    );
  }
  const lim = limityElementu(element);
  const rzad = dlugoscRzedu(plan, element.id);
  return (
    <div className="kr-card kr-selected">
      <h3>Zaznaczenie</h3>
      <p className="kr-badges">
        <span>{RODZAJ_LABEL[rodzajElementu(element)]}</span>
        <span>{STREFA_LABEL[element.strefa]}</span>
        {element.zrodlo === "model" ? <span>model 3D</span> : null}
      </p>
      <label htmlFor="k-nazwa">
        Nazwa
        <input id="k-nazwa" className="input" value={element.nazwa} maxLength={80} onChange={(e) => onNazwa(e.target.value.slice(0, 80))} />
      </label>
      <div className="kr-dims kr-dims-3">
        <PoleCm id="k-w" label="Szerokość" value={element.w} min={lim.w.min} max={lim.w.max} onCommit={(n) => onWymiar("w", n)} />
        <PoleCm id="k-h" label="Wysokość" value={element.h} min={lim.h.min} max={lim.h.max} onCommit={(n) => onWymiar("h", n)} />
        <PoleCm id="k-d" label="Głębokość" value={element.d} min={lim.d.min} max={lim.d.max} onCommit={(n) => onWymiar("d", n)} />
      </div>
      <p className="lede">
        {element.w} × {element.h} × {element.d} cm <span className="faint">(szer. × wys. × gł.)</span>
        {rzad != null ? ` · rząd ${rzad} cm` : ""}
        {agd ? " · AGD, poza ceną" : cena != null ? ` · ${formatPln(cena)} netto` : ""}
      </p>
      {maWnetrze(element) ? (
        <p className="kr-wn-skrot">
          <span>Wnętrze: {opisWnetrza(element.wnetrze ?? wnetrzeDomyslne(element)!)}</span>
          {onWnetrze ? (
            <button type="button" className="btn btn-ghost" onClick={onWnetrze}>
              Zmień wnętrze
            </button>
          ) : null}
        </p>
      ) : onWnetrze ? (
        <p className="kr-wn-skrot">
          <span>{element.zrodlo === "model" ? "Wnętrze z modelu 3D" : "Bez wnętrza"}</span>
          <button type="button" className="btn btn-ghost" onClick={onWnetrze}>
            Wymiary i wnętrze
          </button>
        </p>
      ) : null}
      {onKat ? <PoleKata key={element.id} kat={katElementu(element)} onKat={onKat} /> : null}
      <div className="actions">
        <button type="button" className="btn btn-ghost" onClick={onObrot}>
          Obróć 90°
        </button>
        <button type="button" className="btn btn-ghost" onClick={onDociagnij}>
          Dociągnij rząd
        </button>
        <button type="button" className="btn btn-ghost" onClick={onKopiuj}>
          Kopiuj
        </button>
        <button type="button" className="btn btn-plain" onClick={onUsun}>
          Usuń
        </button>
      </div>
    </div>
  );
}
