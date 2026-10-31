"use client";

/*
 * Kreator → okno elementu: wymiary i wnętrze (półki, szuflady, drążki, rodzaj drzwi).
 * Otwiera się po kliknięciu modułu w katalogu (przed dodaniem) i z „Właściwości” (zmiana).
 * Gotowe układy dla rodzaju mebla albo własny układ; walidacja realnych wymiarów (src/lib/wnetrze.ts)
 * blokuje zapis, gdy coś nie ma sensu (np. drążek w szafie 40 cm, półka 120 cm bez przegrody).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cenaElementu, limityElementu, MEBLE, RODZAJ_LABEL, rodzajElementu, wycenianyElement, type NowyElement, type RodzajElementu, type Strefa } from "@/lib/kuchnia";
import { wpisPoId } from "@/lib/bibliotekaModeli";
import type { ModulCennik } from "@/lib/modul";
import {
  dopasujWnetrze,
  FRONT_LABEL,
  GRANICE,
  kategoriaWnetrza,
  maWnetrze,
  opisWnetrza,
  polkiKolumny,
  presetyDla,
  PRZESTRZEN_LABEL,
  rozloz,
  sprawdzWnetrze,
  swiatloH,
  szerokoscKolumny,
  typyPrzestrzeniDla,
  wnetrzeDomyslne,
  zPresetu,
  type Kolumna,
  type RodzajFrontu,
  type TypPrzestrzeni,
  type Wnetrze,
} from "@/lib/wnetrze";
import { formatPln } from "../pricing";
import { PoleCm } from "./KreatorWlasciwosci";

export type ElementOkna = NowyElement;

/** Odpowiednik modelu 3D z biblioteki jako moduł na wymiar (z edytowalnym wnętrzem). */
export function naWymiar(el: ElementOkna): ElementOkna | null {
  if (el.zrodlo !== "model") return null;
  const wpis = el.modelId ? wpisPoId(el.modelId) : undefined;
  const nazwa = `${el.nazwa}`.toLowerCase();
  let rodzaj: RodzajElementu | null = null;
  let strefa: Strefa = el.strefa;
  const g = wpis?.grupa;
  if (/przesuwn|wnękow/.test(nazwa)) rodzaj = "szafa-przesuwna";
  else if (/rtv/.test(nazwa)) rodzaj = "rtv";
  else if (/regał|witryn/.test(nazwa)) rodzaj = "regal";
  else if (/umywalk|łazienk/.test(nazwa) && el.strefa === "dolna") rodzaj = "umywalka";
  else if (g === "szafy" || /szafa|garderob|słupek łazienk/.test(nazwa)) rodzaj = "szafa";
  else if (g === "komody" || /komod|nocna|kontener/.test(nazwa)) rodzaj = el.strefa === "gorna" ? "szafka" : "komoda";
  else if (el.rodzaj && (MEBLE.has(el.rodzaj) || el.rodzaj === "szafka" || el.rodzaj === "szuflady" || el.rodzaj === "zlew" || el.rodzaj === "narozna")) rodzaj = el.rodzaj;
  if (!rodzaj) return null;
  if (rodzaj === "szafa" || rodzaj === "szafa-przesuwna" || rodzaj === "regal") strefa = "wysoka";
  if (rodzaj === "komoda" || rodzaj === "rtv" || rodzaj === "umywalka") strefa = "dolna";
  const lim = limityElementu({ rodzaj, strefa, zrodlo: "modul" });
  const w = Math.min(lim.w.max, Math.max(lim.w.min, el.w));
  const h = Math.min(lim.h.max, Math.max(lim.h.min, el.h));
  const d = Math.min(lim.d.max, Math.max(lim.d.min, el.d));
  const baza = { nazwa: el.nazwa, strefa, rodzaj, w, h, d, zrodlo: "modul" as const };
  return { ...baza, wnetrze: wnetrzeDomyslne(baza) ?? undefined };
}

const wysokoscPola = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

/** Widok z przodu przy otwartych drzwiach: kolumny, półki, szuflady, drążki. */
export function SchematWnetrza({ el, wn, rozmiar = 200, podpisy = false }: { el: { w: number; h: number }; wn: Wnetrze; rozmiar?: number; podpisy?: boolean }) {
  const k = (rozmiar - 16) / Math.max(el.w, el.h, 1);
  const W = el.w * k;
  const H = el.h * k;
  const x = (rozmiar - W) / 2;
  const y = (rozmiar - H) / 2;
  const t = 1.8 * k;
  const n = wn.kolumny.length;
  const kw = szerokoscKolumny(el.w, n) * k;
  const s = { stroke: "currentColor", strokeWidth: 1.2, fill: "none" } as const;
  const el2: ReactNode[] = [<rect key="o" x={x} y={y} width={W} height={H} {...s} strokeWidth={1.6} />];
  wn.kolumny.forEach((kol, c) => {
    const x0 = x + t + c * (kw + t);
    if (c > 0) el2.push(<line key={`p${c}`} x1={x0 - t / 2} y1={y + t} x2={x0 - t / 2} y2={y + H - t} {...s} />);
    let yy = y + H - t; // od dołu
    kol.sekcje.forEach((sek, i) => {
      const h = sek.h * k;
      const y1 = yy - h;
      if (sek.typ === "szuflada") {
        el2.push(<rect key={`s${c}-${i}`} x={x0 + 1.5} y={y1 + 1} width={kw - 3} height={Math.max(2, h - 2)} {...s} fill="color-mix(in srgb, currentColor 10%, transparent)" />);
        el2.push(<line key={`su${c}-${i}`} x1={x0 + kw / 2 - kw / 7} y1={y1 + Math.min(5, h / 3)} x2={x0 + kw / 2 + kw / 7} y2={y1 + Math.min(5, h / 3)} {...s} />);
      }
      if (sek.typ === "drazek") {
        const yd = y1 + Math.min(8, h * 0.08);
        el2.push(<line key={`d${c}-${i}`} x1={x0 + 2} y1={yd} x2={x0 + kw - 2} y2={yd} {...s} strokeWidth={2} />);
        for (let j = 1; j <= 3; j++) {
          const hx = x0 + (kw * j) / 4;
          el2.push(<path key={`w${c}-${i}-${j}`} d={`M${hx} ${yd} l-${Math.min(6, kw / 10)} ${Math.min(7, h / 8)} h${2 * Math.min(6, kw / 10)} z`} {...s} strokeWidth={0.9} />);
        }
      }
      if (podpisy && h > 9) {
        el2.push(
          <text key={`t${c}-${i}`} x={x0 + kw / 2} y={y1 + h / 2 + 3} textAnchor="middle" fontSize={8} fill="currentColor" opacity={0.7}>
            {wysokoscPola(sek.h)}
          </text>,
        );
      }
      yy = y1;
      const nast = kol.sekcje[i + 1];
      if (nast && !(sek.typ === "szuflada" && nast.typ === "szuflada")) {
        yy -= t;
        el2.push(<line key={`l${c}-${i}`} x1={x0} y1={yy + t / 2} x2={x0 + kw} y2={yy + t / 2} {...s} strokeWidth={Math.max(1.2, t)} />);
      }
    });
    if (wn.front === "drzwi" && !kol.bezFrontu && kol.sekcje.some((x) => x.typ !== "szuflada")) {
      el2.push(<rect key={`f${c}`} x={x0 - t / 2} y={y} width={kw + t} height={H} {...s} strokeDasharray="2 3" opacity={0.35} />);
    }
  });
  if (wn.front === "przesuwne") el2.push(<line key="tor" x1={x} y1={y + 2} x2={x + W} y2={y + 2} {...s} strokeDasharray="5 3" />);
  return (
    <svg viewBox={`0 0 ${rozmiar} ${rozmiar}`} width={rozmiar} height={rozmiar} aria-hidden className="kr-wn-schemat">
      {el2}
    </svg>
  );
}

export function KreatorWnetrze({
  tryb,
  el: start,
  cennik,
  onZapisz,
  onAnuluj,
}: {
  tryb: "nowy" | "edycja";
  el: ElementOkna;
  cennik: ModulCennik | null;
  onZapisz: (el: ElementOkna) => void;
  onAnuluj: () => void;
}) {
  const [el, setEl] = useState<ElementOkna>(() => {
    if (start.zrodlo === "modul" && maWnetrze(start) && !start.wnetrze) return { ...start, wnetrze: wnetrzeDomyslne(start) ?? undefined };
    return start;
  });
  const [open, setOpen] = useState(false);
  const [wlasny, setWlasny] = useState(false);
  const pierwszy = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
    pierwszy.current?.focus();
    return () => cancelAnimationFrame(raf);
  }, []);

  const lim = limityElementu(el);
  const zWnetrzem = maWnetrze(el);
  const wn = el.wnetrze ?? null;
  const ocena = useMemo(() => (wn ? sprawdzWnetrze(el, wn) : { bledy: [], ostrzezenia: [] }), [el, wn]);
  const presety = useMemo(() => presetyDla(el), [el]);
  const cena = cennik && wycenianyElement(el) ? cenaElementu(el, cennik) : null;
  const zamiana = el.zrodlo === "model" ? naWymiar(el) : null;
  const kategoria = kategoriaWnetrza(el);
  const szafa = kategoria === "szafa" || kategoria === "przesuwna";
  const rodzaj = rodzajElementu(el);
  // Drążek tylko w szafie, szuflada nie w szafce wiszącej (wnetrze.ts → typyPrzestrzeniDla).
  const typyPrzestrzeni = typyPrzestrzeniDla(el);

  const ustawWnetrze = (next: Wnetrze) => setEl((e) => ({ ...e, wnetrze: next }));
  const ustawWymiar = (key: "w" | "h" | "d", v: number) => {
    setEl((e) => {
      const nowy = { ...e, [key]: v };
      if (!e.wnetrze) return nowy;
      const wn2 = dopasujWnetrze(e.wnetrze, nowy) ?? wnetrzeDomyslne(nowy) ?? undefined;
      return { ...nowy, wnetrze: wn2 };
    });
    return true;
  };

  const zmienKolumne = (c: number, fn: (k: Kolumna) => Kolumna) => {
    if (!wn) return;
    ustawWnetrze({ ...wn, preset: undefined, kolumny: wn.kolumny.map((k, i) => (i === c ? fn(k) : k)) });
  };
  const rozlozRowno = (k: Kolumna): Kolumna => ({ ...k, sekcje: rozloz(swiatloH(el.h), k.sekcje.map((s) => ({ ...s, h: s.typ === "szuflada" ? Math.min(GRANICE.szufladaH.max, Math.max(GRANICE.szufladaH.min, s.h)) : 0 }))) });
  const ustawWysokosc = (c: number, j: number, v: number) =>
    zmienKolumne(c, (k) => {
      const sekcje = k.sekcje.map((s) => ({ ...s }));
      const roznica = v - sekcje[j].h;
      sekcje[j].h = v;
      // Różnicę bierze największa inna przestrzeń bez szuflady (albo jakakolwiek, gdy same szuflady).
      let i = -1;
      sekcje.forEach((s, idx) => {
        if (idx === j) return;
        if (i < 0 || (s.typ !== "szuflada" && (sekcje[i].typ === "szuflada" || s.h > sekcje[i].h))) i = idx;
      });
      if (i >= 0) sekcje[i].h = Math.round((sekcje[i].h - roznica) * 10) / 10;
      return { ...k, sekcje };
    });
  const dodajPrzestrzen = (c: number, typ: TypPrzestrzeni) =>
    zmienKolumne(c, (k) => {
      if (k.sekcje.length >= GRANICE.sekcjeMax) return k;
      const nowe = [...k.sekcje.map((s) => ({ ...s, h: s.typ === "szuflada" ? s.h : 0 })), { typ, h: typ === "szuflada" ? 18 : 0 }];
      return { ...k, sekcje: rozloz(swiatloH(el.h), nowe) };
    });
  const usunPrzestrzen = (c: number, j: number) =>
    zmienKolumne(c, (k) => (k.sekcje.length <= 1 ? k : { ...k, sekcje: rozloz(swiatloH(el.h), k.sekcje.filter((_, i) => i !== j).map((s) => ({ ...s, h: s.typ === "szuflada" ? s.h : 0 }))) }));
  const liczbaKolumn = (n: number) => {
    if (!wn) return;
    const nn = Math.max(1, Math.min(GRANICE.kolumnyMax, n));
    const wzor = wn.kolumny[wn.kolumny.length - 1];
    const kolumny = Array.from({ length: nn }, (_, i) => wn.kolumny[i] ?? rozlozRowno({ sekcje: wzor.sekcje.map((s) => ({ ...s })) }));
    ustawWnetrze({ ...wn, preset: undefined, kolumny });
  };
  const ustawFront = (front: RodzajFrontu) => wn && ustawWnetrze({ ...wn, front, preset: undefined });

  const mozna = !ocena.bledy.length;
  const tytul = tryb === "nowy" ? `Dodaj: ${start.nazwa}` : `Element: ${start.nazwa}`;
  const frontyDozwolone: RodzajFrontu[] = rodzaj === "szafa-przesuwna" ? ["przesuwne", "drzwi"] : szafa ? ["drzwi", "przesuwne", "otwarte"] : rodzaj === "regal" ? ["otwarte", "drzwi"] : ["drzwi", "otwarte"];

  return (
    <div className="overlay" data-open={open ? "" : undefined} onKeyDown={(e) => e.key === "Escape" && (e.stopPropagation(), onAnuluj())}>
      <div className="backdrop" onClick={onAnuluj} />
      <div className="modal kr-wn" role="dialog" aria-modal="true" aria-labelledby="kr-wn-title">
        <div className="m-pad kr-wn-head">
          <div className="m-top">
            <h2 id="kr-wn-title" style={{ fontSize: 15 }}>
              {tytul}
            </h2>
            <button type="button" className="btn btn-plain" onClick={onAnuluj} aria-label="Zamknij okno elementu">
              Zamknij
            </button>
          </div>
          <p className="kr-badges">
            <span>{RODZAJ_LABEL[rodzaj]}</span>
            <span>{el.zrodlo === "model" ? "model 3D" : "na wymiar"}</span>
          </p>
        </div>
        <div className="kr-wn-body">
          <div className="kr-wn-lewa">
            <div className="kr-dims kr-dims-3">
              <PoleCm id="wn-w" label="Szerokość" value={el.w} min={lim.w.min} max={lim.w.max} onCommit={(v) => ustawWymiar("w", v)} />
              <PoleCm id="wn-h" label="Wysokość" value={el.h} min={lim.h.min} max={lim.h.max} onCommit={(v) => ustawWymiar("h", v)} />
              <PoleCm id="wn-d" label="Głębokość" value={el.d} min={lim.d.min} max={lim.d.max} onCommit={(v) => ustawWymiar("d", v)} />
            </div>

            {zWnetrzem && wn ? (
              <>
                <div className="field">
                  <span className="lab">Fronty</span>
                  <div className="kr-choice" role="radiogroup" aria-label="Rodzaj frontu">
                    {frontyDozwolone.map((f) => (
                      <button key={f} type="button" role="radio" aria-checked={wn.front === f} className="btn btn-ghost" onClick={() => ustawFront(f)}>
                        {FRONT_LABEL[f]}
                      </button>
                    ))}
                  </div>
                  {szafa && wn.front === "drzwi" && wn.kolumny.some((k) => k.sekcje.some((s) => s.typ === "szuflada")) ? (
                    <label className="kr-check">
                      <input type="checkbox" checked={!!wn.szufladyZaDrzwiami} onChange={(e) => ustawWnetrze({ ...wn, szufladyZaDrzwiami: e.target.checked, preset: undefined })} />
                      Szuflady wewnętrzne (za drzwiami)
                    </label>
                  ) : null}
                </div>

                <div className="field">
                  <span className="lab">Gotowe układy</span>
                  <div className="kr-wn-presety" role="radiogroup" aria-label="Gotowe układy wnętrza">
                    {presety.map((p, i) => {
                      const proba = zPresetu(p, el);
                      const o = sprawdzWnetrze(el, proba);
                      const wybrany = wn.preset === p.id && !wlasny;
                      return (
                        <button
                          key={p.id}
                          ref={i === 0 ? pierwszy : undefined}
                          type="button"
                          role="radio"
                          aria-checked={wybrany}
                          className="kr-wn-preset"
                          disabled={!!o.bledy.length}
                          title={o.bledy[0] ?? p.opis}
                          onClick={() => {
                            setWlasny(false);
                            ustawWnetrze(proba);
                          }}
                        >
                          <SchematWnetrza el={el} wn={proba} rozmiar={84} />
                          <b>{p.nazwa}</b>
                          <span>{o.bledy.length ? "nie pasuje do wymiarów" : p.opis}</span>
                        </button>
                      );
                    })}
                    <button type="button" role="radio" aria-checked={wlasny || !wn.preset} className="kr-wn-preset" onClick={() => setWlasny(true)}>
                      <SchematWnetrza el={el} wn={wn} rozmiar={84} />
                      <b>Własny układ</b>
                      <span>Kolumny, półki, szuflady i drążki z wymiarami</span>
                    </button>
                  </div>
                </div>

                {wlasny || !wn.preset ? (
                  <div className="kr-wn-wlasny">
                    <div className="kr-wn-kolumny-n">
                      <span className="lab">Kolumny (przegrody pionowe)</span>
                      <div className="kr-wn-stepper">
                        <button type="button" className="btn btn-ghost" aria-label="Mniej kolumn" onClick={() => liczbaKolumn(wn.kolumny.length - 1)} disabled={wn.kolumny.length <= 1}>
                          −
                        </button>
                        <b aria-live="polite">{wn.kolumny.length}</b>
                        <button type="button" className="btn btn-ghost" aria-label="Więcej kolumn" onClick={() => liczbaKolumn(wn.kolumny.length + 1)} disabled={wn.kolumny.length >= GRANICE.kolumnyMax}>
                          +
                        </button>
                        <span className="kr-hint">kolumna {wysokoscPola(szerokoscKolumny(el.w, wn.kolumny.length))} cm w świetle</span>
                      </div>
                    </div>
                    {wn.kolumny.map((k, c) => (
                      <fieldset key={c} className="kr-wn-kolumna">
                        <legend>
                          {wn.kolumny.length > 1 ? `Kolumna ${c + 1}` : "Przestrzenie"} <span className="kr-hint">od góry · wysokość w świetle</span>
                        </legend>
                        {k.sekcje.map((_, i) => k.sekcje.length - 1 - i).map((j) => {
                          const sek = k.sekcje[j];
                          return (
                            <div key={j} className="kr-wn-sekcja">
                              <select
                                className="input"
                                aria-label={`Kolumna ${c + 1}, przestrzeń ${j + 1}: rodzaj`}
                                value={sek.typ}
                                onChange={(e) => zmienKolumne(c, (kk) => ({ ...kk, sekcje: kk.sekcje.map((s, i) => (i === j ? { ...s, typ: e.target.value as TypPrzestrzeni } : s)) }))}
                              >
                                {(typyPrzestrzeni.includes(sek.typ) ? typyPrzestrzeni : [...typyPrzestrzeni, sek.typ]).map((t) => (
                                  <option key={t} value={t}>
                                    {PRZESTRZEN_LABEL[t]}
                                  </option>
                                ))}
                              </select>
                              <PoleSekcji
                                aria={`Kolumna ${c + 1}, przestrzeń ${j + 1}: wysokość`}
                                value={sek.h}
                                onCommit={(v) => ustawWysokosc(c, j, v)}
                              />
                              <button type="button" className="btn btn-plain" aria-label={`Usuń przestrzeń ${j + 1}`} onClick={() => usunPrzestrzen(c, j)} disabled={k.sekcje.length <= 1}>
                                ×
                              </button>
                            </div>
                          );
                        })}
                        <div className="actions">
                          {typyPrzestrzeni.map((t) => (
                            <button key={t} type="button" className="btn btn-ghost" onClick={() => dodajPrzestrzen(c, t)} disabled={k.sekcje.length >= GRANICE.sekcjeMax}>
                              + {PRZESTRZEN_LABEL[t]}
                            </button>
                          ))}
                          <button type="button" className="btn btn-plain" onClick={() => zmienKolumne(c, rozlozRowno)}>
                            Rozłóż równo
                          </button>
                          {wn.front === "drzwi" ? (
                            <label className="kr-check">
                              <input type="checkbox" checked={!!k.bezFrontu} onChange={(e) => zmienKolumne(c, (kk) => ({ ...kk, bezFrontu: e.target.checked || undefined }))} />
                              bez drzwi
                            </label>
                          ) : null}
                        </div>
                        <p className="kr-hint">
                          {polkiKolumny(k)} {polkiKolumny(k) === 1 ? "półka" : "półki"} · suma {wysokoscPola(k.sekcje.reduce((a, s) => a + s.h, 0) + polkiKolumny(k) * 1.8)} z {wysokoscPola(swiatloH(el.h))} cm
                        </p>
                      </fieldset>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="kr-card">
                <p className="lede">
                  {el.zrodlo === "model"
                    ? "Wnętrze jest częścią modelu 3D – zmienisz tu tylko wymiary (model się przeskaluje)."
                    : "Ten element nie ma wnętrza do ustawienia (AGD, blat, półka)."}
                </p>
                {zamiana ? (
                  <button type="button" className="btn btn-ghost" onClick={() => setEl({ ...zamiana, w: zamiana.w, h: zamiana.h, d: zamiana.d })}>
                    Zamień na {RODZAJ_LABEL[zamiana.rodzaj ?? "szafka"].toLowerCase()} na wymiar z własnym wnętrzem
                  </button>
                ) : null}
              </div>
            )}
          </div>

          <aside className="kr-wn-prawa" aria-label="Podgląd wnętrza">
            {zWnetrzem && wn ? (
              <>
                <SchematWnetrza el={el} wn={wn} rozmiar={240} podpisy />
                <p className="kr-wn-opis">{opisWnetrza(wn)}</p>
              </>
            ) : null}
            <p className="mono kr-hint">
              {el.w} × {el.h} × {el.d} cm · {cena != null ? `${formatPln(cena)} netto` : wycenianyElement(el) ? "" : "AGD, poza ceną"}
            </p>
            {ocena.bledy.length ? (
              <ul className="kr-wn-bledy" role="alert">
                {ocena.bledy.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : null}
            {ocena.ostrzezenia.length ? (
              <ul className="kr-wn-ostrz">
                {ocena.ostrzezenia.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : null}
            {MEBLE.has(rodzaj) || kategoria ? <p className="kr-hint">Wymiary w świetle (w środku, bez płyt 18 mm). Drążek od 50 cm głębokości, szuflady od 30 cm, półka do 100 cm szerokości.</p> : null}
          </aside>
        </div>
        <div className="m-foot">
          <button type="button" className="btn btn-ghost" onClick={onAnuluj}>
            Anuluj
          </button>
          <button type="button" className="btn btn-ink" disabled={!mozna} onClick={() => onZapisz(el)}>
            {tryb === "nowy" ? "Dodaj do projektu" : "Zapisz zmiany"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PoleSekcji({ value, onCommit, aria }: { value: number; onCommit: (v: number) => void; aria: string }) {
  const [tekst, setTekst] = useState(wysokoscPola(value));
  useEffect(() => setTekst(wysokoscPola(value)), [value]);
  const zatwierdz = () => {
    const n = Number(tekst.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return setTekst(wysokoscPola(value));
    onCommit(Math.round(n * 10) / 10);
  };
  return (
    <label className="kr-wn-h">
      <input
        className="input"
        inputMode="decimal"
        aria-label={aria}
        value={tekst}
        onChange={(e) => setTekst(e.target.value.replace(/[^\d,.]/g, "").slice(0, 6))}
        onBlur={zatwierdz}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      />
      cm
    </label>
  );
}
