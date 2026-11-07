"use client";

/*
 * Kolor jednej ściany: po kliknięciu ściany (albo ścianki działowej) w 3D w kreatorze – okienko z kolorami nad sceną.
 * „Jak reszta” usuwa własny kolor (ściana bierze „Kolor ścian”). Zapis w planie: plan.sciany.koloryScian / dodatkowe[i].kolor.
 */
import { KOLORY_SCIAN, nazwaKoloruSciany, type ScianaPokoju } from "@/lib/sciany";

export type EdycjaKolorowScian = {
  onSciana: (id: ScianaPokoju, kolor: string | null) => void;
  onScianka: (i: number, kolor: string | null) => void;
};

export default function PaletaSciany({
  tytul,
  kolor,
  onKolor,
  onZamknij,
  className,
}: {
  tytul: string;
  /** Własny kolor ściany; null = jak reszta. */
  kolor: string | null;
  onKolor: (k: string | null) => void;
  onZamknij?: () => void;
  className?: string;
}) {
  const kolo = (zaznaczony: boolean) => ({
    width: 26,
    height: 26,
    borderRadius: 999,
    border: zaznaczony ? "2px solid currentColor" : "1px solid rgba(0,0,0,.25)",
    cursor: "pointer",
  });
  return (
    <div role="dialog" aria-label={`Kolor: ${tytul}`} data-wyspa className={className} data-paleta-sciany style={{ width: 252 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
        <b style={{ fontSize: 13 }}>{tytul}</b>
        <span style={{ fontSize: 12, opacity: 0.7, flex: 1 }}>{kolor ? nazwaKoloruSciany(kolor) : "jak reszta"}</span>
        {onZamknij ? (
          <button type="button" aria-label="Zamknij kolory ściany" onClick={onZamknij} style={{ background: "none", border: 0, color: "inherit", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>
            ×
          </button>
        ) : null}
      </div>
      <div role="radiogroup" aria-label={`Kolory: ${tytul}`} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" role="radio" aria-checked={!kolor} aria-label="Jak reszta ścian" title="Jak reszta ścian" onClick={() => onKolor(null)} style={{ ...kolo(!kolor), background: "repeating-linear-gradient(135deg,#bbb 0 4px,#eee 4px 8px)" }} />
        {KOLORY_SCIAN.map((k) => (
          <button key={k.id} type="button" role="radio" aria-checked={kolor?.toLowerCase() === k.kolor} aria-label={k.nazwa} title={k.nazwa} onClick={() => onKolor(k.kolor)} style={{ ...kolo(kolor?.toLowerCase() === k.kolor), background: k.kolor }} />
        ))}
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 12 }}>
        Własny kolor
        <input type="color" aria-label={`Własny kolor: ${tytul}`} value={kolor ?? "#e2ddd5"} onChange={(e) => onKolor(e.target.value.toLowerCase())} style={{ width: 40, height: 26, padding: 0, border: 0, background: "none" }} />
      </label>
    </div>
  );
}
