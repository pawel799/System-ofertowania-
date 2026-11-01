"use client";

/*
 * Kolory i okucia jednego mebla (okno elementu: przed dodaniem i przy zmianach – kolory.ts):
 * fronty, boki i obudowa, środek, uchwyty. „Jak pozostałe meble” = bez własnego wyboru (dziedziczy z projektu).
 * Te same próbki co w kroku „Materiały” i u klienta (płyty, RAL dla frontów, okucia z katalogu firmy).
 */
import { CZESC_LABEL, koloryMebla, uchwytMebla, type CzescMebla, type KoloryMebla, type KoloryProjektu } from "@/lib/kolory";
import type { GrupyMaterialow } from "@/lib/opcjeProjektu";
import { findMaterial, opcjeMaterialu, type KontekstMaterialow } from "../katalogFirmy";
import { formatPln } from "../pricing";

type Pole = CzescMebla | "uchwyt";
const LABEL: Record<Pole, string> = { ...CZESC_LABEL, uchwyt: "Uchwyty (okucia)" };

export function KoloryElementu({
  kolory,
  onChange,
  front,
  hardware,
  projekt,
  grupy,
  ctx,
}: {
  kolory: KoloryMebla | undefined;
  onChange: (k: KoloryMebla | undefined) => void;
  /** Wspólne: front i okucia oferty, boki i środek projektu – pokazujemy, co znaczy „Jak pozostałe meble”. */
  front: string;
  hardware: string;
  projekt: KoloryProjektu;
  /** Które części ten mebel ma (grupyElementu). */
  grupy: GrupyMaterialow;
  ctx: KontekstMaterialow;
}) {
  const teraz = { ...koloryMebla({ kolory }, front, projekt), uchwyt: uchwytMebla({ kolory }, hardware) };
  const pola = (["front", "korpus", "srodek", "uchwyt"] as Pole[]).filter((p) => (p === "front" ? grupy.front : p === "korpus" ? grupy.korpus : p === "srodek" ? grupy.srodek : grupy.okucia));
  const ustaw = (p: Pole, id: string | undefined) => {
    const k: KoloryMebla = { ...kolory, [p]: id };
    if (!id) delete k[p];
    onChange(Object.keys(k).length ? k : undefined);
  };
  if (!pola.length) return null;
  return (
    <div className="kr-wn-kolory" data-kolory-elementu>
      {pola.map((p) => {
        const sel = kolory?.[p];
        const rola = p === "uchwyt" ? "hardware" : "front";
        const wszystkie = opcjeMaterialu(rola, ctx, sel ?? teraz[p]);
        const opcje = p === "front" || p === "uchwyt" ? wszystkie : wszystkie.filter((f) => f.zrodlo !== "ral" || f.id === sel);
        const nazwa = findMaterial(rola, teraz[p], ctx)?.name;
        return (
          <div className="field" key={p}>
            <span className="lab">
              {LABEL[p]} {nazwa ? <span className="faint">· {nazwa}</span> : null}
            </span>
            <div className="swatches" role="radiogroup" aria-label={`Ten mebel – ${LABEL[p]}`}>
              <button type="button" className="btn btn-ghost kr-kolor-dom" role="radio" aria-checked={!sel} onClick={() => ustaw(p, undefined)}>
                Jak pozostałe meble
              </button>
              {p === "uchwyt"
                ? opcje.map((f) => (
                    <button key={f.id} type="button" className="btn btn-ghost kr-kolor-dom" role="radio" aria-checked={sel === f.id} aria-label={`${LABEL[p]}: ${f.name}`} onClick={() => ustaw(p, f.id)}>
                      {f.name}
                      {f.delta ? <span className="faint"> {f.delta > 0 ? "+" : ""}{formatPln(f.delta)}</span> : null}
                    </button>
                  ))
                : opcje.map((f, i, all) => (
                    <button
                      key={f.id}
                      type="button"
                      className="sw"
                      role="radio"
                      aria-checked={sel === f.id}
                      aria-label={`${LABEL[p]}: ${f.name}`}
                      data-tip={f.name}
                      data-first-ral={f.zrodlo === "ral" && all[i - 1]?.zrodlo !== "ral" ? "" : undefined}
                      onClick={() => ustaw(p, f.id)}
                    >
                      <span style={{ background: f.color }} />
                    </button>
                  ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
