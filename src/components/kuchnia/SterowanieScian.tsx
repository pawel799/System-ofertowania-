"use client";

/*
 * „Ściany” nad sceną 3D: pokaż / ukryj ściany i ich kolor (scianyStore.ts). Ten sam przycisk w kreatorze i u klienta,
 * różni się tylko wyglądem (klasy z rodzica). W kreatorze kolor zapisuje się w ofercie (plan.sciany), u klienta – tylko u niego.
 */
import { useEffect, useRef, useState } from "react";
import { KOLORY_SCIAN, nazwaKoloruSciany } from "@/lib/sciany";
import { przelaczSciany, ustawKolorScian, useSciany } from "./scianyStore";

export default function SterowanieScian({
  className,
  klasaPanelu,
  wlasnyKolor = false,
  onKolor,
}: {
  /** Klasy przycisków (jak „Otwórz drzwi i szuflady”). */
  className?: string;
  /** Klasy okienka z kolorami. */
  klasaPanelu?: string;
  /** Kreator: pole z dowolnym kolorem (#rrggbb). */
  wlasnyKolor?: boolean;
  /** Po wyborze koloru (kreator zapisuje go w planie). */
  onKolor?: (kolor: string | null) => void;
}) {
  const { widoczne, kolor } = useSciany();
  const [otwarte, setOtwarte] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!otwarte) return;
    const klik = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOtwarte(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOtwarte(false);
    window.addEventListener("pointerdown", klik);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", klik);
      window.removeEventListener("keydown", esc);
    };
  }, [otwarte]);
  const wybierz = (k: string | null) => {
    ustawKolorScian(k);
    onKolor?.(k);
    if (!widoczne) przelaczSciany(true);
  };

  return (
    <div ref={ref} className="sciany-sterowanie" style={{ position: "relative", display: "inline-flex", gap: 8 }}>
      <button type="button" className={className} aria-pressed={!widoczne} onClick={() => przelaczSciany()}>
        {widoczne ? "Ukryj ściany" : "Pokaż ściany"}
      </button>
      <button type="button" className={className} aria-expanded={otwarte} aria-haspopup="dialog" onClick={() => setOtwarte((o) => !o)}>
        <span aria-hidden style={{ display: "inline-block", width: 12, height: 12, borderRadius: 999, marginRight: 6, verticalAlign: "-1px", background: kolor ?? "#9a948c", boxShadow: "inset 0 0 0 1px rgba(0,0,0,.25)" }} />
        Kolor ścian
      </button>
      {otwarte ? (
        <div role="dialog" aria-label="Kolor ścian" className={klasaPanelu} style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 20, width: 236 }}>
          <p style={{ margin: "0 0 8px", fontSize: 12 }}>Kolor ścian: {nazwaKoloruSciany(kolor)}</p>
          <div role="radiogroup" aria-label="Kolory ścian" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button
              type="button"
              role="radio"
              aria-checked={!kolor}
              aria-label="Domyślny"
              title="Domyślny (dopasowany do tła)"
              onClick={() => wybierz(null)}
              style={{ width: 28, height: 28, borderRadius: 999, border: !kolor ? "2px solid currentColor" : "1px solid rgba(0,0,0,.25)", background: "linear-gradient(135deg,#3a342e 50%,#e2ddd5 50%)" }}
            />
            {KOLORY_SCIAN.map((k) => (
              <button
                key={k.id}
                type="button"
                role="radio"
                aria-checked={kolor?.toLowerCase() === k.kolor}
                aria-label={k.nazwa}
                title={k.nazwa}
                onClick={() => wybierz(k.kolor)}
                style={{ width: 28, height: 28, borderRadius: 999, border: kolor?.toLowerCase() === k.kolor ? "2px solid currentColor" : "1px solid rgba(0,0,0,.25)", background: k.kolor }}
              />
            ))}
          </div>
          {wlasnyKolor ? (
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 12 }}>
              Własny kolor
              <input type="color" aria-label="Własny kolor ścian" value={kolor ?? "#e2ddd5"} onChange={(e) => wybierz(e.target.value.toLowerCase())} style={{ width: 40, height: 26, padding: 0, border: 0, background: "none" }} />
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
