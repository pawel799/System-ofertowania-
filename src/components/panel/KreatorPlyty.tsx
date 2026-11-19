"use client";

/*
 * Kreator → krok „Materiały” → „Płyty producentów” (K3D-PLYTY-01): wybór płyty osobno dla korpusu, frontów,
 * blatu i obrzeża – wyszukiwarka po kodzie i nazwie, filtr producenta i typu.
 * Baza (data/boards/*.json + własna baza stolarni z CSV) ładuje się leniwie dopiero po otwarciu wyboru,
 * więc nie powiększa kreatora. Wybór trafia do planu (plan.plyty) – zapisuje się w ofercie (KV), widać go w 3D,
 * na rysunku, w PDF i w formatkach. Kolor na ekranie jest poglądowy (własny HEX, bez tekstur producenta).
 */
import { useEffect, useMemo, useState } from "react";
import type { PlanKuchni } from "@/lib/kuchnia";
import {
  GRUBOSCI_BLATU,
  GRUBOSCI_KOMPAKTU,
  GRUBOSC_KORPUSU,
  NOTA_PLYT,
  opisPlytyPelny,
  PRODUCENCI,
  SLOT_PLYTY_LABEL,
  SLOTY_PLYT,
  szukajPlyt,
  TYP_PLYTY_LABEL,
  TYPY_SLOTU,
  wybierzPlyte,
  nazwaProducenta,
  type Board,
  type MaterialyPlyt,
  type Producent,
  type SlotPlyty,
  type TypPlyty,
} from "@/lib/plyty";
import type { GrupyMaterialow } from "@/lib/opcjeProjektu";
import { plytyApi } from "./offerApi";

/** Baza płyt: wbudowane pliki (osobny chunk) + baza stolarni z KV. Raz na sesję strony. */
let bazaPromise: Promise<Board[]> | null = null;
export function wczytajBazePlyt(): Promise<Board[]> {
  if (!bazaPromise) {
    bazaPromise = Promise.all([
      import("../../../data/boards/egger.json").then((m) => m.default as unknown as Board[]),
      import("../../../data/boards/kronospan.json").then((m) => m.default as unknown as Board[]),
      plytyApi
        .get()
        .then((r) => r.plyty)
        .catch(() => [] as Board[]),
    ]).then(([e, k, csv]) => [...csv, ...e, ...k]);
    bazaPromise.catch(() => {
      bazaPromise = null;
    });
  }
  return bazaPromise;
}

function grubosciSlotu(slot: SlotPlyty, typ: TypPlyty, b?: Board): number[] {
  if (slot === "blat") return typ === "kompakt" ? [...GRUBOSCI_KOMPAKTU] : [...GRUBOSCI_BLATU];
  return b?.thicknesses.length ? b.thicknesses : [GRUBOSC_KORPUSU];
}

function WyborPlyty({ slot, plyty, ustaw }: { slot: SlotPlyty; plyty: MaterialyPlyt; ustaw: (slot: SlotPlyty, p: MaterialyPlyt[SlotPlyty]) => void }) {
  const wybrana = plyty[slot];
  const [otwarte, setOtwarte] = useState(false);
  const [baza, setBaza] = useState<Board[] | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [tekst, setTekst] = useState("");
  const [producent, setProducent] = useState<Producent | "">("");
  const [typ, setTyp] = useState<TypPlyty | "">("");
  const typy = TYPY_SLOTU[slot];

  useEffect(() => {
    if (!otwarte && !wybrana) return;
    let zyje = true;
    wczytajBazePlyt()
      .then((b) => zyje && setBaza(b))
      .catch(() => zyje && setBlad("Nie udało się wczytać bazy płyt."));
    return () => {
      zyje = false;
    };
  }, [otwarte, wybrana]);

  const wyniki = useMemo(() => (baza ? szukajPlyt(baza, { tekst, producent, typy: typ ? [typ] : typy }) : []), [baza, tekst, producent, typ, typy]);
  const plytaBazy = wybrana ? baza?.find((b) => b.id === wybrana.ref) : undefined;
  const grubosci = wybrana ? grubosciSlotu(slot, wybrana.type, plytaBazy) : [];
  const id = `k-plyta-${slot}`;

  return (
    <div className="field kr-plyta" data-plyta={slot}>
      <span className="lab">{SLOT_PLYTY_LABEL[slot]}</span>
      {wybrana ? (
        <div className="kr-plyta-wybrana">
          <span className="kat-probka" style={{ background: wybrana.hex }} aria-hidden />
          <span className="kr-plyta-opis" data-testid={`plyta-${slot}`}>
            {opisPlytyPelny(wybrana)}
          </span>
          {grubosci.length > 1 || !grubosci.includes(wybrana.grubosc) ? (
            <select
              className="input kr-plyta-gr"
              aria-label={`Grubość: ${SLOT_PLYTY_LABEL[slot]}`}
              value={wybrana.grubosc}
              onChange={(e) => ustaw(slot, { ...wybrana, grubosc: Number(e.target.value) })}
            >
              {Array.from(new Set([...grubosci, wybrana.grubosc]))
                .sort((a, b) => a - b)
                .map((g) => (
                  <option key={g} value={g}>
                    {String(g).replace(".", ",")} mm
                  </option>
                ))}
            </select>
          ) : null}
          <button type="button" className="btn btn-plain" onClick={() => setOtwarte(!otwarte)}>
            Zmień
          </button>
          <button type="button" className="btn btn-plain" onClick={() => ustaw(slot, undefined)}>
            Usuń
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-ghost" aria-expanded={otwarte} onClick={() => setOtwarte(!otwarte)}>
          {otwarte ? "Zamknij wybór" : "Wybierz płytę producenta"}
        </button>
      )}
      {(slot === "korpus" || slot === "front") && wybrana && wybrana.grubosc !== GRUBOSC_KORPUSU ? (
        <p className="kr-warn">Wymiary mebli i formatek są liczone dla płyty {GRUBOSC_KORPUSU} mm.</p>
      ) : null}
      {otwarte ? (
        <div className="kr-plyta-szukaj">
          <input
            id={id}
            className="input"
            type="search"
            placeholder="Kod albo nazwa, np. H1145 albo dąb"
            aria-label={`Szukaj płyty: ${SLOT_PLYTY_LABEL[slot]}`}
            value={tekst}
            onChange={(e) => setTekst(e.target.value)}
          />
          <div className="kr-plyta-filtry">
            <select className="input" aria-label="Producent" value={producent} onChange={(e) => setProducent(e.target.value as Producent | "")}>
              <option value="">Wszyscy producenci</option>
              {PRODUCENCI.map((p) => (
                <option key={p} value={p}>
                  {p === "Inny" ? "Inni (z mojej bazy)" : p}
                </option>
              ))}
            </select>
            {typy.length > 1 ? (
              <select className="input" aria-label="Typ" value={typ} onChange={(e) => setTyp(e.target.value as TypPlyty | "")}>
                <option value="">Wszystkie typy</option>
                {typy.map((t) => (
                  <option key={t} value={t}>
                    {TYP_PLYTY_LABEL[t]}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          {blad ? <p className="err">{blad}</p> : null}
          {!baza && !blad ? <p className="kr-hint">Wczytywanie bazy płyt…</p> : null}
          {baza && !wyniki.length ? <p className="kr-hint">Brak płyt dla tego wyszukiwania.</p> : null}
          <ul className="kr-plyta-lista" role="listbox" aria-label={`Płyty: ${SLOT_PLYTY_LABEL[slot]}`}>
            {wyniki.slice(0, 40).map((b) => (
              <li key={`${b.source}-${b.id}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={wybrana?.ref === b.id}
                  className="kr-plyta-poz"
                  onClick={() => {
                    ustaw(slot, wybierzPlyte(b));
                    setOtwarte(false);
                  }}
                >
                  <span className="kat-probka" style={{ background: b.hex }} aria-hidden />
                  <span>
                    <b>
                      {nazwaProducenta(b)} {b.code}
                      {b.structure ? ` ${b.structure}` : ""}
                    </b>{" "}
                    {b.name}
                    <span className="faint">
                      {" "}
                      · {TYP_PLYTY_LABEL[b.type]} · {b.thicknesses.map((t) => String(t).replace(".", ",")).join("/")} mm{b.source === "csv" ? " · moja baza" : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {wyniki.length > 40 ? <p className="kr-hint">Pokazano 40 z {wyniki.length} – zawęź wyszukiwanie.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function KreatorPlyty({ plan, setPlan, grupy }: { plan: PlanKuchni; setPlan: (fn: (p: PlanKuchni) => PlanKuchni) => void; grupy: GrupyMaterialow }) {
  const plyty = plan.plyty ?? {};
  const sloty = SLOTY_PLYT.filter((s) => (s === "front" ? grupy.front : s === "blat" ? grupy.blat : grupy.front || grupy.korpus || grupy.srodek));
  if (!sloty.length) return null;
  const ustaw = (slot: SlotPlyty, p: MaterialyPlyt[SlotPlyty]) =>
    setPlan((pl) => {
      const n: MaterialyPlyt = { ...(pl.plyty ?? {}) };
      if (p) n[slot] = p;
      else delete n[slot];
      const { plyty: _stare, ...bez } = pl;
      void _stare;
      return Object.keys(n).length ? { ...bez, plyty: n } : bez;
    });
  return (
    <section className="kr-plyty" data-plyty>
      <h3>Płyty producentów</h3>
      <p className="kr-hint">
        Opcjonalnie: konkretna płyta po kodzie dekoru. Zastępuje kolor frontów, boków albo blatu we wszystkich meblach (mebel z własnym kolorem zostaje przy
        swoim) i trafia do PDF oraz listy formatek.
      </p>
      {sloty.map((s) => (
        <WyborPlyty key={s} slot={s} plyty={plyty} ustaw={ustaw} />
      ))}
      <p className="kr-hint kr-nota-plyt">{NOTA_PLYT}</p>
    </section>
  );
}
