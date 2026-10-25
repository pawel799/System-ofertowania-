"use client";

import { useEffect, useState } from "react";
import {
  dlugoscRzedu,
  limityRodzaju,
  RODZAJ_LABEL,
  rodzajElementu,
  STREFA_LABEL,
  type ElementKuchni,
  type PlanKuchni,
} from "@/lib/kuchnia";
import { formatPln } from "../pricing";

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

export function KreatorWlasciwosci({
  plan,
  element,
  cena,
  onNazwa,
  onWymiar,
  onObrot,
  onUsun,
  onKopiuj,
  onDociagnij,
}: {
  plan: PlanKuchni;
  element: ElementKuchni | null;
  cena: number | null;
  onNazwa: (nazwa: string) => void;
  onWymiar: (key: "w" | "h" | "d", value: number) => boolean | void;
  onObrot: () => void;
  onUsun: () => void;
  onKopiuj: () => void;
  onDociagnij: () => void;
}) {
  if (!element) {
    return (
      <div className="kr-card kr-selected">
        <h3>Właściwości</h3>
        <p className="lede">Kliknij element na rzucie albo w 3D. Tu zmienisz nazwę i wymiary — rząd obok zostaje dosunięty.</p>
      </div>
    );
  }
  const lim = limityRodzaju(rodzajElementu(element), element.strefa);
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
        {element.w} × {element.d} × {element.h} cm
        {rzad != null ? ` · rząd ${rzad} cm` : ""}
        {cena != null ? ` · ${formatPln(cena)}` : ""}
      </p>
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
