"use client";

/*
 * Kreator ścian (osobne okno): pokój o dowolnej liczbie ścian – gotowe kształty, rzut z narożnikami do przeciągania,
 * podział ściany („+” w połowie), scalanie, długości ścian, otwarta przestrzeń (bez ściany), wysokość, sufit,
 * ścianki działowe. Obok podgląd 3D. Logika: src/lib/ksztaltPokoju.ts, src/lib/sciany.ts.
 *
 * Plik eksportuje też SciankiDzialowe i PrzelacznikSufitu – używane w lewym panelu kreatora.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { rect, rectBazowy, type PlanKuchni } from "@/lib/kuchnia";
import {
  czyObrys,
  etykietaSciany,
  GRUBOSC_SCIANY,
  gruboscScianyPokoju,
  KOLOR_SUFITU,
  PODLOGI,
  podlogaPlanu,
  type RodzajPodlogi,
  LIMITY_SCIANY,
  MAX_SCIAN_DODATKOWYCH,
  MAX_SCIAN_POKOJU,
  naroznikiSciany,
  normujKat,
  nowaSciana,
  obrysZProstokata,
  poleObrysu,
  scianyObrysu,
  scianyPokoju,
  scianyPokojuWszystkie,
  sprawdzObrys,
  wysokoscPokoju,
  wysokoscScianyPokoju,
  type Punkt,
  type ScianaDodatkowa,
  type ScianaPokoju,
  type ScianaUsuwalna,
  type UstawieniaScian,
} from "@/lib/sciany";
import { sprawdzScianeDodatkowa } from "@/lib/otwory";
import {
  GOTOWE_KSZTALTY,
  gotowyKsztalt,
  naObrys,
  obrotSciany,
  zastosujZmianePokoju,
  zmianaDlugosci,
  podzielSciane,
  przesunNaroznik,
  przesunScianeObrysu,
  usunSciane,
  zastosujObrys,
  zmienDlugosc,
  type Wynik,
} from "@/lib/ksztaltPokoju";
import KuchniaTlo from "../kuchnia/KuchniaTlo";
import PaletaSciany, { type EdycjaKolorowScian } from "../kuchnia/PaletaSciany";
import { PoleCm } from "./KreatorWlasciwosci";
import { useOknoPrzewijane } from "./useOknoPrzewijane";
import { Seg, toast } from "./ui";

type SetPlan = (fn: (p: PlanKuchni) => PlanKuchni) => void;

/** Zmiana ustawień ścian w planie (puste pola znikają). */
export function ustawSciany(setPlan: SetPlan, fn: (u: UstawieniaScian) => UstawieniaScian) {
  setPlan((p) => {
    const u: UstawieniaScian = { ...fn(p.sciany ?? {}) };
    if (!u.bez?.length) delete u.bez;
    if (!u.dodatkowe?.length) delete u.dodatkowe;
    if (!u.sufit) delete u.sufit;
    if (!u.podloga) delete u.podloga;
    if (!u.obrys?.length) delete u.obrys;
    if (!u.koloryScian || !Object.keys(u.koloryScian).length) delete u.koloryScian;
    if (!u.grubosci || !Object.keys(u.grubosci).length) delete u.grubosci;
    if (!u.wysokosci || !Object.keys(u.wysokosci).length) delete u.wysokosci;
    const { sciany: _s, ...reszta } = p;
    void _s;
    return Object.keys(u).length ? { ...reszta, sciany: u } : reszta;
  });
}

/** Własny kolor ściany pokoju i ścianki działowej (null = jak reszta) – kreator ścian, 3D, lewy panel. */
export function edycjaKolorowScian(setPlan: SetPlan): EdycjaKolorowScian {
  return {
    onSciana: (id, k) =>
      ustawSciany(setPlan, (u) => {
        const kol = { ...u.koloryScian };
        if (k) kol[id] = k;
        else delete kol[id];
        return { ...u, koloryScian: kol };
      }),
    onScianka: (i, k) =>
      ustawSciany(setPlan, (u) => ({
        ...u,
        dodatkowe: (u.dodatkowe ?? []).map((d, j) => {
          if (j !== i) return d;
          const { kolor: _k, ...reszta } = d;
          void _k;
          return k ? { ...reszta, kolor: k } : reszta;
        }),
      })),
  };
}

/** Wynik operacji na planie: zapis albo komunikat. */
function zapisz(setPlan: SetPlan, w: Wynik) {
  if ("blad" in w) {
    toast("Tak się nie da", { type: "err", desc: w.blad });
    return false;
  }
  setPlan(() => w.plan);
  return true;
}

/* ---------- sufit i ścianki działowe (też w lewym panelu) ---------- */

export function PrzelacznikSufitu({ plan, setPlan }: { plan: PlanKuchni; setPlan: SetPlan }) {
  const sufit = plan.sciany?.sufit;
  return (
    <div className="ks-sufit">
      <label className="kr-check">
        <input type="checkbox" checked={!!sufit} onChange={(e) => ustawSciany(setPlan, (u) => ({ ...u, sufit: e.target.checked ? {} : undefined }))} />
        <span>Sufit w 3D ({wysokoscPokoju(plan)} cm)</span>
      </label>
      {sufit ? (
        <label className="kr-check">
          <input
            type="color"
            aria-label="Kolor sufitu"
            value={sufit.kolor ?? KOLOR_SUFITU}
            onChange={(e) => {
              const k = e.target.value.toLowerCase();
              ustawSciany(setPlan, (u) => ({ ...u, sufit: k === KOLOR_SUFITU ? {} : { kolor: k } }));
            }}
          />
          <span>kolor</span>
        </label>
      ) : null}
    </div>
  );
}

/** Podłoga w 3D: panele albo płytki i ich kolor (gotowe odcienie albo własny). */
export function WyborPodlogi({ plan, setPlan }: { plan: PlanKuchni; setPlan: SetPlan }) {
  const { rodzaj, kolor } = podlogaPlanu(plan);
  const ustaw = (r: RodzajPodlogi, k?: string) =>
    ustawSciany(setPlan, (u) => {
      // Domyślne panele w domyślnym kolorze – bez wpisu w planie.
      const dom = r === "panele" && (!k || k === PODLOGI.panele.domyslny);
      return { ...u, podloga: dom ? undefined : { rodzaj: r, ...(k && k !== PODLOGI[r].domyslny ? { kolor: k } : {}) } };
    });
  return (
    <div className="ks-podloga">
      <div className="ks-podloga-gora">
        <span>Podłoga</span>
        <Seg
          label="Podłoga"
          value={rodzaj}
          onChange={(r) => ustaw(r)}
          options={[
            { value: "panele", label: "Panele" },
            { value: "plytki", label: "Płytki" },
          ]}
        />
      </div>
      <div className="ks-podloga-kolory" role="radiogroup" aria-label={`Kolor podłogi – ${PODLOGI[rodzaj].nazwa.toLowerCase()}`}>
        {PODLOGI[rodzaj].kolory.map((k) => (
          <button key={k.kolor} type="button" role="radio" aria-checked={kolor === k.kolor} aria-label={k.nazwa} title={k.nazwa} className="ks-probka" style={{ background: k.kolor }} onClick={() => ustaw(rodzaj, k.kolor)} />
        ))}
        <label className="ks-probka ks-probka-wlasna" title="Własny kolor">
          <input type="color" aria-label="Własny kolor podłogi" value={kolor} onChange={(e) => ustaw(rodzaj, e.target.value.toLowerCase())} />
        </label>
      </div>
    </div>
  );
}

export function SciankiDzialowe({ plan, setPlan, kompakt = false }: { plan: PlanKuchni; setPlan: SetPlan; kompakt?: boolean }) {
  const dodatkowe = plan.sciany?.dodatkowe ?? [];
  const H = wysokoscPokoju(plan);
  const zmien = (i: number, zmiana: Partial<ScianaDodatkowa>) => {
    const stara = dodatkowe[i];
    if (!stara) return false;
    const nowa = { ...stara, ...zmiana };
    if (zmiana.kat !== undefined) nowa.kat = normujKat(zmiana.kat);
    const bledy = sprawdzScianeDodatkowa(plan, nowa);
    if (bledy.length) {
      toast("Ściana się tu nie zmieści", { type: "err", desc: bledy[0] });
      return false;
    }
    ustawSciany(setPlan, (u) => ({ ...u, dodatkowe: (u.dodatkowe ?? []).map((x, j) => (j === i ? nowa : x)) }));
  };
  const dodaj = () => {
    if (dodatkowe.length >= MAX_SCIAN_DODATKOWYCH) {
      toast("Limit ścianek", { type: "err", desc: `Najwyżej ${MAX_SCIAN_DODATKOWYCH} ścianek działowych.` });
      return;
    }
    let s = nowaSciana(plan, dodatkowe);
    for (let k = 0; k < 40 && sprawdzScianeDodatkowa(plan, s).length; k++) s = { ...s, z: s.z + 20 };
    ustawSciany(setPlan, (u) => ({ ...u, dodatkowe: [...(u.dodatkowe ?? []), s] }));
  };
  const [dlMin, dlMax] = LIMITY_SCIANY.dlugosc;
  const [grMin, grMax] = LIMITY_SCIANY.grubosc;
  return (
    <div className="ks-dzialowe">
      {dodatkowe.map((s, i) => (
        <div key={s.id} className="kr-sciana-karta" data-sciana-dodatkowa={i + 1}>
          <div className="kr-sciana-gora">
            <b>Ścianka {i + 1}</b>
            <input
              type="color"
              className="ks-kolor"
              aria-label={`Kolor ścianki ${i + 1}`}
              title="Kolor ścianki"
              value={s.kolor ?? "#e2ddd5"}
              onChange={(e) => edycjaKolorowScian(setPlan).onScianka(i, e.target.value.toLowerCase())}
            />
            {s.kolor ? (
              <button type="button" className="btn btn-plain" aria-label={`Kolor ścianki ${i + 1} jak reszta`} title="Kolor jak reszta ścian" onClick={() => edycjaKolorowScian(setPlan).onScianka(i, null)}>
                ⨯
              </button>
            ) : null}
            <span style={{ flex: 1 }} />
            <button type="button" className="btn btn-plain" aria-label={`Obróć ściankę ${i + 1} w lewo o 15°`} onClick={() => zmien(i, { kat: s.kat - 15 })}>
              ↺ 15°
            </button>
            <button type="button" className="btn btn-plain" aria-label={`Obróć ściankę ${i + 1} w prawo o 15°`} onClick={() => zmien(i, { kat: s.kat + 15 })}>
              ↻ 15°
            </button>
            <button type="button" className="btn btn-plain" aria-label={`Obróć ściankę ${i + 1} o 90°`} onClick={() => zmien(i, { kat: s.kat + 90 })}>
              90°
            </button>
            <button type="button" className="btn btn-plain kr-usun" aria-label={`Usuń ściankę ${i + 1}`} onClick={() => ustawSciany(setPlan, (u) => ({ ...u, dodatkowe: (u.dodatkowe ?? []).filter((_, j) => j !== i) }))}>
              Usuń
            </button>
          </div>
          {kompakt ? (
            <p className="kr-hint" style={{ margin: 0 }}>
              {s.dlugosc} cm · {s.kat}° · gr. {s.grubosc} cm – przeciągnij na rzucie
            </p>
          ) : (
            <div className="kr-dims kr-dims-3">
              <PoleCm id={`k-sd-${i}-dl`} label="Długość" value={s.dlugosc} min={dlMin} max={dlMax} onCommit={(n) => zmien(i, { dlugosc: n })} />
              <PoleCm id={`k-sd-${i}-kat`} label="Kąt" value={s.kat} min={0} max={359} jedn="°" onCommit={(n) => zmien(i, { kat: n })} />
              <PoleCm id={`k-sd-${i}-gr`} label="Grubość" value={s.grubosc} min={grMin} max={grMax} onCommit={(n) => zmien(i, { grubosc: n })} />
              <PoleCm id={`k-sd-${i}-x`} label="Środek od ściany B" value={Math.max(0, Math.round(s.x))} min={0} max={2500} onCommit={(n) => zmien(i, { x: n })} />
              <PoleCm id={`k-sd-${i}-z`} label="Środek od ściany A" value={Math.max(0, Math.round(s.z))} min={0} max={2500} onCommit={(n) => zmien(i, { z: n })} />
              <PoleCm id={`k-sd-${i}-h`} label="Wysokość" value={Math.min(s.wysokosc ?? H, H)} min={LIMITY_SCIANY.wysokosc[0]} max={H} onCommit={(n) => zmien(i, { wysokosc: n >= H ? undefined : n })} />
            </div>
          )}
        </div>
      ))}
      <button type="button" className="btn btn-ghost" onClick={dodaj}>
        + Ścianka działowa
      </button>
    </div>
  );
}

/* ---------- ściany pokoju (domyślne) – karta jak przy ściankach działowych ---------- */

/**
 * Ściany pokoju w lewym panelu: litery do wyboru (albo klik w ścianę na rzucie) i karta wybranej ściany –
 * kolor, długość, grubość, wysokość, obrót, usunięcie. Te same funkcje co przy ściankach działowych,
 * z ograniczeniami pokoju: A i B wyznaczają narożnik zabudowy (nie obracają się, A się nie usuwa).
 */
export function ScianyPokoju({
  plan,
  setPlan,
  wybrana,
  setWybrana,
}: {
  plan: PlanKuchni;
  setPlan: SetPlan;
  wybrana: ScianaPokoju | null;
  setWybrana: (id: ScianaPokoju | null) => void;
}) {
  const sciany = scianyPokoju(plan);
  const s = sciany.find((x) => x.id === wybrana) ?? null;
  const H = wysokoscPokoju(plan);
  const zastosuj = (z: ReturnType<typeof zmianaDlugosci>) => {
    if (!z) return void toast("Tak się nie da", { type: "err", desc: "Tej ściany nie można tak zmienić." });
    zapisz(setPlan, zastosujZmianePokoju(plan, z));
  };
  const ustawMape = (klucz: "grubosci" | "wysokosci", id: ScianaPokoju, v: number | undefined) =>
    ustawSciany(setPlan, (u) => {
      const m = { ...u[klucz] };
      if (v === undefined) delete m[id];
      else m[id] = v;
      return { ...u, [klucz]: m };
    });
  const usuwalna = (id: ScianaPokoju) => id !== "A" && !(id === "B" && plan.uklad === "L");
  const usun = (id: ScianaPokoju) => {
    const naNiej = [
      ...(plan.wywiad?.otwory ?? []).filter((o) => o.sciana === id).map((o) => (o.rodzaj === "okno" ? "okno" : "drzwi")),
      ...(plan.wywiad?.punkty ?? []).filter((p) => p.sciana === id).map(() => "gniazdko"),
      ...(plan.wywiad?.woda?.sciana === id ? ["woda"] : []),
    ];
    if (naNiej.length) return void toast(`Na ścianie ${id} jest ${Array.from(new Set(naNiej)).join(", ")}`, { type: "err", desc: "Przenieś je na inną ścianę, potem usuń ścianę." });
    if (czyObrys(plan)) {
      const k = scianyPokojuWszystkie(plan).findIndex((x) => x.id === id);
      const nowy = k >= 0 ? usunSciane(plan.sciany!.obrys!, k) : null;
      if (!nowy) return void toast("Tak się nie da", { type: "err", desc: "Tej ściany nie można usunąć." });
      if (!zapisz(setPlan, zastosujObrys(plan, nowy, true))) return;
    } else ustawSciany(setPlan, (u) => ({ ...u, bez: [...(u.bez ?? []), id as ScianaUsuwalna] }));
    setWybrana(null);
    toast(`Usunięto ścianę ${id}`, { desc: "Ctrl+Z cofa." });
  };
  const [grMin, grMax] = LIMITY_SCIANY.grubosc;
  const obrot = s ? (czyObrys(plan) || plan.pomieszczenie) && s.id !== "A" && s.id !== "B" : false;
  return (
    <div className="ks-pokoj">
      <div className="ks-litery" role="group" aria-label="Ściany pokoju">
        {sciany.map((x) => (
          <button key={x.id} type="button" className="btn btn-plain" aria-pressed={wybrana === x.id} onClick={() => setWybrana(wybrana === x.id ? null : x.id)} title={`Ściana ${x.id} · ${Math.round(x.dlugosc)} cm`}>
            {x.id}
          </button>
        ))}
      </div>
      {s ? (
        <div className="kr-sciana-karta" data-sciana-pokoju={s.id}>
          <div className="kr-sciana-gora">
            <b>Ściana {s.id}</b>
            <input
              type="color"
              className="ks-kolor"
              aria-label={`Kolor ściany ${s.id}`}
              title="Kolor ściany"
              value={plan.sciany?.koloryScian?.[s.id] ?? "#e2ddd5"}
              onChange={(e) => edycjaKolorowScian(setPlan).onSciana(s.id, e.target.value.toLowerCase())}
            />
            {plan.sciany?.koloryScian?.[s.id] ? (
              <button type="button" className="btn btn-plain" aria-label={`Kolor ściany ${s.id} jak reszta`} title="Kolor jak reszta ścian" onClick={() => edycjaKolorowScian(setPlan).onSciana(s.id, null)}>
                ⨯
              </button>
            ) : null}
            <span style={{ flex: 1 }} />
            {obrot ? (
              <>
                <button type="button" className="btn btn-plain" aria-label={`Obróć ścianę ${s.id} w lewo o 15°`} onClick={() => zastosuj(obrotSciany(plan, s.id, -15))}>
                  ↺ 15°
                </button>
                <button type="button" className="btn btn-plain" aria-label={`Obróć ścianę ${s.id} w prawo o 15°`} onClick={() => zastosuj(obrotSciany(plan, s.id, 15))}>
                  ↻ 15°
                </button>
              </>
            ) : null}
            {usuwalna(s.id) ? (
              <button type="button" className="btn btn-plain kr-usun" aria-label={`Usuń ścianę ${s.id}`} onClick={() => usun(s.id)}>
                Usuń
              </button>
            ) : null}
          </div>
          <div className="kr-dims kr-dims-3">
            <PoleCm id={`k-sp-${s.id}-dl`} label="Długość" value={Math.round(s.dlugosc)} min={20} max={2000} onCommit={(n) => Math.abs(n - s.dlugosc) >= 0.5 && zastosuj(zmianaDlugosci(plan, s.id, n))} />
            <PoleCm id={`k-sp-${s.id}-gr`} label="Grubość" value={gruboscScianyPokoju(plan, s.id)} min={grMin} max={grMax} onCommit={(n) => ustawMape("grubosci", s.id, n === GRUBOSC_SCIANY ? undefined : n)} />
            <PoleCm id={`k-sp-${s.id}-h`} label="Wysokość" value={wysokoscScianyPokoju(plan, s.id)} min={LIMITY_SCIANY.wysokosc[0]} max={H} onCommit={(n) => ustawMape("wysokosci", s.id, n >= H ? undefined : n)} />
          </div>
          <p className="kr-hint" style={{ margin: 0 }}>
            Na rzucie: kółko na końcu zmienia długość, kwadrat w połowie przesuwa ścianę.{s.id === "A" || s.id === "B" ? " Ściany A i B wyznaczają narożnik zabudowy – zmieniasz ich długość, nie położenie." : ""}
          </p>
        </div>
      ) : (
        <p className="kr-hint" style={{ margin: 0 }}>
          Kliknij ścianę na rzucie albo literę, żeby ją zmienić.
        </p>
      )}
    </div>
  );
}

/* ---------- rzut do edycji obrysu ---------- */

type Ciagniecie = { idx: number; obrys: Punkt[]; bledy: string[] };

function EdytorObrysu({ plan, setPlan, wybrana, setWybrana }: { plan: PlanKuchni; setPlan: SetPlan; wybrana: number | null; setWybrana: (k: number | null) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [ciag, setCiag] = useState<Ciagniecie | null>(null);
  const sprzatanie = useRef<(() => void) | null>(null);
  useEffect(() => () => sprzatanie.current?.(), []);
  const obrys = ciag?.obrys ?? (czyObrys(plan) ? plan.sciany!.obrys! : obrysZProstokata(plan));
  const sciany = scianyObrysu(obrys);
  const bez = new Set(plan.sciany?.bez ?? []);
  // Kadr z zapisanego kształtu (nie z podglądu): w trakcie przeciągania widok stoi, kursor nie „ucieka”.
  const obrysKadru = czyObrys(plan) ? plan.sciany!.obrys! : obrysZProstokata(plan);
  const xs = [...obrysKadru.map((p) => p.x), ...plan.elementy.flatMap((e) => [rect(e).x0, rect(e).x1])];
  const zs = [...obrysKadru.map((p) => p.z), ...plan.elementy.flatMap((e) => [rect(e).z0, rect(e).z1])];
  const x0 = Math.min(0, ...xs);
  const z0 = Math.min(0, ...zs);
  const x1 = Math.max(...xs);
  const z1 = Math.max(...zs);
  const u = Math.max(x1 - x0, z1 - z0, 200) / 520;
  const m = 70 * u;
  const vb = { x: x0 - m, y: z0 - m, w: x1 - x0 + 2 * m, h: z1 - z0 + 2 * m };

  const punkt = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: p.x, z: p.y };
  };

  // Gdy pokój jest jeszcze prostokątem – pierwsza zmiana kształtu zamienia go na obrys (okna i drzwi zostają).
  const bazowy = (): PlanKuchni | null => {
    if (czyObrys(plan)) return plan;
    const w = naObrys(plan);
    if ("blad" in w) {
      toast("Tak się nie da", { type: "err", desc: w.blad });
      return null;
    }
    return w.plan;
  };

  const zacznij = (ev: ReactPointerEvent<SVGCircleElement>, idx: number) => {
    if (ev.button !== 0 || idx === 0) return;
    ev.stopPropagation();
    ev.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const start = obrys;
    let teraz: Ciagniecie = { idx, obrys: start, bledy: [] };
    setCiag(teraz);
    svg.setPointerCapture(ev.pointerId);
    const move = (pe: PointerEvent) => {
      if (pe.pointerId !== ev.pointerId) return;
      const nowy = przesunNaroznik(start, idx, punkt(pe), pe.shiftKey ? 1 : 5);
      teraz = { idx, obrys: nowy, bledy: sprawdzObrys(nowy) };
      setCiag(teraz);
    };
    const up = (pe: PointerEvent) => {
      if (pe.pointerId !== ev.pointerId) return;
      sprzatanie.current?.();
      sprzatanie.current = null;
      if (svg.hasPointerCapture(pe.pointerId)) svg.releasePointerCapture(pe.pointerId);
      setCiag(null);
      if (teraz.obrys === start) return;
      if (teraz.bledy.length) return void toast("Tak się nie da", { type: "err", desc: teraz.bledy[0] });
      const baza = bazowy();
      if (baza) zapisz(setPlan, zastosujObrys(baza, teraz.obrys, false));
    };
    sprzatanie.current?.();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    sprzatanie.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  };

  // Chwycenie ściany: przesunięcie prostopadle (sąsiednie ściany się wydłużają / skracają). Klik bez ruchu – wybór ściany.
  const zacznijSciane = (ev: ReactPointerEvent<SVGElement>, k: number) => {
    if (ev.button !== 0) return;
    ev.stopPropagation();
    ev.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const start = obrys;
    const s0 = scianyObrysu(start)[k];
    const p0 = punkt(ev);
    let teraz: Ciagniecie = { idx: -1, obrys: start, bledy: [] };
    svg.setPointerCapture(ev.pointerId);
    const move = (pe: PointerEvent) => {
      if (pe.pointerId !== ev.pointerId) return;
      const q = punkt(pe);
      const krok = pe.shiftKey ? 1 : 5;
      const d = Math.round(((q.x - p0.x) * s0.nx + (q.z - p0.z) * s0.nz) / krok) * krok;
      const nowy = przesunScianeObrysu(start, k, d);
      if (!nowy) return;
      teraz = { idx: -1, obrys: nowy, bledy: sprawdzObrys(nowy) };
      setCiag(teraz);
    };
    const up = (pe: PointerEvent) => {
      if (pe.pointerId !== ev.pointerId) return;
      sprzatanie.current?.();
      sprzatanie.current = null;
      if (svg.hasPointerCapture(pe.pointerId)) svg.releasePointerCapture(pe.pointerId);
      setCiag(null);
      // Klik bez ruchu – wybór ściany (kolor, długość w liście).
      if (teraz.obrys === start) return void setWybrana(k);
      if (teraz.bledy.length) return void toast("Tak się nie da", { type: "err", desc: teraz.bledy[0] });
      const baza = bazowy();
      if (baza) zapisz(setPlan, zastosujObrys(baza, teraz.obrys, false));
    };
    sprzatanie.current?.();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    sprzatanie.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  };

  const podziel = (k: number) => {
    if (obrys.length >= MAX_SCIAN_POKOJU) return void toast("Limit ścian", { type: "err", desc: `Pokój może mieć najwyżej ${MAX_SCIAN_POKOJU} ścian.` });
    const baza = bazowy();
    if (baza && zapisz(setPlan, zastosujObrys(baza, podzielSciane(baza.sciany!.obrys!, k), true))) setWybrana(k);
  };

  const zly = !!ciag?.bledy.length;
  const fs = 13 * u;
  return (
    <svg
      ref={svgRef}
      className="ks-svg"
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      role="group"
      aria-label="Rzut ścian pokoju. Przeciągnij narożnik, plus w połowie ściany dzieli ją na dwie."
      onPointerDown={(e) => e.target === e.currentTarget && setWybrana(null)}
    >
      <polygon className="ks-pokoj" data-bad={zly ? "" : undefined} points={obrys.map((p) => `${p.x},${p.z}`).join(" ")} />
      {plan.elementy.map((e) => {
        const r = rectBazowy(e);
        return <rect key={e.id} className="ks-mebel" x={r.x0} y={r.z0} width={r.x1 - r.x0} height={r.z1 - r.z0} transform={e.kat ? `rotate(${-e.kat} ${e.x} ${e.z})` : undefined} />;
      })}
      {(plan.sciany?.dodatkowe ?? []).map((sd) => (
        <polygon key={sd.id} className="ks-dzialowa" points={naroznikiSciany(sd).map((p) => `${p.x},${p.z}`).join(" ")} />
      ))}
      {sciany.map((s, k) => {
        const x2 = s.x + s.dx * s.dlugosc;
        const z2 = s.z + s.dz * s.dlugosc;
        const mx = (s.x + x2) / 2;
        const mz = (s.z + z2) / 2;
        const kat = (Math.atan2(s.dz, s.dx) * 180) / Math.PI;
        const czytelny = kat > 90 ? kat - 180 : kat < -90 ? kat + 180 : kat;
        const tx = mx - s.nx * 16 * u;
        const tz = mz - s.nz * 16 * u;
        const otwory = (plan.wywiad?.otwory ?? []).filter((o) => o.sciana === s.id);
        return (
          <g key={s.id} className="ks-sciana" data-litera={s.id} data-bez={bez.has(s.id as ScianaUsuwalna) ? "" : undefined} data-wybrana={wybrana === k ? "" : undefined}>
            <line x1={s.x} y1={s.z} x2={x2} y2={z2} strokeWidth={9 * u} onPointerDown={(e) => zacznijSciane(e, k)} style={{ cursor: Math.abs(s.nx) > Math.abs(s.nz) ? "ew-resize" : "ns-resize", touchAction: "none" }}>
              <title>{`Ściana ${s.id} – przeciągnij, żeby ją przesunąć (sąsiednie się wydłużą). Shift: co 1 cm.`}</title>
            </line>
            {plan.sciany?.koloryScian?.[s.id] && !ciag ? (
              <line className="ks-kolor-linia" x1={s.x - s.nx * 1.6 * u} y1={s.z - s.nz * 1.6 * u} x2={x2 - s.nx * 1.6 * u} y2={z2 - s.nz * 1.6 * u} stroke={plan.sciany.koloryScian[s.id]} strokeWidth={3.4 * u} />
            ) : null}
            {!ciag
              ? otwory.map((o, i) => (
                  <line key={i} className={o.rodzaj === "okno" ? "ks-okno" : "ks-drzwi"} x1={s.x + s.dx * o.od} y1={s.z + s.dz * o.od} x2={s.x + s.dx * (o.od + o.szer)} y2={s.z + s.dz * (o.od + o.szer)} strokeWidth={7 * u} />
                ))
              : null}
            <text x={tx} y={tz} fontSize={fs} textAnchor="middle" dominantBaseline="central" transform={`rotate(${czytelny} ${tx} ${tz})`}>
              {Math.round(s.dlugosc)}
            </text>
            <circle className="ks-litera" cx={mx + s.nx * 20 * u} cy={mz + s.nz * 20 * u} r={10 * u} onPointerDown={() => setWybrana(k)} />
            <text className="ks-litera-t" x={mx + s.nx * 20 * u} y={mz + s.nz * 20 * u} fontSize={fs} textAnchor="middle" dominantBaseline="central">
              {s.id}
            </text>
            {!ciag && obrys.length < MAX_SCIAN_POKOJU ? (
              <g className="ks-plus" role="button" aria-label={`Podziel ścianę ${s.id}`} onPointerDown={(e) => (e.stopPropagation(), podziel(k))}>
                <circle cx={mx} cy={mz} r={7 * u} />
                <path d={`M${mx - 3.5 * u} ${mz}H${mx + 3.5 * u}M${mx} ${mz - 3.5 * u}V${mz + 3.5 * u}`} strokeWidth={1.6 * u} />
              </g>
            ) : null}
          </g>
        );
      })}
      {obrys.map((p, i) => (
        <circle
          key={i}
          className="ks-naroznik"
          data-staly={i === 0 ? "" : undefined}
          data-nr={i}
          cx={p.x}
          cy={p.z}
          r={(i === 0 ? 6 : 8) * u}
          onPointerDown={(e) => zacznij(e, i)}
          style={{ cursor: i === 0 ? "default" : i === 1 ? "ew-resize" : "move", touchAction: "none" }}
        >
          <title>{i === 0 ? "Narożnik zabudowy (stały)" : i === 1 ? "Koniec ściany A – przeciągnij w bok" : "Przeciągnij narożnik (Shift: co 1 cm)"}</title>
        </circle>
      ))}
      {zly ? (
        <text className="ks-blad" x={vb.x + vb.w / 2} y={vb.y + 22 * u} fontSize={fs} textAnchor="middle">
          {ciag!.bledy[0]}
        </text>
      ) : null}
    </svg>
  );
}

/* ---------- okno ---------- */

export default function KreatorScian({ plan, setPlan, onWysokosc, onClose }: { plan: PlanKuchni; setPlan: SetPlan; onWysokosc: (cm: number) => void; onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const [widok, setWidok] = useState<"rzut" | "3d">("rzut");
  const [wybrana, setWybrana] = useState<number | null>(null);
  const przewijanie = useOknoPrzewijane(open);
  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);
  // Delete / Backspace usuwa wybraną ścianę (poza polami tekstowymi).
  const klawisze = useRef<(e: KeyboardEvent) => void>(() => {});
  klawisze.current = (e) => {
    if (e.defaultPrevented || (e.key !== "Delete" && e.key !== "Backspace") || wybrana === null) return;
    const cel = e.target as HTMLElement | null;
    if (cel && (cel.isContentEditable || /^(input|textarea|select)$/i.test(cel.tagName))) return;
    e.preventDefault();
    usun(wybrana);
  };
  useEffect(() => {
    const on = (e: KeyboardEvent) => klawisze.current(e);
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  const obrys = czyObrys(plan) ? plan.sciany!.obrys! : obrysZProstokata(plan);
  const sciany = scianyPokojuWszystkie(czyObrys(plan) ? plan : { ...plan, sciany: { ...plan.sciany, obrys } });
  const bez = new Set(plan.sciany?.bez ?? []);
  const W = Math.max(...obrys.map((p) => p.x));
  const D = Math.max(...obrys.map((p) => p.z));

  const bazowy = (): PlanKuchni | null => {
    if (czyObrys(plan)) return plan;
    const w = naObrys(plan);
    if ("blad" in w) {
      toast("Tak się nie da", { type: "err", desc: w.blad });
      return null;
    }
    return w.plan;
  };
  const operacja = (fn: (w: Punkt[]) => Punkt[] | null, topologia: boolean) => {
    const baza = bazowy();
    if (!baza) return;
    const nowy = fn(baza.sciany!.obrys!);
    if (!nowy) return void toast("Tak się nie da", { type: "err", desc: "Tej ściany nie można zmienić w ten sposób." });
    zapisz(setPlan, zastosujObrys(baza, nowy, topologia));
  };

  /** Ściany A (i B w układzie L – przy niej stoją meble) nie usuwamy; pokój ma co najmniej 3 ściany. */
  const moznaUsunac = (id: string) => sciany.length > 3 && id !== "A" && !(id === "B" && plan.uklad === "L");
  const usun = (k: number) => {
    const s = sciany[k];
    if (!s) return;
    if (!moznaUsunac(s.id)) {
      toast(`Ściany ${s.id} nie można usunąć`, {
        type: "err",
        desc: sciany.length <= 3 ? "Pokój musi mieć co najmniej 3 ściany." : s.id === "A" ? "Od ściany A liczy się zabudowa. Możesz zmienić jej długość." : "Przy ścianie B stoi zabudowa w L.",
      });
      return;
    }
    const baza = bazowy();
    if (!baza) return;
    const nowy = usunSciane(baza.sciany!.obrys!, k);
    if (!nowy) return void toast("Tak się nie da", { type: "err", desc: "Tej ściany nie można usunąć." });
    if (zapisz(setPlan, zastosujObrys(baza, nowy, true))) {
      setWybrana(null);
      toast(`Usunięto ścianę ${s.id}`, { desc: "Ctrl+Z cofa." });
    }
  };

  const przelaczSciane = (id: ScianaUsuwalna, jest: boolean) => {
    if (!jest) {
      const naNiej = [
        ...(plan.wywiad?.otwory ?? []).filter((o) => o.sciana === id).map((o) => (o.rodzaj === "okno" ? "okno" : "drzwi")),
        ...(plan.wywiad?.punkty ?? []).filter((p) => p.sciana === id).map(() => "gniazdko"),
        ...(plan.wywiad?.woda?.sciana === id ? ["woda"] : []),
      ];
      if (naNiej.length) return void toast(`Na ścianie ${id} jest ${Array.from(new Set(naNiej)).join(", ")}`, { type: "err", desc: "Przenieś je na inną ścianę w kroku „Okna i instalacje”, potem usuń ścianę." });
    }
    ustawSciany(setPlan, (u) => ({ ...u, bez: jest ? (u.bez ?? []).filter((b) => b !== id) : [...(u.bez ?? []), id] }));
  };

  return (
    <div className="overlay" data-open={open ? "" : undefined}>
      <div className="backdrop" onClick={onClose} />
      <div className="modal ks-okno" role="dialog" aria-modal="true" aria-labelledby="ks-tytul" data-cofanie="">
        <div className="m-pad pr-head">
          <div className="m-top">
            <h2 id="ks-tytul" style={{ fontSize: 15 }}>
              Kreator ścian
            </h2>
            <span className="faint" style={{ fontSize: 12.5 }}>
              {sciany.length} {sciany.length < 5 ? "ściany" : "ścian"} · {(poleObrysu(obrys) / 10000).toLocaleString("pl-PL", { maximumFractionDigits: 1 })} m²
            </span>
            <span style={{ flex: 1 }} />
            <button type="button" className="btn btn-ink" onClick={onClose}>
              Gotowe
            </button>
          </div>
        </div>
        <div className="ks-body">
          <div className="ks-panel" data-przewijanie={przewijanie ? "" : undefined}>
            <section>
              <h3>Kształt</h3>
              <div className="ks-gotowe">
                {GOTOWE_KSZTALTY.map((k) => (
                  <button key={k.id} type="button" className="btn btn-ghost" onClick={() => operacja(() => gotowyKsztalt(k.id, Math.round(W), Math.round(D)), true)}>
                    {k.nazwa}
                  </button>
                ))}
              </div>
              <p className="kr-hint">Na rzucie: chwyć ścianę i przesuń ją (sąsiednie ściany się wydłużą), przeciągnij narożnik, „+” w połowie ściany dzieli ją na dwie (nowy narożnik). Kliknij ścianę i naciśnij Delete (albo „Usuń”), żeby ją usunąć. Ctrl+Z cofa zmianę. Narożnik przy ścianach A i B stoi w miejscu – od niego liczy się zabudowa.</p>
            </section>
            <section>
              <h3>Ściany</h3>
              <ol className="ks-lista">
                {sciany.map((s, k) => {
                  const usuwalna = s.id !== "A" && !(s.id === "B" && plan.uklad === "L");
                  const jest = !bez.has(s.id as ScianaUsuwalna);
                  return (
                    <li key={s.id} data-litera={s.id} data-wybrana={wybrana === k ? "" : undefined}>
                      <span className="ks-znak">{s.id}</span>
                      <PoleCm
                        id={`ks-dl-${s.id}`}
                        label={etykietaSciany(czyObrys(plan) ? plan : { ...plan, sciany: { obrys } }, s.id)}
                        value={Math.round(s.dlugosc)}
                        min={20}
                        max={3000}
                        onCommit={(n) => {
                          if (Math.abs(n - s.dlugosc) < 0.5) return;
                          operacja((w) => zmienDlugosc(w, k, n), false);
                        }}
                      />
                      {wybrana === k ? (
                        <div className="ks-paleta">
                          <PaletaSciany tytul={`Ściana ${s.id}`} kolor={plan.sciany?.koloryScian?.[s.id] ?? null} onKolor={(kol) => edycjaKolorowScian(setPlan).onSciana(s.id, kol)} />
                        </div>
                      ) : null}
                      <div className="ks-akcje">
                        <button
                          type="button"
                          className="btn btn-plain ks-kolor-btn"
                          aria-label={`Kolor ściany ${s.id}`}
                          aria-expanded={wybrana === k}
                          onClick={() => setWybrana(wybrana === k ? null : k)}
                        >
                          <i style={{ background: plan.sciany?.koloryScian?.[s.id] ?? "repeating-linear-gradient(135deg,#bbb 0 3px,#eee 3px 6px)" }} />
                          Kolor
                        </button>
                        {usuwalna ? (
                          <label className="kr-check" title="Odznacz, gdy tu nie ma ściany (otwarta przestrzeń)">
                            <input type="checkbox" checked={jest} aria-label={`Ściana ${s.id} jest`} onChange={(e) => przelaczSciane(s.id as ScianaUsuwalna, e.target.checked)} />
                            <span>jest</span>
                          </label>
                        ) : null}
                        <button type="button" className="btn btn-plain" aria-label={`Podziel ścianę ${s.id}`} disabled={obrys.length >= MAX_SCIAN_POKOJU} onClick={() => operacja((w) => podzielSciane(w, k), true)}>
                          Podziel
                        </button>
                        {moznaUsunac(s.id) ? (
                          <button
                            type="button"
                            className="btn btn-plain kr-usun"
                            aria-label={`Usuń ścianę ${s.id}`}
                            title="Usuń ścianę – sąsiednie ściany się połączą (Delete)"
                            onClick={() => usun(k)}
                          >
                            Usuń
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
            <section>
              <h3>Wysokość, sufit i podłoga</h3>
              <div className="kr-dims">
                <PoleCm id="ks-wys" label="Wysokość do sufitu" value={wysokoscPokoju(plan)} min={180} max={450} onCommit={(n) => onWysokosc(n)} />
              </div>
              <PrzelacznikSufitu plan={plan} setPlan={setPlan} />
              <WyborPodlogi plan={plan} setPlan={setPlan} />
            </section>
            <section>
              <h3>Ścianki działowe</h3>
              <p className="kr-hint">Ścianka w środku pokoju (np. przy wyspie). Przesuwasz ją też na rzucie w kreatorze.</p>
              <SciankiDzialowe plan={plan} setPlan={setPlan} />
            </section>
          </div>
          <div className="ks-widok">
            <Seg
              label="Widok"
              value={widok}
              onChange={setWidok}
              options={[
                { value: "rzut", label: "Rzut" },
                { value: "3d", label: "Podgląd 3D" },
              ]}
            />
            {widok === "rzut" && wybrana !== null && sciany[wybrana] ? (
              <div className="ks-wybrana">
                <span>
                  Ściana <b>{sciany[wybrana].id}</b> · {Math.round(sciany[wybrana].dlugosc)} cm
                </span>
                {moznaUsunac(sciany[wybrana].id) ? (
                  <button type="button" className="btn btn-ghost kr-usun" onClick={() => usun(wybrana)} title="Delete">
                    Usuń ścianę
                  </button>
                ) : null}
                <button type="button" className="btn btn-plain" onClick={() => setWybrana(null)} aria-label="Odznacz ścianę">
                  ⨯
                </button>
              </div>
            ) : null}
            {widok === "rzut" ? (
              <EdytorObrysu plan={plan} setPlan={setPlan} wybrana={wybrana} setWybrana={setWybrana} />
            ) : (
              <div className="ks-3d">
                <KuchniaTlo plan={plan} edycjaKolorow={edycjaKolorowScian(setPlan)} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
