"use client";

/*
 * Strona klienta → pasek materiałów: kolory mebli (fronty, boki i obudowa, środek – src/lib/kolory.ts).
 * „Wszystkie meble” zmienia kolory wspólne; kliknięty w 3D mebel – tylko jego (klient może mieć każdy mebel inaczej).
 * Wybór trafia do zgłoszenia „Poproś o wycenę” (opisKoloruKlienta), cena przelicza się według powierzchni.
 */
import type { PlanKuchni } from "@/lib/kuchnia";
import { bezWlasnejCzesci, CZESC_LABEL, koloryMebla, type CzescMebla, type KoloryProjektu } from "@/lib/kolory";
import { grupyElementu, type GrupyMaterialow } from "@/lib/opcjeProjektu";
import { findMaterial, opcjeMaterialu, type KontekstMaterialow } from "./katalogFirmy";
import { formatPln } from "./pricing";
import type { PublicModel } from "./modelRoles";

const LABEL = "text-[11px] uppercase tracking-[0.2em] text-stone-500";

/** Mebel z planu, który można pomalować (ma fronty, boki albo środek). */
export function meblaKolorowe(plan: PlanKuchni, modele: readonly PublicModel[]) {
  const mapa = new Map(modele.map((m) => [m.id, m]));
  return plan.elementy.filter((e) => {
    const g = grupyElementu(e, mapa);
    return g.front || g.korpus || g.srodek;
  });
}

/** Do zgłoszenia: kolory mebli, które klient zmienił („Szafa: fronty Grafit, boki Biały, środek Biały”). */
export function opisKoloruKlienta(plan: PlanKuchni, front: string, projekt: KoloryProjektu, ctx: KontekstMaterialow) {
  const n = (id: string) => findMaterial("front", id, ctx)?.name ?? id;
  const wspolne = koloryMebla({}, front, projekt);
  const czesci = [`kolory: fronty ${n(wspolne.front)}, boki ${n(wspolne.korpus)}, środek ${n(wspolne.srodek)}`];
  // Meble z takimi samymi własnymi kolorami razem: „Szuflady 60, Szafka pod zlew 80 i 4 inne: fronty Grafit…”.
  const grupy = new Map<string, string[]>();
  for (const e of plan.elementy) {
    if (!e.kolory) continue;
    const k = koloryMebla(e, front, projekt);
    const u = e.kolory.uchwyt ? `, okucia ${findMaterial("hardware", e.kolory.uchwyt, ctx)?.name ?? e.kolory.uchwyt}` : "";
    const opis = `fronty ${n(k.front)}, boki ${n(k.korpus)}, środek ${n(k.srodek)}${u}`;
    grupy.set(opis, [...(grupy.get(opis) ?? []), e.nazwa]);
  }
  grupy.forEach((nazwy, opis) => {
    const kto = nazwy.length <= 2 ? nazwy.join(", ") : `${nazwy.slice(0, 2).join(", ")} i ${nazwy.length - 2} ${nazwy.length - 2 === 1 ? "inny" : "inne"}`;
    czesci.push(`${kto}: ${opis}`);
  });
  return czesci.join("; ");
}

export default function KoloryMebli({
  plan,
  onPlan,
  front,
  setFront,
  projekt,
  setProjekt,
  wybrany,
  onWybrany,
  grupy,
  modele,
  ctx,
  showPrice,
  hardware,
  setHardware: ustawOkucia,
}: {
  plan: PlanKuchni;
  onPlan: (p: PlanKuchni) => void;
  front: string;
  setFront: (id: string) => void;
  projekt: KoloryProjektu;
  setProjekt: (k: KoloryProjektu) => void;
  wybrany: string | null;
  onWybrany: (id: string | null) => void;
  grupy: GrupyMaterialow;
  modele: readonly PublicModel[];
  ctx: KontekstMaterialow;
  showPrice: boolean;
  /** Okucia oferty – zaznaczony mebel może mieć inne. */
  hardware: string;
  /** Okucia oferty („Wszystkie meble”); bez – wiersz uchwytów tylko dla zaznaczonego mebla. */
  setHardware?: (id: string) => void;
}) {
  const mapa = new Map(modele.map((m) => [m.id, m]));
  const kolorowe = meblaKolorowe(plan, modele);
  const el = kolorowe.find((e) => e.id === wybrany) ?? null;
  const g = el ? grupyElementu(el, mapa) : grupy;
  const czesci = (["front", "korpus", "srodek"] as CzescMebla[]).filter((c) => (c === "front" ? g.front : c === "korpus" ? g.korpus : g.srodek));
  const teraz = el ? koloryMebla(el, front, projekt) : koloryMebla({}, front, projekt);
  const uchwytTeraz = el?.kolory?.uchwyt ?? hardware;
  // Uchwyty: dla mebla zawsze, dla wszystkich – gdy pasek oddał tu grupę „Okucia” (setHardware).
  const pokazUchwyty = !!el || !!ustawOkucia;
  const setHardware = (id: string) => ustawOkucia?.(id);
  const wybrane = (c: CzescMebla) => (el ? el.kolory?.[c] : c === "front" ? front : projekt[c]);

  const ustaw = (c: CzescMebla | "uchwyt", id: string | undefined) => {
    if (!el) {
      if (c === "uchwyt") {
        if (!id) return;
        setHardware(id);
        if (plan.elementy.some((e) => e.kolory?.uchwyt !== undefined)) onPlan({ ...plan, elementy: bezWlasnejCzesci(plan.elementy, "uchwyt") });
        return;
      }
      if (c === "front") {
        if (id) setFront(id);
      } else setProjekt({ ...projekt, [c]: id });
      // „Wszystkie meble” zmienia naprawdę wszystkie – także te z własnym kolorem tej części.
      if (plan.elementy.some((e) => e.kolory?.[c] !== undefined)) onPlan({ ...plan, elementy: bezWlasnejCzesci(plan.elementy, c) });
      return;
    }
    // Fronty i uchwyty mebla: wybór taki sam jak u reszty = bez własnego (mebel znów idzie za resztą).
    if ((c === "front" && id === front) || (c === "uchwyt" && id === hardware)) id = undefined;
    onPlan({
      ...plan,
      elementy: plan.elementy.map((e) => {
        if (e.id !== el.id) return e;
        const k = { ...e.kolory, [c]: id };
        if (!id) delete k[c];
        const { kolory: _stare, ...bez } = e;
        void _stare;
        return Object.keys(k).length ? { ...bez, kolory: k } : bez;
      }),
    });
  };
  const domyslna = (c: CzescMebla): string | null => {
    if (el) return c === "front" ? null : c === "korpus" ? (projekt.korpus ? "Jak reszta" : "Jak fronty") : projekt.srodek ? "Jak reszta" : "Jak boki";
    return c === "front" ? null : c === "korpus" ? "Jak fronty" : "Jak boki";
  };

  return (
    <fieldset className="w-full min-w-0">
      <legend className={`mb-2 flex flex-wrap items-center gap-2 ${LABEL}`}>
        Kolory
        {kolorowe.length > 1 ? (
          <span className="flex flex-wrap items-center gap-1.5 normal-case tracking-normal">
            <select
              aria-label="Kolory dla"
              value={el?.id ?? ""}
              onChange={(e) => onWybrany(e.target.value || null)}
              className="rounded-full border border-black/15 bg-white px-2.5 py-0.5 text-xs text-stone-900 hover:border-black/50"
            >
              <option value="">Wszystkie meble</option>
              {kolorowe.map((e) => (
                <option key={e.id} value={e.id}>
                  Tylko: {e.nazwa}
                </option>
              ))}
            </select>
            {!el ? <span className="text-xs text-stone-500">albo kliknij mebel w 3D</span> : null}
          </span>
        ) : null}
      </legend>
      {/* Komputer: miejsce na 4 wiersze (fronty, boki, środek, uchwyty) – pasek nie skacze przy zmianie mebla. */}
      <div className="flex flex-col gap-2 desk:min-h-[9.25rem]">
        {czesci.map((c) => {
          // Fronty mebla: zaznaczony kolor, który ma (własny albo jak reszta) – ten sam układ co „Wszystkie meble”.
          const sel = el && c === "front" ? (el.kolory?.front ?? front) : wybrane(c);
          const wszystkie = opcjeMaterialu("front", ctx, sel ?? teraz[c]);
          // Fronty: płyty i RAL; boki i środek: płyty (RAL tylko, gdy już wybrany).
          const opcje = c === "front" ? wszystkie : wszystkie.filter((f) => f.zrodlo !== "ral" || f.id === sel);
          const dom = domyslna(c);
          const nazwa = findMaterial("front", teraz[c], ctx)?.name;
          return (
            <div key={c} className="flex flex-col gap-1.5 desk:flex-row desk:items-center desk:gap-3">
              <span className="flex min-w-0 flex-col text-xs leading-tight text-stone-600 desk:w-48 desk:shrink-0">
                {CZESC_LABEL[c]}
                {nazwa ? <span className="truncate text-stone-900" title={nazwa}>{nazwa}</span> : null}
              </span>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2" role="radiogroup" aria-label={el ? `${CZESC_LABEL[c]} – ${el.nazwa}` : CZESC_LABEL[c]}>
                {dom ? (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!sel}
                    onClick={() => ustaw(c, undefined)}
                    className={`h-7 rounded-full border px-2.5 text-xs transition ${!sel ? "border-stone-900 bg-stone-900 text-white" : "border-black/20 text-stone-700 hover:border-black/50"}`}
                  >
                    {dom}
                  </button>
                ) : null}
                {opcje.map((f) => {
                  const zaznaczona = sel === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      role="radio"
                      aria-checked={zaznaczona}
                      aria-label={`${CZESC_LABEL[c]}: ${f.name}${showPrice && f.delta ? `, dopłata ${formatPln(f.delta)}` : ""}`}
                      title={`${f.name}${showPrice && f.delta ? ` (+${formatPln(f.delta)})` : ""}`}
                      onClick={() => ustaw(c, f.id)}
                      className={`${c === "front" ? "h-8 w-8" : "h-7 w-7"} rounded-full border transition ${
                        zaznaczona ? "border-stone-900 ring-2 ring-stone-900/30 ring-offset-2 ring-offset-white" : "border-black/20 hover:border-black/50"
                      }`}
                      style={{ backgroundColor: f.color }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
        {g.okucia && pokazUchwyty ? (
          <div className="flex flex-col gap-1.5 desk:flex-row desk:items-center desk:gap-3">
            <span className="flex min-w-0 flex-col text-xs leading-tight text-stone-600 desk:w-48 desk:shrink-0">
              Uchwyty (okucia)
              <span className="truncate text-stone-900">{findMaterial("hardware", uchwytTeraz, ctx)?.name}</span>
            </span>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2" role="radiogroup" aria-label={el ? `Uchwyty (okucia) – ${el.nazwa}` : "Uchwyty (okucia)"}>
              {opcjeMaterialu("hardware", ctx, uchwytTeraz).map((h) => {
                const zazn = uchwytTeraz === h.id;
                return (
                  <button
                    key={h.id}
                    type="button"
                    role="radio"
                    aria-checked={zazn}
                    onClick={() => ustaw("uchwyt", h.id)}
                    className={`h-7 whitespace-nowrap rounded-full border px-2.5 text-xs transition ${zazn ? "border-stone-900 bg-stone-900 text-white" : "border-black/20 text-stone-700 hover:border-black/50"}`}
                  >
                    {h.name}
                    {showPrice && h.delta ? ` ${h.delta > 0 ? "+" : ""}${formatPln(h.delta)}` : ""}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </fieldset>
  );
}
