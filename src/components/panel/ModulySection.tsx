"use client";

/* Oferta w panelu → „Szafki na wymiar”: moduły z ceną liczoną z cennika firmy. */
import { useEffect, useState } from "react";
import { MAX_MODULY, MODUL_LIMITS, modulCena, sumaModulow, type ModulCennik, type ModulItem } from "@/lib/modul";
import { formatPln } from "../pricing";
import { cennikApi } from "./offerApi";

const clamp = (v: number, { min: lo, max: hi }: { min: number; max: number }) => Math.min(hi, Math.max(lo, Math.round(v) || lo));

export function ModulySection({ moduly, onChange }: { moduly: ModulItem[]; onChange: (m: ModulItem[], label: string) => void }) {
  const [cennik, setCennik] = useState<ModulCennik | null>(null);
  const [nowy, setNowy] = useState({ nazwa: "", w: "60", h: "72", d: "56" });
  useEffect(() => {
    cennikApi.get().then(setCennik).catch(() => setCennik(null));
  }, []);

  const add = () => {
    const m: ModulItem = {
      nazwa: nowy.nazwa.trim().slice(0, 60) || `Szafka ${moduly.length + 1}`,
      w: clamp(Number(nowy.w), MODUL_LIMITS.w),
      h: clamp(Number(nowy.h), MODUL_LIMITS.h),
      d: clamp(Number(nowy.d), MODUL_LIMITS.d),
    };
    onChange([...moduly, m], `Dodano moduł: ${m.nazwa} ${m.w}×${m.h}×${m.d} cm`);
    setNowy({ ...nowy, nazwa: "" });
  };

  return (
    <section className="sec" data-testid="moduly-sec">
      <h2>Szafki na wymiar</h2>
      <p className="lede">
        Klient zobaczy je w ofercie w podglądzie 3D. Ceny z <a href="/panel/ustawienia?tab=cennik">cennika modułów</a>.
      </p>
      {moduly.length ? (
        <ul style={{ listStyle: "none", padding: 0, margin: "8px 0", display: "grid", gap: 6 }}>
          {moduly.map((m, i) => (
            <li key={i} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}>
              <b style={{ flex: 1 }}>{m.nazwa}</b>
              <span className="mono">
                {m.w}×{m.h}×{m.d} cm
              </span>
              <span style={{ minWidth: 90, textAlign: "right" }}>{cennik ? formatPln(modulCena(m, cennik)) : "…"}</span>
              <button
                type="button"
                className="btn btn-plain"
                aria-label={`Usuń ${m.nazwa}`}
                onClick={() => onChange(moduly.filter((_, j) => j !== i), `Usunięto moduł: ${m.nazwa}`)}
              >
                ✕
              </button>
            </li>
          ))}
          {cennik ? (
            <li style={{ display: "flex", fontSize: 13.5, borderTop: "1px solid rgba(0,0,0,.1)", paddingTop: 6 }}>
              <span style={{ flex: 1 }}>Razem moduły (netto)</span>
              <b data-testid="moduly-suma">{formatPln(sumaModulow(moduly, cennik))}</b>
            </li>
          ) : null}
        </ul>
      ) : null}
      {moduly.length < MAX_MODULY ? (
        <div style={{ display: "grid", gap: 6, gridTemplateColumns: "2fr repeat(3, 1fr) auto", alignItems: "end" }}>
          <input className="input" aria-label="Nazwa modułu" placeholder="Nazwa (np. Zlewowa)" maxLength={60} value={nowy.nazwa} onChange={(e) => setNowy({ ...nowy, nazwa: e.target.value })} />
          {(["w", "h", "d"] as const).map((k) => (
            <input
              key={k}
              className="input"
              inputMode="numeric"
              aria-label={{ w: "Szerokość cm", h: "Wysokość cm", d: "Głębokość cm" }[k]}
              title={`${{ w: "Szerokość", h: "Wysokość", d: "Głębokość" }[k]} ${MODUL_LIMITS[k].min}–${MODUL_LIMITS[k].max} cm`}
              value={nowy[k]}
              onChange={(e) => setNowy({ ...nowy, [k]: e.target.value })}
            />
          ))}
          <button type="button" className="btn btn-ghost" onClick={add}>
            Dodaj
          </button>
        </div>
      ) : null}
    </section>
  );
}
