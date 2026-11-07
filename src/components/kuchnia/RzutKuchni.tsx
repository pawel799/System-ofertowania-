"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import {
  konfliktElementow,
  nachodzi,
  przyciagnij,
  rect,
  rectBazowy,
  nazwaNaRzucie,
  skrotElementu,
  STREFA_LABEL,
  zasiegNaScianie,
  type ElementKuchni,
  type PlanKuchni,
  type Strefa,
} from "@/lib/kuchnia";
import {
  czyObrys,
  koncowkiSciany,
  muryPokoju,
  naroznikiSciany,
  polaczeniaScianek,
  punktNaScianie,
  ruchScianki,
  scianaZPolaczeniami,
  scianyPokoju,
  wGranicachPokoju,
  zasiegScian,
  type ScianaDodatkowa,
  type ScianaPokoju,
} from "@/lib/sciany";
import { podgladZmianyPokoju, uchwytyScianyPokoju, type ZmianaPokoju } from "@/lib/ksztaltPokoju";
import { meblaWOtworze, otworWPunkcie, sprawdzOtwor, sprawdzScianeDodatkowa } from "@/lib/otwory";
import { punktWPunkcie, sprawdzPunkt } from "@/lib/punkty";
import { PUNKT_INFO, type PunktInstalacji, type RodzajPunktu } from "@/lib/wywiad";
import type { Otwor } from "@/lib/wywiad";

type Props = {
  plan: PlanKuchni;
  zaznaczony: string | null;
  wymiary: boolean;
  onWybierz: (id: string | null) => void;
  onPrzesun: (id: string, x: number, z: number) => void;
  /** Ruch odrzucony: nachodzi na inny mebel albo staje w drzwiach / zasłania okno (komunikat). */
  onKolizja: (powod?: string) => void;
  /** Podwójne kliknięcie (albo Enter) na elemencie – okno wymiarów i wnętrza. */
  onOtworz?: (id: string) => void;
  /** Przesunięcie okna albo drzwi (przeciąganie po ścianach); bez – otwory tylko do oglądania. */
  onOtwor?: (i: number, o: Otwor) => void;
  /** Otwór nie może tam stać (komunikat z sprawdzOtwor). */
  onBladOtworu?: (powod: string) => void;
  /** Przesunięcie gniazdka / punktu instalacji po ścianach (błąd – onBladOtworu). */
  onPunkt?: (i: number, p: PunktInstalacji) => void;
  /** Dodatkowa ściana przesunięta, obrócona albo wydłużona (przeciąganie środka albo końca; błąd – onBladOtworu). */
  onSciana?: (i: number, s: ScianaDodatkowa) => void;
  /** Zaznaczona ściana pokoju (karta ściany w kreatorze) – podświetlona, z uchwytami. */
  scianaPokoju?: ScianaPokoju | null;
  /** Klik w ścianę pokoju (null – klik obok). */
  onScianaPokoju?: (id: ScianaPokoju | null) => void;
  /** Uchwyt ściany pokoju puszczony: nowa długość, położenie ściany albo narożnika. */
  onPokoj?: (z: ZmianaPokoju) => void;
};

type Ciagniecie = { id: string; pointer: number; dx: number; dz: number };

const KOLEJNOSC: Record<Strefa, number> = { dolna: 0, wysoka: 1, gorna: 2, polka: 3, blat: 4 };

function widok(plan: PlanKuchni, wymiary: boolean) {
  const margines = wymiary ? 58 : 30;
  let x0 = -margines;
  let z0 = wymiary ? -52 : -36;
  let x1 = plan.scianaA + margines;
  // Ciąg: tylko pas szafek (60 cm) + miejsce na wymiary, bez pustego „pokoju” pod spodem.
  let z1 = (plan.uklad === "L" ? plan.scianaB : 70) + margines;
  if (plan.pomieszczenie) {
    x1 = Math.max(x1, plan.pomieszczenie.szer + (wymiary ? 48 : 24));
    z1 = Math.max(z1, plan.pomieszczenie.dlug + (wymiary ? 48 : 24));
  }
  // Wszystkie ściany (kształt pokoju, grubość, ścianki działowe) mieszczą się w kadrze.
  const sc = zasiegScian(plan);
  x0 = Math.min(x0, sc.x0 - 20);
  z0 = Math.min(z0, sc.z0 - 20);
  x1 = Math.max(x1, sc.x1 + (wymiary ? 40 : 20));
  z1 = Math.max(z1, sc.z1 + (wymiary ? 40 : 20));
  for (const e of plan.elementy) {
    const r = rect(e);
    x0 = Math.min(x0, r.x0 - 28);
    z0 = Math.min(z0, r.z0 - 28);
    x1 = Math.max(x1, r.x1 + 28);
    z1 = Math.max(z1, r.z1 + 36);
  }
  return { x: x0, y: z0, w: Math.max(80, x1 - x0), h: Math.max(80, z1 - z0) };
}

function punkt(svg: SVGSVGElement, e: { clientX: number; clientY: number }) {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const p = pt.matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

/** Obrót na rzucie (SVG, oś y w dół): kąt rośnie przeciwnie do wskazówek zegara, jak w 3D. */
const obrotRzutu = (e: ElementKuchni) => (e.kat ? `rotate(${-e.kat} ${e.x} ${e.z})` : undefined);

function krawedzFrontu(e: ElementKuchni) {
  const r = rectBazowy(e);
  if (e.rot === 0) return { x1: r.x0, y1: r.z1, x2: r.x1, y2: r.z1 };
  if (e.rot === 180) return { x1: r.x0, y1: r.z0, x2: r.x1, y2: r.z0 };
  if (e.rot === 90) return { x1: r.x1, y1: r.z0, x2: r.x1, y2: r.z1 };
  return { x1: r.x0, y1: r.z0, x2: r.x0, y2: r.z1 };
}

function kolizjaZInnymi(plan: PlanKuchni, el: ElementKuchni) {
  const r = rect(el);
  return plan.elementy.some((inny) => inny.id !== el.id && konfliktElementow(el, inny) && nachodzi(r, rect(inny)));
}

/**
 * Przesunięcie mebla o dx, dz (strzałki – na rzucie i skrótem w kreatorze): przyciąganie, granice pokoju,
 * kolizje i otwory jak przy przeciąganiu. null = nic się nie zmienia, blad = nie można (undefined = nachodzi na mebel).
 */
export function przesunMebel(plan: PlanKuchni, e: ElementKuchni, dx: number, dz: number): { x: number; z: number } | { blad: string | undefined } | null {
  const przyc = przyciagnij(plan, e, e.x + dx, e.z + dz);
  const przy = wGranicachPokoju(plan, rect({ ...e, ...przyc }), przyc.x, przyc.z);
  if (przy.x === e.x && przy.z === e.z) return null;
  const kandydat = { ...e, x: przy.x, z: przy.z };
  if (kolizjaZInnymi(plan, kandydat)) return { blad: undefined };
  const wOtworze = meblaWOtworze(plan, kandydat);
  if (wOtworze && !meblaWOtworze(plan, e)) return { blad: wOtworze };
  return { x: przy.x, z: przy.z };
}

function Wymiar({
  x1,
  y1,
  x2,
  y2,
  nx,
  ny,
  odsun,
  tekst,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  nx: number;
  ny: number;
  odsun: number;
  tekst: string;
}) {
  const ax = x1 + nx * odsun;
  const ay = y1 + ny * odsun;
  const bx = x2 + nx * odsun;
  const by = y2 + ny * odsun;
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const tick = 2.6;
  const tx = (-dy / len) * tick;
  const ty = (dx / len) * tick;
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const tw = Math.max(18, tekst.length * 4.1 + 4);
  const th = 8.6;
  return (
    <g className="kr-cad">
      <line x1={x1} y1={y1} x2={ax} y2={ay} />
      <line x1={x2} y1={y2} x2={bx} y2={by} />
      <line x1={ax} y1={ay} x2={bx} y2={by} />
      <line x1={ax - tx} y1={ay - ty} x2={ax + tx} y2={ay + ty} />
      <line x1={bx - tx} y1={by - ty} x2={bx + tx} y2={by + ty} />
      <rect x={mx - tw / 2} y={my - th / 2} width={tw} height={th} rx={1.1} />
      <text x={mx} y={my} textAnchor="middle" dominantBaseline="central">
        {tekst}
      </text>
    </g>
  );
}

function wymiaryZaznaczenia(e: ElementKuchni) {
  const r = rectBazowy(e);
  const front = krawedzFrontu(e);
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  const fx = (front.x1 + front.x2) / 2 - cx;
  const fz = (front.y1 + front.y2) / 2 - cz;
  const fl = Math.hypot(fx, fz) || 1;
  const nx = fx / fl;
  const nz = fz / fl;
  const bok = e.rot === 90 || e.rot === 270 ? { x1: r.x0, y1: r.z0, x2: r.x1, y2: r.z0 } : { x1: r.x0, y1: r.z0, x2: r.x0, y2: r.z1 };
  const bx = e.rot === 0 || e.rot === 180 ? -1 : 0;
  const bz = e.rot === 90 || e.rot === 270 ? -1 : 0;
  return { front, nx, nz, bok, bx, bz, r, cx, cz };
}

/** Okno albo drzwi na rzucie: odcinek na ścianie, skrzydło drzwi z łukiem do wnętrza, podpis. */
function OtworRzut({
  plan,
  o,
  zly,
  onPointerDown,
}: {
  plan: PlanKuchni;
  o: Otwor;
  zly?: boolean;
  onPointerDown?: (ev: ReactPointerEvent<SVGGElement>) => void;
}) {
  const s = scianyPokoju(plan).find((w) => w.id === o.sciana);
  if (!s) return null;
  const p1 = punktNaScianie(s, o.od);
  const p2 = punktNaScianie(s, o.od + o.szer);
  const srodek = punktNaScianie(s, o.od + o.szer / 2);
  // Podpis po zewnętrznej stronie ściany.
  const tx = srodek.x - s.nx * 9;
  const tz = srodek.z - s.nz * 9;
  const pion = s.dz !== 0;
  const lisc = { x: p1.x + s.nx * o.szer, z: p1.z + s.nz * o.szer };
  // Łuk od wolnego końca skrzydła (p2) do otwartego skrzydła; kierunek zależy od ściany.
  const zgodnie = (s.dx * s.nz - s.dz * s.nx) > 0 ? 0 : 1;
  return (
    <g
      className={o.rodzaj === "okno" ? "kr-okno" : "kr-drzwi"}
      data-bad={zly ? "" : undefined}
      data-sciana={o.sciana}
      onPointerDown={onPointerDown}
      style={onPointerDown ? { cursor: "grab", touchAction: "none" } : undefined}
    >
      <line x1={p1.x} y1={p1.z} x2={p2.x} y2={p2.z} />
      {onPointerDown ? <line className="kr-otwor-uchwyt" x1={p1.x} y1={p1.z} x2={p2.x} y2={p2.z} /> : null}
      {o.rodzaj === "drzwi" ? <path d={`M${p1.x} ${p1.z} L${lisc.x} ${lisc.z} M${p2.x} ${p2.z} A${o.szer} ${o.szer} 0 0 ${zgodnie} ${lisc.x} ${lisc.z}`} /> : null}
      <text x={tx} y={tz} textAnchor="middle" dominantBaseline="central" transform={pion ? `rotate(-90 ${tx} ${tz})` : undefined}>
        {o.rodzaj === "okno" ? `okno ${o.szer}` : `drzwi ${o.szer}`}
      </text>
    </g>
  );
}

/** Skrót na rzucie (symbol w kółku przy ścianie). */
const SYMBOL_PUNKTU: Record<RodzajPunktu, string> = { gniazdko: "G", "gniazdko-2": "2G", sila: "400", wlacznik: "W", swiatlo: "Ś", rtv: "TV", gaz: "gaz", kratka: "K" };

/** Gniazdko / punkt instalacji na rzucie: kółko z symbolem tuż przy ścianie, od strony pokoju. */
function PunktRzut({ plan, p, zly, onPointerDown }: { plan: PlanKuchni; p: PunktInstalacji; zly?: boolean; onPointerDown?: (ev: ReactPointerEvent<SVGGElement>) => void }) {
  const s = scianyPokoju(plan).find((w) => w.id === p.sciana);
  if (!s) return null;
  const q = punktNaScianie(s, p.od);
  const cx = q.x + s.nx * 5;
  const cy = q.z + s.nz * 5;
  return (
    <g
      className="kr-punkt"
      data-rodzaj={p.rodzaj}
      data-na-scianie={p.sciana}
      data-bad={zly ? "" : undefined}
      onPointerDown={onPointerDown}
      style={onPointerDown ? { cursor: "grab", touchAction: "none" } : undefined}
    >
      <title>{`${PUNKT_INFO[p.rodzaj].nazwa} · ${p.wys} cm nad podłogą`}</title>
      <circle cx={cx} cy={cy} r={4.2} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
        {SYMBOL_PUNKTU[p.rodzaj]}
      </text>
    </g>
  );
}

export default function RzutKuchni({ plan, zaznaczony, wymiary, onWybierz, onPrzesun, onKolizja, onOtworz, onOtwor, onBladOtworu, onPunkt, onSciana, scianaPokoju = null, onScianaPokoju, onPokoj }: Props) {
  // Podwójne kliknięcie liczymy sami: przechwycenie wskaźnika (przeciąganie) zjada zdarzenie dblclick.
  const ostatnieKlikniecie = useRef<{ id: string; t: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [podglad, setPodglad] = useState<{ id: string; x: number; z: number } | null>(null);
  const ostatnie = useRef(podglad);
  ostatnie.current = podglad;
  const planRef = useRef(plan);
  planRef.current = plan;
  const cb = useRef({ onPrzesun, onKolizja });
  cb.current = { onPrzesun, onKolizja };
  const sluchacze = useRef<(() => void) | null>(null);
  useEffect(() => () => sluchacze.current?.(), []);
  const box = widok(plan, wymiary);
  // Przeciąganie okna / drzwi: podgląd z listą błędów (pusta = można upuścić).
  const otwory = plan.wywiad?.otwory ?? [];
  const [podgladOtworu, setPodgladOtworu] = useState<{ i: number; o: Otwor; bledy: string[] } | null>(null);
  const cbOtwor = useRef({ onOtwor, onBladOtworu });
  cbOtwor.current = { onOtwor, onBladOtworu };
  const zacznijOtwor = (ev: ReactPointerEvent<SVGGElement>, i: number) => {
    if (ev.button !== 0) return;
    ev.stopPropagation();
    ev.preventDefault();
    window.getSelection()?.removeAllRanges();
    const svg = svgRef.current;
    if (!svg) return;
    const start = otwory[i];
    let teraz = { i, o: start, bledy: [] as string[] };
    setPodgladOtworu(teraz);
    svg.setPointerCapture(ev.pointerId);
    const move = (pe: PointerEvent) => {
      if (pe.pointerId !== ev.pointerId) return;
      const q = punkt(svg, pe);
      const o = otworWPunkcie(planRef.current, start, q.x, q.y, pe.shiftKey ? 1 : 5);
      teraz = { i, o, bledy: sprawdzOtwor(planRef.current, i, o) };
      setPodgladOtworu(teraz);
    };
    const up = (pe: PointerEvent) => {
      if (pe.pointerId !== ev.pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (svg.hasPointerCapture(pe.pointerId)) svg.releasePointerCapture(pe.pointerId);
      setPodgladOtworu(null);
      if (teraz.o.od === start.od && teraz.o.sciana === start.sciana) return;
      if (teraz.bledy.length) cbOtwor.current.onBladOtworu?.(teraz.bledy[0]);
      else cbOtwor.current.onOtwor?.(i, teraz.o);
    };
    sluchacze.current?.();
    sluchacze.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  // Przeciąganie gniazdka / punktu po ścianach (wysokość bez zmian – ustawia się w kroku „Okna i instalacje” albo w 3D).
  const punkty = plan.wywiad?.punkty ?? [];
  const [podgladPunktu, setPodgladPunktu] = useState<{ i: number; p: PunktInstalacji; bledy: string[] } | null>(null);
  const cbPunkt = useRef({ onPunkt, onBladOtworu });
  cbPunkt.current = { onPunkt, onBladOtworu };
  const zacznijPunkt = (ev: ReactPointerEvent<SVGGElement>, i: number) => {
    if (ev.button !== 0) return;
    ev.stopPropagation();
    // Bez tego zaznaczony tekst (np. podpis otworu) zaczyna natywne przeciąganie i przeglądarka anuluje wskaźnik.
    ev.preventDefault();
    window.getSelection()?.removeAllRanges();
    const svg = svgRef.current;
    const start = punkty[i];
    if (!svg || !start) return;
    let teraz = { i, p: start, bledy: [] as string[] };
    setPodgladPunktu(teraz);
    svg.setPointerCapture(ev.pointerId);
    const move = (pe: PointerEvent) => {
      if (pe.pointerId !== ev.pointerId) return;
      const q = punkt(svg, pe);
      const p = punktWPunkcie(planRef.current, start, q.x, q.y, pe.shiftKey ? 1 : 5);
      teraz = { i, p, bledy: sprawdzPunkt(planRef.current, i, p) };
      setPodgladPunktu(teraz);
    };
    const up = (pe: PointerEvent) => {
      if (pe.pointerId !== ev.pointerId) return;
      sluchacze.current?.();
      sluchacze.current = null;
      if (svg.hasPointerCapture(pe.pointerId)) svg.releasePointerCapture(pe.pointerId);
      setPodgladPunktu(null);
      if (teraz.p.od === start.od && teraz.p.sciana === start.sciana) return;
      if (teraz.bledy.length) cbPunkt.current.onBladOtworu?.(teraz.bledy[0]);
      else cbPunkt.current.onPunkt?.(i, teraz.p);
    };
    sluchacze.current?.();
    sluchacze.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  // Dodatkowe ściany: przeciąganie środka (przesuwa) albo końca (obraca i zmienia długość wokół drugiego końca).
  // Łączenie jak przy budowie domu w grach: koniec przyciąga się do innej ściany (Alt – bez), połączone ściany idą razem.
  const [podgladSciany, setPodgladSciany] = useState<{ zmiany: Map<number, ScianaDodatkowa>; bledy: string[]; cel: { x: number; z: number } | null } | null>(null);
  const cbSciana = useRef({ onSciana, onBladOtworu });
  cbSciana.current = { onSciana, onBladOtworu };
  const zacznijSciane = (ev: ReactPointerEvent<SVGElement>, i: number, tryb: "srodek" | "a" | "b") => {
    if (ev.button !== 0) return;
    ev.stopPropagation();
    ev.preventDefault();
    window.getSelection()?.removeAllRanges();
    onScianaPokoju?.(null);
    const svg = svgRef.current;
    const plan0 = planRef.current;
    const start = plan0.sciany?.dodatkowe?.[i];
    if (!svg || !start) return;
    const p0 = punkt(svg, ev);
    let teraz = { zmiany: new Map([[i, start]]), bledy: [] as string[], cel: null as { x: number; z: number } | null };
    setPodgladSciany(teraz);
    svg.setPointerCapture(ev.pointerId);
    const move = (pe: PointerEvent) => {
      if (pe.pointerId !== ev.pointerId) return;
      const q = punkt(svg, pe);
      const krok = pe.shiftKey ? 1 : 5;
      const cel = tryb === "srodek" ? { x: start.x + q.x - p0.x, z: start.z + q.y - p0.y } : { x: q.x, z: q.y };
      const r = ruchScianki(plan0, i, tryb, cel, { krok, krokKata: pe.shiftKey ? 1 : 15, laczenie: !pe.altKey });
      const bledy = Array.from(r.zmiany.values()).flatMap((s) => sprawdzScianeDodatkowa(planRef.current, s));
      teraz = { zmiany: r.zmiany, bledy, cel: r.cel };
      setPodgladSciany(teraz);
    };
    const up = (pe: PointerEvent) => {
      if (pe.pointerId !== ev.pointerId) return;
      sluchacze.current?.();
      sluchacze.current = null;
      if (svg.hasPointerCapture(pe.pointerId)) svg.releasePointerCapture(pe.pointerId);
      setPodgladSciany(null);
      const lista = plan0.sciany?.dodatkowe ?? [];
      const zmienione = Array.from(teraz.zmiany).filter(([j, s]) => {
        const st = lista[j];
        return st && (s.x !== st.x || s.z !== st.z || s.kat !== st.kat || s.dlugosc !== st.dlugosc);
      });
      if (!zmienione.length) return;
      if (teraz.bledy.length) cbSciana.current.onBladOtworu?.(teraz.bledy[0]);
      else for (const [j, s] of zmienione) cbSciana.current.onSciana?.(j, s);
    };
    sluchacze.current?.();
    sluchacze.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  const scianyDodatkowe = (plan.sciany?.dodatkowe ?? []).map((sd, i) => podgladSciany?.zmiany.get(i) ?? sd);
  const polaczenia = polaczeniaScianek(scianyDodatkowe);
  // Ściany pokoju: klik zaznacza, uchwyty zmieniają długość, położenie ściany i narożniki (podgląd do puszczenia).
  const [podgladPokoju, setPodgladPokoju] = useState<ZmianaPokoju | null>(null);
  const cbPokoj = useRef(onPokoj);
  cbPokoj.current = onPokoj;
  const planRys = podgladPokoju ? podgladZmianyPokoju(plan, podgladPokoju) : plan;
  const uchwyty = scianaPokoju && onPokoj ? uchwytyScianyPokoju(planRys, scianaPokoju) : [];
  const zacznijUchwyt = (ev: ReactPointerEvent<SVGElement>, nr: number) => {
    if (ev.button !== 0 || !scianaPokoju) return;
    ev.stopPropagation();
    ev.preventDefault();
    const svg = svgRef.current;
    const u = uchwytyScianyPokoju(planRef.current, scianaPokoju)[nr];
    if (!svg || !u) return;
    svg.setPointerCapture(ev.pointerId);
    let teraz: ZmianaPokoju | null = null;
    const move = (pe: PointerEvent) => {
      if (pe.pointerId !== ev.pointerId) return;
      const q = punkt(svg, pe);
      teraz = u.ruch({ x: q.x, z: q.y }, pe.shiftKey ? 1 : 5);
      setPodgladPokoju(teraz);
    };
    const up = (pe: PointerEvent) => {
      if (pe.pointerId !== ev.pointerId) return;
      sluchacze.current?.();
      sluchacze.current = null;
      if (svg.hasPointerCapture(pe.pointerId)) svg.releasePointerCapture(pe.pointerId);
      setPodgladPokoju(null);
      if (teraz) cbPokoj.current?.(teraz);
    };
    sluchacze.current?.();
    sluchacze.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  const elementy = plan.elementy.map((e) => (podglad && e.id === podglad.id ? { ...e, x: podglad.x, z: podglad.z } : e));
  const widokPlan: PlanKuchni = { ...plan, elementy };
  const podgladEl = podglad ? elementy.find((e) => e.id === podglad.id) : undefined;
  const podgladNachodzi = podgladEl ? kolizjaZInnymi(plan, podgladEl) || (!!meblaWOtworze(plan, podgladEl) && !meblaWOtworze(plan, plan.elementy.find((e) => e.id === podgladEl.id)!)) : false;
  const rysowane = [...elementy].sort((a, b) => KOLEJNOSC[a.strefa] - KOLEJNOSC[b.strefa] || a.x - b.x);

  const linie: { x1: number; y1: number; x2: number; y2: number; k: string }[] = [];
  for (let x = 0; x <= plan.scianaA; x += 20) linie.push({ x1: x, y1: 0, x2: x, y2: plan.uklad === "L" ? plan.scianaB : 80, k: `x${x}` });

  const ciagi: { strefa: Strefa; sciana: "A" | "B"; odsun: number }[] = [
    { strefa: "dolna", sciana: "A", odsun: 14 },
    { strefa: "gorna", sciana: "A", odsun: 26 },
    { strefa: "polka", sciana: "A", odsun: 38 },
  ];
  if (plan.uklad === "L") {
    ciagi.push(
      { strefa: "dolna", sciana: "B", odsun: 14 },
      { strefa: "gorna", sciana: "B", odsun: 26 },
      { strefa: "polka", sciana: "B", odsun: 38 },
    );
  }

  return (
    <svg
      ref={svgRef}
      className="kr-svg"
      viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
      style={{ "--kr-min-w": `${Math.round(box.w * 1.5)}px`, "--kr-ar": `${Math.round(box.w)} / ${Math.round(box.h)}` } as CSSProperties}
      role="group"
      aria-label="Rzut kuchni z góry. Przeciągnij element, strzałki przesuwają zaznaczony."
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) {
          onWybierz(null);
          onScianaPokoju?.(null);
        }
      }}
    >
      {czyObrys(planRys) ? (
        <polygon className="kr-room" points={planRys.sciany!.obrys!.map((p) => `${p.x},${p.z}`).join(" ")} />
      ) : planRys.pomieszczenie ? (
        <rect className="kr-room" x={0} y={0} width={planRys.pomieszczenie.szer} height={planRys.pomieszczenie.dlug} />
      ) : null}
      {linie.map((l) => (
        <line key={l.k} className="kr-grid" x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
      ))}
      {/* Ściany pokoju z grubością (na zewnątrz); klik – karta ściany w kreatorze (kolor, długość, grubość, wysokość…). */}
      {muryPokoju(planRys).map(({ s, punkty: mur }) => (
        <g key={s.id} className="kr-mur" data-sciana-pokoju={s.id} data-wybrana={scianaPokoju === s.id ? "" : undefined}>
          <polygon
            points={mur.map((p) => `${p.x},${p.z}`).join(" ")}
            onPointerDown={
              onScianaPokoju
                ? (ev) => {
                    if (ev.button !== 0) return;
                    ev.stopPropagation();
                    onWybierz(null);
                    onScianaPokoju(s.id);
                  }
                : undefined
            }
            style={onScianaPokoju ? { cursor: "pointer" } : undefined}
          >
            <title>{`Ściana ${s.id} · ${Math.round(s.dlugosc)} cm`}</title>
          </polygon>
          <line className="kr-wall" x1={s.x} y1={s.z} x2={s.x + s.dx * s.dlugosc} y2={s.z + s.dz * s.dlugosc} />
        </g>
      ))}
      {/* Dodatkowe ściany: środek – przesuń, kółka na końcach – obróć i zmień długość (Shift: co 1 cm / 1°). */}
      {scianyDodatkowe.map((sd, i) => {
        // Połączone końce wydłużone o pół grubości – narożnik bez szczeliny.
        const pkt = naroznikiSciany(scianaZPolaczeniami(sd, [polaczenia[i][0].length > 0, polaczenia[i][1].length > 0]));
        const [a, b] = koncowkiSciany(sd);
        const zla = !!podgladSciany?.zmiany.has(i) && podgladSciany.bledy.length > 0;
        // Podpis wzdłuż ściany, zawsze czytelny (−90°…90°).
        const kat = sd.kat > 90 ? sd.kat - 180 : sd.kat;
        return (
          <g key={sd.id} className="kr-sciana-dod" data-nr={i + 1} data-bad={zla ? "" : undefined}>
            <polygon
              points={pkt.map((p) => `${p.x},${p.z}`).join(" ")}
              onPointerDown={onSciana ? (ev) => zacznijSciane(ev, i, "srodek") : undefined}
              style={onSciana ? { cursor: "grab", touchAction: "none" } : undefined}
            >
              <title>{`Ściana ${i + 1} · ${sd.dlugosc} cm · ${sd.kat}°`}</title>
            </polygon>
            <text x={sd.x} y={sd.z} textAnchor="middle" dominantBaseline="central" transform={kat ? `rotate(${kat} ${sd.x} ${sd.z})` : undefined}>
              {wymiary || podgladSciany?.zmiany.has(i) ? `${i + 1} · ${sd.dlugosc} cm${sd.kat ? ` · ${sd.kat}°` : ""}` : `${i + 1}`}
            </text>
            {onSciana
              ? ([
                  ["a", a],
                  ["b", b],
                ] as const).map(([k, p]) => (
                  <circle key={k} className="kr-sciana-koniec" data-koniec={k} data-polaczony={polaczenia[i][k === "a" ? 0 : 1].length ? "" : undefined} cx={p.x} cy={p.z} r={4.5} onPointerDown={(ev) => zacznijSciane(ev, i, k)} style={{ cursor: "crosshair", touchAction: "none" }}>
                    <title>Przeciągnij: obróć i zmień długość. Koniec przyciąga się do innych ścian (Alt – bez przyciągania).</title>
                  </circle>
                ))
              : null}
          </g>
        );
      })}
      {podgladSciany?.cel ? <circle className="kr-laczenie" cx={podgladSciany.cel.x} cy={podgladSciany.cel.z} r={7} aria-hidden /> : null}
      {uchwyty.map((u, nr) => (
        <g key={nr} className="kr-uchwyt-pokoju" data-rodzaj={u.rodzaj} onPointerDown={(ev) => zacznijUchwyt(ev, nr)} style={{ cursor: u.rodzaj === "sciana" ? "move" : "crosshair", touchAction: "none" }}>
          {u.rodzaj === "sciana" ? <rect x={u.p.x - 6} y={u.p.z - 6} width={12} height={12} rx={3} /> : <circle cx={u.p.x} cy={u.p.z} r={5.5} />}
          <title>{u.rodzaj === "sciana" ? "Przeciągnij: przesuń ścianę (Shift: co 1 cm)" : "Przeciągnij: zmień długość ściany (Shift: co 1 cm)"}</title>
        </g>
      ))}
      {/* Okna i drzwi na ścianach A–D: przeciągnij, żeby przesunąć (także na inną ścianę); czerwone = nie może tam stać. */}
      {otwory.map((o, i) => (
        <OtworRzut
          key={`o${i}`}
          plan={plan}
          o={podgladOtworu?.i === i ? podgladOtworu.o : o}
          zly={podgladOtworu?.i === i && podgladOtworu.bledy.length > 0}
          onPointerDown={onOtwor ? (ev) => zacznijOtwor(ev, i) : undefined}
        />
      ))}
      {plan.wywiad?.woda ? (
        <g className="kr-woda" aria-hidden>
          <circle cx={plan.wywiad.woda.sciana === "A" ? plan.wywiad.woda.od : 5} cy={plan.wywiad.woda.sciana === "A" ? 5 : plan.wywiad.woda.od} r={3.2} />
        </g>
      ) : null}
      {wymiary ? (
        <g>
          <Wymiar x1={0} y1={0} x2={plan.scianaA} y2={0} nx={0} ny={-1} odsun={18} tekst={`${plan.scianaA}`} />
          {plan.uklad === "L" ? <Wymiar x1={0} y1={0} x2={0} y2={plan.scianaB} nx={-1} ny={0} odsun={18} tekst={`${plan.scianaB}`} /> : null}
          {czyObrys(plan) ? (
            scianyPokoju(plan)
              .filter((s) => s.id !== "A" && !(s.id === "B" && plan.uklad === "L"))
              .map((s) => (
                <Wymiar key={`w-${s.id}`} x1={s.x} y1={s.z} x2={s.x + s.dx * s.dlugosc} y2={s.z + s.dz * s.dlugosc} nx={-s.nx} ny={-s.nz} odsun={14} tekst={`${s.id} · ${Math.round(s.dlugosc)}`} />
              ))
          ) : plan.pomieszczenie ? (
            <>
              <Wymiar
                x1={0}
                y1={plan.pomieszczenie.dlug}
                x2={plan.pomieszczenie.szer}
                y2={plan.pomieszczenie.dlug}
                nx={0}
                ny={1}
                odsun={14}
                tekst={`${plan.pomieszczenie.szer}`}
              />
              <Wymiar
                x1={plan.pomieszczenie.szer}
                y1={0}
                x2={plan.pomieszczenie.szer}
                y2={plan.pomieszczenie.dlug}
                nx={1}
                ny={0}
                odsun={14}
                tekst={`${plan.pomieszczenie.dlug}`}
              />
            </>
          ) : null}
          {ciagi.filter(({ strefa }) => {
            const wybrane = elementy.find((e) => e.id === zaznaczony);
            if (strefa === "dolna") return true;
            return wybrane?.strefa === strefa;
          }).map(({ strefa, sciana, odsun }) => {
            const zasieg = zasiegNaScianie(widokPlan, strefa, sciana);
            if (!zasieg || zasieg.do - zasieg.od < 2) return null;
            const sztuki = widokPlan.elementy.filter((e) => {
              if (e.strefa !== strefa) return false;
              const r = rect(e);
              return sciana === "A" ? e.rot % 180 === 0 && r.z0 < 24 : (e.rot === 90 || e.rot === 270) && r.x0 < 24;
            });
            if (!sztuki.length) return null;
            const tekst = `${Math.round(zasieg.do - zasieg.od)}`;
            if (sciana === "A") {
              const z = Math.max(...sztuki.map((e) => rect(e).z1));
              return <Wymiar key={`${strefa}-A`} x1={zasieg.od} y1={z} x2={zasieg.do} y2={z} nx={0} ny={1} odsun={odsun} tekst={tekst} />;
            }
            const x = Math.max(...sztuki.map((e) => rect(e).x1));
            return <Wymiar key={`${strefa}-B`} x1={x} y1={zasieg.od} x2={x} y2={zasieg.do} nx={1} ny={0} odsun={odsun} tekst={tekst} />;
          })}
        </g>
      ) : (
        <>
          <text className="kr-dim" x={plan.scianaA / 2} y={-10} textAnchor="middle">
            ściana A · {plan.scianaA} cm
          </text>
          {plan.uklad === "L" ? (
            <text className="kr-dim" x={-10} y={plan.scianaB / 2} textAnchor="middle" transform={`rotate(-90 -10 ${plan.scianaB / 2})`}>
              ściana B · {plan.scianaB} cm
            </text>
          ) : null}
        </>
      )}
      {rysowane.map((e) => {
        // Rysujemy obrys bez dokładnego kąta i obracamy całą grupę (mebel pod dowolnym kątem).
        const r = rectBazowy(e);
        const front = krawedzFrontu(e);
        const nachodziTeraz = podglad?.id === e.id && podgladNachodzi;
        const szer = Math.max(1, r.x1 - r.x0);
        const gl = Math.max(1, r.z1 - r.z0);
        const zaznaczona = zaznaczony === e.id;
        const przesun = (dx: number, dz: number) => {
          const w = przesunMebel(plan, e, dx, dz);
          if (!w) return;
          if ("blad" in w) onKolizja(w.blad);
          else onPrzesun(e.id, w.x, w.z);
        };
        const detale = wymiary && zaznaczona ? wymiaryZaznaczenia(e) : null;
        return (
          <g key={e.id} transform={obrotRzutu(e)}>
            <rect
              className="kr-piece"
              data-zone={e.strefa}
              data-rodzaj={e.rodzaj ?? "szafka"}
              data-selected={zaznaczona ? "" : undefined}
              data-bad={nachodziTeraz ? "" : undefined}
              x={r.x0}
              y={r.z0}
              width={szer}
              height={gl}
              tabIndex={0}
              role="button"
              aria-label={`${e.nazwa}, ${STREFA_LABEL[e.strefa]}, ${e.w} na ${e.d} na ${e.h} cm. Strzałki przesuwają o 5 cm, Enter otwiera wymiary i wnętrze.`}
              onPointerDown={(ev) => {
                if (ev.button !== 0) return;
                ev.stopPropagation();
                const teraz = performance.now();
                const poprzednie = ostatnieKlikniecie.current;
                ostatnieKlikniecie.current = { id: e.id, t: teraz };
                if (poprzednie && poprzednie.id === e.id && teraz - poprzednie.t < 380 && onOtworz) {
                  ostatnieKlikniecie.current = null;
                  onWybierz(e.id);
                  onOtworz(e.id);
                  return;
                }
                const svg = svgRef.current;
                if (!svg) return;
                const p = punkt(svg, ev);
                const start = { id: e.id, x: e.x, z: e.z };
                const drag: Ciagniecie = { id: e.id, pointer: ev.pointerId, dx: e.x - p.x, dz: e.z - p.y };
                ostatnie.current = start;
                setPodglad(start);
                // Zaznaczony tekst zacząłby natywne przeciąganie (pointercancel w połowie ruchu).
                window.getSelection()?.removeAllRanges();
                svg.setPointerCapture(ev.pointerId);
                onWybierz(e.id);
                const move = (pe: PointerEvent) => {
                  if (pe.pointerId !== drag.pointer) return;
                  const q = punkt(svg, pe);
                  const suroweX = Math.max(-100, Math.min(1500, Math.round(q.x + drag.dx)));
                  const suroweZ = Math.max(-100, Math.min(1500, Math.round(q.y + drag.dz)));
                  const oryginal = planRef.current.elementy.find((el) => el.id === drag.id);
                  const przyc = oryginal ? przyciagnij(planRef.current, oryginal, suroweX, suroweZ) : { x: suroweX, z: suroweZ };
                  // Mebel nie wychodzi za ściany pokoju (A, a z wymiarami pokoju także B, C, D).
                  const przy = oryginal ? wGranicachPokoju(planRef.current, rect({ ...oryginal, ...przyc }), przyc.x, przyc.z) : przyc;
                  const nastepne = { id: drag.id, x: przy.x, z: przy.z };
                  ostatnie.current = nastepne;
                  setPodglad(nastepne);
                };
                const up = (pe: PointerEvent) => {
                  if (pe.pointerId !== drag.pointer) return;
                  sluchacze.current = null;
                  window.removeEventListener("pointermove", move);
                  window.removeEventListener("pointerup", up);
                  window.removeEventListener("pointercancel", up);
                  if (svg.hasPointerCapture(pe.pointerId)) svg.releasePointerCapture(pe.pointerId);
                  const teraz = ostatnie.current;
                  const oryginal = planRef.current.elementy.find((el) => el.id === drag.id);
                  setPodglad(null);
                  if (!teraz || !oryginal) return;
                  const kandydat = { ...oryginal, x: teraz.x, z: teraz.z };
                  if (kolizjaZInnymi(planRef.current, kandydat)) {
                    cb.current.onKolizja();
                    return;
                  }
                  // Nie stawiamy mebla w drzwiach ani przed oknem (chyba że już tam stał – wtedy tylko go przesuwamy).
                  const wOtworze = meblaWOtworze(planRef.current, kandydat);
                  if (wOtworze && !meblaWOtworze(planRef.current, oryginal)) {
                    cb.current.onKolizja(wOtworze);
                    return;
                  }
                  if (kandydat.x !== oryginal.x || kandydat.z !== oryginal.z) cb.current.onPrzesun(drag.id, kandydat.x, kandydat.z);
                };
                sluchacze.current?.();
                sluchacze.current = () => {
                  window.removeEventListener("pointermove", move);
                  window.removeEventListener("pointerup", up);
                  window.removeEventListener("pointercancel", up);
                };
                window.addEventListener("pointermove", move);
                window.addEventListener("pointerup", up);
                window.addEventListener("pointercancel", up);
              }}
              onKeyDown={(ev) => {
                const krok = ev.shiftKey ? 1 : 5;
                if (ev.key === "ArrowLeft") {
                  ev.preventDefault();
                  przesun(-krok, 0);
                } else if (ev.key === "ArrowRight") {
                  ev.preventDefault();
                  przesun(krok, 0);
                } else if (ev.key === "ArrowUp") {
                  ev.preventDefault();
                  przesun(0, -krok);
                } else if (ev.key === "ArrowDown") {
                  ev.preventDefault();
                  przesun(0, krok);
                } else if (ev.key === "Enter" && onOtworz) {
                  ev.preventDefault();
                  onOtworz(e.id);
                }
              }}
            >
              <title>{`${e.nazwa} · ${e.w} × ${e.h} × ${e.d} cm (szer. × wys. × gł.)`}</title>
            </rect>
            {e.strefa === "polka" ? (
              <line className="kr-shelf" x1={r.x0 + 1.5} y1={(r.z0 + r.z1) / 2} x2={r.x1 - 1.5} y2={(r.z0 + r.z1) / 2} />
            ) : null}
            <line className="kr-front" x1={front.x1} y1={front.y1} x2={front.x2} y2={front.y2} />
            {detale ? (
              <>
                <Wymiar x1={detale.front.x1} y1={detale.front.y1} x2={detale.front.x2} y2={detale.front.y2} nx={detale.nx} ny={detale.nz} odsun={12} tekst={`${e.w}`} />
                <Wymiar x1={detale.bok.x1} y1={detale.bok.y1} x2={detale.bok.x2} y2={detale.bok.y2} nx={detale.bx} ny={detale.bz} odsun={12} tekst={`${e.d}`} />
                <g className="kr-cad">
                  <rect x={detale.cx - 14} y={detale.cz - 4.3} width={28} height={8.6} rx={1.1} />
                  <text x={detale.cx} y={detale.cz} textAnchor="middle" dominantBaseline="central">
                    {`h ${e.h}`}
                  </text>
                </g>
              </>
            ) : null}
          </g>
        );
      })}
      {rysowane.map((e) => {
        if (wymiary && zaznaczony === e.id) return null;
        const r = rectBazowy(e);
        const napis = napisNaRzucie(e, r);
        if (!napis) return null;
        return (
          <text key={`t-${e.id}`} className="kr-label" data-zone={e.strefa} x={(r.x0 + r.x1) / 2} y={napis.y} textAnchor="middle" dominantBaseline="central" transform={obrotRzutu(e)}>
            {napis.tekst}
          </text>
        );
      })}
      {/* Gniazdka i punkty instalacji na wierzchu (przy ścianie, pod szafkami też trzeba je chwycić). */}
      {punkty.map((p, i) => (
        <PunktRzut
          key={`p${i}`}
          plan={plan}
          p={podgladPunktu?.i === i ? podgladPunktu.p : p}
          zly={podgladPunktu?.i === i && podgladPunktu.bledy.length > 0}
          onPointerDown={onPunkt ? (ev) => zacznijPunkt(ev, i) : undefined}
        />
      ))}
    </svg>
  );
}

/** Szerokość znaku przy font-size 9 (jednostki rzutu = cm). */
const ZNAK = 5.1;

/**
 * Napis elementu: pełna nazwa, gdy się mieści, potem skrót, potem nic (nazwa zostaje w podpowiedzi).
 * Górne szafki i półki podpisujemy przy ścianie, dolne przy froncie – nie nachodzą na siebie, gdy górna wisi nad dolną.
 */
function napisNaRzucie(e: ElementKuchni, r: { x0: number; z0: number; x1: number; z1: number }) {
  const szer = r.x1 - r.x0;
  const gl = r.z1 - r.z0;
  // Napis jest zawsze poziomy, więc mieści się w szerokości obrysu na rzucie.
  const miejsce = szer - 4;
  const pelna = nazwaNaRzucie(e) || String(e.w);
  const krotka = skrotElementu(e);
  const tekst = pelna.length * ZNAK <= miejsce ? pelna : krotka && krotka.length * ZNAK <= miejsce ? krotka : "";
  if (!tekst || Math.min(szer, gl) < 10) return null;
  const pion = e.rot % 180 === 0;
  const glebokosc = pion ? gl : szer;
  const odSciany = Math.min(glebokosc / 2, 7);
  let y = (r.z0 + r.z1) / 2;
  const gora = e.strefa === "gorna" || e.strefa === "polka";
  const dol = e.strefa === "dolna" || e.strefa === "wysoka";
  if (pion && glebokosc >= 24) {
    if (gora) y = e.rot === 180 ? r.z1 - odSciany : r.z0 + odSciany;
    else if (dol) y = e.rot === 180 ? r.z0 + 8 : r.z1 - 8;
  } else if (!pion && gl >= 24) {
    // Ściana B: górna i dolna leżą w tym samym pasie – rozsuwamy napisy w pionie.
    if (gora) y -= 5.5;
    else if (dol) y += 5.5;
  }
  return { tekst, y };
}
