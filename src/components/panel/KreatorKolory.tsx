"use client";

/*
 * Kreator → krok „Materiały”: kolory mebli – fronty, boki i obudowa, środek (kolory.ts).
 * „Wszystkie meble” ustawia kolory wspólne (front oferty + boki i środek projektu), zaznaczony mebel – tylko jego.
 * Zaznaczenie jest wspólne z rzutem i 3D: kliknij mebel, a tu zmienisz tylko jego kolory.
 */
import type { PlanKuchni } from "@/lib/kuchnia";
import { CZESC_LABEL, koloryMebla, type CzescMebla, type KoloryProjektu } from "@/lib/kolory";
import { grupyElementu, type GrupyMaterialow } from "@/lib/opcjeProjektu";
import { opcjeMaterialu, type KontekstMaterialow } from "../katalogFirmy";
import type { PublicModel } from "../modelRoles";

export function KreatorKolory({
  plan,
  setPlan,
  front,
  setFront,
  projekt,
  setProjekt,
  zaznaczony,
  setZaznaczony,
  grupy,
  modele,
  ctx,
}: {
  plan: PlanKuchni;
  setPlan: (fn: (p: PlanKuchni) => PlanKuchni) => void;
  front: string;
  setFront: (id: string) => void;
  projekt: KoloryProjektu;
  setProjekt: (k: KoloryProjektu) => void;
  zaznaczony: string | null;
  setZaznaczony: (id: string | null) => void;
  grupy: GrupyMaterialow;
  modele: readonly PublicModel[];
  ctx: KontekstMaterialow;
}) {
  const mapa = new Map(modele.map((m) => [m.id, m]));
  const kolorowe = plan.elementy.filter((e) => {
    const g = grupyElementu(e, mapa);
    return g.front || g.korpus || g.srodek;
  });
  const el = kolorowe.find((e) => e.id === zaznaczony) ?? null;
  const g = el ? grupyElementu(el, mapa) : grupy;
  const czesci = (["front", "korpus", "srodek"] as CzescMebla[]).filter((c) => (c === "front" ? g.front : c === "korpus" ? g.korpus : g.srodek));
  const teraz = el ? koloryMebla(el, front, projekt) : koloryMebla({}, front, projekt);
  const wlasne = el?.kolory ?? {};

  const ustaw = (c: CzescMebla, id: string | undefined) => {
    if (!el) {
      if (c === "front") {
        if (id) setFront(id);
      } else setProjekt({ ...projekt, [c]: id });
      return;
    }
    setPlan((p) => ({
      ...p,
      elementy: p.elementy.map((e) => {
        if (e.id !== el.id) return e;
        const k = { ...e.kolory, [c]: id };
        if (!id) delete k[c];
        const { kolory: _stare, ...bez } = e;
        void _stare;
        return Object.keys(k).length ? { ...bez, kolory: k } : bez;
      }),
    }));
  };

  const domyslna = (c: CzescMebla): string | null => {
    if (el) return c === "front" ? "Jak pozostałe meble" : c === "korpus" ? (projekt.korpus ? "Jak pozostałe meble" : "Jak fronty") : projekt.srodek ? "Jak pozostałe meble" : "Jak boki";
    return c === "front" ? null : c === "korpus" ? "Jak fronty" : "Jak boki";
  };
  const wybrane = (c: CzescMebla) => (el ? wlasne[c] : c === "front" ? front : projekt[c]);

  if (!kolorowe.length && !grupy.front) return null;
  return (
    <div className="kr-kolory" data-kolory>
      <div className="field">
        <label className="lab" htmlFor="k-kolory-dla">
          Kolory dla
        </label>
        <select id="k-kolory-dla" className="input" value={el?.id ?? ""} onChange={(e) => setZaznaczony(e.target.value || null)}>
          <option value="">Wszystkie meble</option>
          {kolorowe.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nazwa}
              {e.kolory ? " · własne kolory" : ""}
            </option>
          ))}
        </select>
        <p className="kr-hint">{el ? "Zmieniasz tylko ten mebel. Kliknij inny na rzucie albo w 3D." : "Kliknij mebel na rzucie albo w 3D, żeby dać mu inne kolory niż reszcie."}</p>
      </div>
      {czesci.map((c) => {
        // Fronty: płyty i RAL; boki i środek: płyty (RAL tylko, gdy już wybrany) – tak samo jak u klienta.
        const wszystkie = opcjeMaterialu("front", ctx, wybrane(c) ?? teraz[c]);
        const opcje = c === "front" ? wszystkie : wszystkie.filter((f) => f.zrodlo !== "ral" || f.id === wybrane(c));
        const dom = domyslna(c);
        const sel = wybrane(c);
        return (
          <div className="field" key={c}>
            <span className="lab">{CZESC_LABEL[c]}</span>
            <div className="swatches" role="radiogroup" aria-label={CZESC_LABEL[c]}>
              {dom ? (
                <button type="button" className="btn btn-ghost kr-kolor-dom" role="radio" aria-checked={!sel} onClick={() => ustaw(c, undefined)}>
                  {dom}
                </button>
              ) : null}
              {opcje.map((f, i, all) => (
                <button
                  key={f.id}
                  type="button"
                  className="sw"
                  role="radio"
                  aria-checked={sel === f.id}
                  aria-label={`${CZESC_LABEL[c]}: ${f.name}`}
                  data-tip={f.name}
                  data-first-ral={f.zrodlo === "ral" && all[i - 1]?.zrodlo !== "ral" ? "" : undefined}
                  onClick={() => ustaw(c, f.id)}
                >
                  <span style={{ background: f.color }} />
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {el?.kolory ? (
        <button type="button" className="btn btn-plain" onClick={() => setPlan((p) => ({ ...p, elementy: p.elementy.map((e) => (e.id === el.id ? (({ kolory: _k, ...r }) => (void _k, r))(e) : e)) }))}>
          Kolory jak pozostałe meble
        </button>
      ) : null}
    </div>
  );
}
