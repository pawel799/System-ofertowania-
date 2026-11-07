"use client";

/*
 * Krok „Pomiar” → Ściany i sufit: które ściany pokoju są (otwarta przestrzeń = bez ściany C, D albo B),
 * dodatkowe ściany (działowe, skosy, wnęki) z położeniem, długością, kątem, grubością i wysokością, oraz sufit w 3D.
 * Dodatkowe ściany przesuwa się też myszką na rzucie i w 3D (RzutKuchni, Sciany) – tu są dokładne wymiary.
 */
import type { PlanKuchni } from "@/lib/kuchnia";
import {
  KOLOR_SUFITU,
  LIMITY_SCIANY,
  MAX_SCIAN_DODATKOWYCH,
  nowaSciana,
  normujKat,
  SCIANA_LABEL,
  scianyPokojuWszystkie,
  wysokoscPokoju,
  type ScianaDodatkowa,
  type ScianaUsuwalna,
  type UstawieniaScian,
} from "@/lib/sciany";
import { sprawdzScianeDodatkowa } from "@/lib/otwory";
import { PoleCm } from "./KreatorWlasciwosci";
import { toast } from "./ui";

type Props = { plan: PlanKuchni; setPlan: (fn: (p: PlanKuchni) => PlanKuchni) => void };

const czyste = (u: UstawieniaScian): UstawieniaScian | undefined => {
  const out: UstawieniaScian = { ...u };
  if (!out.bez?.length) delete out.bez;
  if (!out.dodatkowe?.length) delete out.dodatkowe;
  if (!out.sufit) delete out.sufit;
  return Object.keys(out).length ? out : undefined;
};

export default function KreatorSciany({ plan, setPlan }: Props) {
  const sc = plan.sciany ?? {};
  const dodatkowe = sc.dodatkowe ?? [];
  const H = wysokoscPokoju(plan);
  const usuwalne = scianyPokojuWszystkie(plan).filter((s) => s.id !== "A" && !(s.id === "B" && plan.uklad === "L"));

  const ustaw = (fn: (u: UstawieniaScian) => UstawieniaScian) =>
    setPlan((p) => {
      const nowe = czyste(fn(p.sciany ?? {}));
      const { sciany: _s, ...reszta } = p;
      void _s;
      return nowe ? { ...reszta, sciany: nowe } : reszta;
    });

  const przelaczSciane = (id: ScianaUsuwalna, jest: boolean) => {
    if (!jest) {
      const naNiej = [
        ...(plan.wywiad?.otwory ?? []).filter((o) => o.sciana === id).map((o) => (o.rodzaj === "okno" ? "okno" : "drzwi")),
        ...(plan.wywiad?.punkty ?? []).filter((p) => p.sciana === id).map(() => "gniazdko"),
        ...(plan.wywiad?.woda?.sciana === id ? ["woda"] : []),
      ];
      if (naNiej.length) {
        toast(`Na ścianie ${id} jest ${Array.from(new Set(naNiej)).join(", ")}`, { type: "err", desc: "Przenieś je na inną ścianę w kroku „Okna i instalacje”, potem usuń ścianę." });
        return;
      }
    }
    ustaw((u) => ({ ...u, bez: jest ? (u.bez ?? []).filter((b) => b !== id) : [...(u.bez ?? []), id] }));
  };

  /** Zmiana dodatkowej ściany z pól – sprawdzona jak przy przeciąganiu (nie może wejść na meble). */
  const zmienSciane = (i: number, zmiana: Partial<ScianaDodatkowa>) => {
    const stara = dodatkowe[i];
    if (!stara) return false;
    const nowa = { ...stara, ...zmiana };
    if (zmiana.kat !== undefined) nowa.kat = normujKat(zmiana.kat);
    const bledy = sprawdzScianeDodatkowa(plan, nowa);
    if (bledy.length) {
      toast("Ściana się tu nie zmieści", { type: "err", desc: bledy[0] });
      return false;
    }
    ustaw((u) => ({ ...u, dodatkowe: (u.dodatkowe ?? []).map((x, j) => (j === i ? nowa : x)) }));
  };

  const dodaj = () => {
    if (dodatkowe.length >= MAX_SCIAN_DODATKOWYCH) {
      toast("Limit ścian", { type: "err", desc: `Najwyżej ${MAX_SCIAN_DODATKOWYCH} dodatkowych ścian.` });
      return;
    }
    let s = nowaSciana(plan, dodatkowe);
    // Przesuń w głąb pokoju, aż nie wchodzi na meble (co 20 cm).
    for (let k = 0; k < 40 && sprawdzScianeDodatkowa(plan, s).length; k++) s = { ...s, z: s.z + 20 };
    ustaw((u) => ({ ...u, dodatkowe: [...(u.dodatkowe ?? []), s] }));
  };

  const [dlMin, dlMax] = LIMITY_SCIANY.dlugosc;
  const [grMin, grMax] = LIMITY_SCIANY.grubosc;

  return (
    <section className="kr-sciany" aria-labelledby="kr-sciany-tytul">
      <h3 id="kr-sciany-tytul">Ściany i sufit</h3>
      {usuwalne.length ? (
        <div className="kr-sciany-pokoju" role="group" aria-label="Ściany pokoju">
          {usuwalne.map((s) => {
            const jest = !(sc.bez ?? []).includes(s.id as ScianaUsuwalna);
            return (
              <label key={s.id} className="kr-check">
                <input type="checkbox" checked={jest} onChange={(e) => przelaczSciane(s.id as ScianaUsuwalna, e.target.checked)} />
                <span>{SCIANA_LABEL[s.id]}</span>
              </label>
            );
          })}
          <p className="kr-hint">Odznacz ścianę, której nie ma (otwarta kuchnia, przejście do salonu).</p>
        </div>
      ) : (
        <p className="kr-hint">Podaj szerokość i długość pokoju, żeby ustawić ściany C i D.</p>
      )}

      <div className="kr-sufit">
        <label className="kr-check">
          <input type="checkbox" checked={!!sc.sufit} onChange={(e) => ustaw((u) => ({ ...u, sufit: e.target.checked ? {} : undefined }))} />
          <span>Sufit w 3D ({H} cm)</span>
        </label>
        {sc.sufit ? (
          <label className="kr-check">
            <input
              type="color"
              aria-label="Kolor sufitu"
              value={sc.sufit.kolor ?? KOLOR_SUFITU}
              onChange={(e) => {
                const k = e.target.value.toLowerCase();
                ustaw((u) => ({ ...u, sufit: k === KOLOR_SUFITU ? {} : { kolor: k } }));
              }}
            />
            <span>Kolor sufitu</span>
          </label>
        ) : null}
      </div>

      <div className="kr-sciany-lista">
        {dodatkowe.map((s, i) => (
          <div key={s.id} className="kr-sciana-karta" data-sciana-dodatkowa={i + 1}>
            <div className="kr-sciana-gora">
              <b>Ściana {i + 1}</b>
              <span className="grow" style={{ flex: 1 }} />
              <button type="button" className="btn btn-plain" aria-label={`Obróć ścianę ${i + 1} w lewo o 15°`} onClick={() => zmienSciane(i, { kat: s.kat - 15 })}>
                ↺ 15°
              </button>
              <button type="button" className="btn btn-plain" aria-label={`Obróć ścianę ${i + 1} w prawo o 15°`} onClick={() => zmienSciane(i, { kat: s.kat + 15 })}>
                ↻ 15°
              </button>
              <button type="button" className="btn btn-plain" aria-label={`Obróć ścianę ${i + 1} o 90°`} onClick={() => zmienSciane(i, { kat: s.kat + 90 })}>
                90°
              </button>
              <button type="button" className="btn btn-plain kr-usun" aria-label={`Usuń ścianę ${i + 1}`} onClick={() => ustaw((u) => ({ ...u, dodatkowe: (u.dodatkowe ?? []).filter((_, j) => j !== i) }))}>
                Usuń
              </button>
            </div>
            <div className="kr-dims kr-dims-3">
              <PoleCm id={`k-sd-${i}-dl`} label="Długość" value={s.dlugosc} min={dlMin} max={dlMax} onCommit={(n) => zmienSciane(i, { dlugosc: n })} />
              <PoleCm id={`k-sd-${i}-kat`} label="Kąt" value={s.kat} min={0} max={359} jedn="°" onCommit={(n) => zmienSciane(i, { kat: n })} />
              <PoleCm id={`k-sd-${i}-gr`} label="Grubość" value={s.grubosc} min={grMin} max={grMax} onCommit={(n) => zmienSciane(i, { grubosc: n })} />
              <PoleCm id={`k-sd-${i}-x`} label="Środek od ściany B" value={Math.max(0, Math.round(s.x))} min={0} max={2500} onCommit={(n) => zmienSciane(i, { x: n })} />
              <PoleCm id={`k-sd-${i}-z`} label="Środek od ściany A" value={Math.max(0, Math.round(s.z))} min={0} max={2500} onCommit={(n) => zmienSciane(i, { z: n })} />
              <PoleCm
                id={`k-sd-${i}-h`}
                label="Wysokość"
                value={Math.min(s.wysokosc ?? H, H)}
                min={LIMITY_SCIANY.wysokosc[0]}
                max={H}
                onCommit={(n) => zmienSciane(i, { wysokosc: n >= H ? undefined : n })}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="actions">
        <button type="button" className="btn btn-ghost" onClick={dodaj}>
          + Dodaj ścianę
        </button>
      </div>
      <p className="kr-hint">
        Na rzucie przeciągnij ścianę, żeby ją przesunąć, a kółko na końcu – żeby obrócić i zmienić długość (Shift: co 1 cm i 1°). W 3D ścianę też można przeciągnąć po podłodze.
      </p>
    </section>
  );
}
