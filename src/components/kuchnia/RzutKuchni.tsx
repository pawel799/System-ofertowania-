"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
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

type Props = {
  plan: PlanKuchni;
  zaznaczony: string | null;
  wymiary: boolean;
  onWybierz: (id: string | null) => void;
  onPrzesun: (id: string, x: number, z: number) => void;
  onKolizja: () => void;
  /** Podwójne kliknięcie (albo Enter) na elemencie – okno wymiarów i wnętrza. */
  onOtworz?: (id: string) => void;
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

export default function RzutKuchni({ plan, zaznaczony, wymiary, onWybierz, onPrzesun, onKolizja, onOtworz }: Props) {
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
  const elementy = plan.elementy.map((e) => (podglad && e.id === podglad.id ? { ...e, x: podglad.x, z: podglad.z } : e));
  const widokPlan: PlanKuchni = { ...plan, elementy };
  const podgladEl = podglad ? elementy.find((e) => e.id === podglad.id) : undefined;
  const podgladNachodzi = podgladEl ? kolizjaZInnymi(plan, podgladEl) : false;
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
        if (e.target === e.currentTarget) onWybierz(null);
      }}
    >
      {plan.pomieszczenie ? <rect className="kr-room" x={0} y={0} width={plan.pomieszczenie.szer} height={plan.pomieszczenie.dlug} /> : null}
      {linie.map((l) => (
        <line key={l.k} className="kr-grid" x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
      ))}
      <line className="kr-wall" x1={0} y1={0} x2={plan.scianaA} y2={0} />
      {plan.uklad === "L" ? <line className="kr-wall" x1={0} y1={0} x2={0} y2={plan.scianaB} /> : null}
      {/* Z kroku „Okna i instalacje”: okna i drzwi na ścianach, przyłącze wody. */}
      {(plan.wywiad?.otwory ?? []).map((o, i) => {
        const A = o.sciana === "A";
        const x1 = A ? o.od : 0;
        const y1 = A ? 0 : o.od;
        const x2 = A ? o.od + o.szer : 0;
        const y2 = A ? 0 : o.od + o.szer;
        const tx = A ? o.od + o.szer / 2 : -14;
        const ty = A ? -6 : o.od + o.szer / 2;
        return (
          <g key={`o${i}`} className={o.rodzaj === "okno" ? "kr-okno" : "kr-drzwi"} aria-hidden>
            <line x1={x1} y1={y1} x2={x2} y2={y2} />
            {o.rodzaj === "drzwi" ? (
              <path d={A ? `M${x1} 0 A${o.szer} ${o.szer} 0 0 1 ${x1 + o.szer} ${-o.szer * 0.0001} M${x1} 0 L${x1} ${-Math.min(o.szer, 40)}` : `M0 ${y1} L${-Math.min(o.szer, 40)} ${y1}`} />
            ) : null}
            <text x={tx} y={ty} textAnchor="middle" transform={A ? undefined : `rotate(-90 ${tx} ${ty})`}>
              {o.rodzaj === "okno" ? `okno ${o.szer}` : `drzwi ${o.szer}`}
            </text>
          </g>
        );
      })}
      {plan.wywiad?.woda ? (
        <g className="kr-woda" aria-hidden>
          <circle cx={plan.wywiad.woda.sciana === "A" ? plan.wywiad.woda.od : 5} cy={plan.wywiad.woda.sciana === "A" ? 5 : plan.wywiad.woda.od} r={3.2} />
        </g>
      ) : null}
      {wymiary ? (
        <g>
          <Wymiar x1={0} y1={0} x2={plan.scianaA} y2={0} nx={0} ny={-1} odsun={18} tekst={`${plan.scianaA}`} />
          {plan.uklad === "L" ? <Wymiar x1={0} y1={0} x2={0} y2={plan.scianaB} nx={-1} ny={0} odsun={18} tekst={`${plan.scianaB}`} /> : null}
          {plan.pomieszczenie ? (
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
          const przy = przyciagnij(plan, e, e.x + dx, e.z + dz);
          const kandydat = { ...e, x: przy.x, z: przy.z };
          if (kolizjaZInnymi(plan, kandydat)) onKolizja();
          else if (przy.x !== e.x || przy.z !== e.z) onPrzesun(e.id, przy.x, przy.z);
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
                svg.setPointerCapture(ev.pointerId);
                onWybierz(e.id);
                const move = (pe: PointerEvent) => {
                  if (pe.pointerId !== drag.pointer) return;
                  const q = punkt(svg, pe);
                  const suroweX = Math.max(-100, Math.min(1500, Math.round(q.x + drag.dx)));
                  const suroweZ = Math.max(-100, Math.min(1500, Math.round(q.y + drag.dz)));
                  const oryginal = planRef.current.elementy.find((el) => el.id === drag.id);
                  const przy = oryginal ? przyciagnij(planRef.current, oryginal, suroweX, suroweZ) : { x: suroweX, z: suroweZ };
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
