"use client";

import { useEffect, useRef, useState } from "react";
import {
  konfliktStref,
  nachodzi,
  rect,
  STREFA_LABEL,
  type ElementKuchni,
  type PlanKuchni,
} from "@/lib/kuchnia";

type Props = {
  plan: PlanKuchni;
  zaznaczony: string | null;
  onWybierz: (id: string | null) => void;
  onPrzesun: (id: string, x: number, z: number) => void;
  onKolizja: () => void;
};

type Ciagniecie = { id: string; pointer: number; dx: number; dz: number };

function widok(plan: PlanKuchni) {
  let x0 = -30;
  let z0 = -36;
  let x1 = plan.scianaA + 50;
  let z1 = (plan.uklad === "L" ? plan.scianaB : 140) + 50;
  if (plan.pomieszczenie) {
    x1 = Math.max(x1, plan.pomieszczenie.szer + 24);
    z1 = Math.max(z1, plan.pomieszczenie.dlug + 24);
  }
  for (const e of plan.elementy) {
    const r = rect(e);
    x0 = Math.min(x0, r.x0 - 16);
    z0 = Math.min(z0, r.z0 - 16);
    x1 = Math.max(x1, r.x1 + 16);
    z1 = Math.max(z1, r.z1 + 16);
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

function krawedzFrontu(e: ElementKuchni) {
  const r = rect(e);
  if (e.rot === 0) return { x1: r.x0, y1: r.z1, x2: r.x1, y2: r.z1 };
  if (e.rot === 180) return { x1: r.x0, y1: r.z0, x2: r.x1, y2: r.z0 };
  if (e.rot === 90) return { x1: r.x1, y1: r.z0, x2: r.x1, y2: r.z1 };
  return { x1: r.x0, y1: r.z0, x2: r.x0, y2: r.z1 };
}

function kolizjaZInnymi(plan: PlanKuchni, el: ElementKuchni) {
  const r = rect(el);
  return plan.elementy.some((inny) => inny.id !== el.id && konfliktStref(el.strefa, inny.strefa) && nachodzi(r, rect(inny)));
}

export default function RzutKuchni({ plan, zaznaczony, onWybierz, onPrzesun, onKolizja }: Props) {
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
  const box = widok(plan);
  const elementy = plan.elementy.map((e) => (podglad && e.id === podglad.id ? { ...e, x: podglad.x, z: podglad.z } : e));
  const podgladEl = podglad ? elementy.find((e) => e.id === podglad.id) : undefined;
  const podgladNachodzi = podgladEl ? kolizjaZInnymi(plan, podgladEl) : false;

  const linie: { x1: number; y1: number; x2: number; y2: number; k: string }[] = [];
  for (let x = 0; x <= plan.scianaA; x += 20) linie.push({ x1: x, y1: 0, x2: x, y2: plan.uklad === "L" ? plan.scianaB : 80, k: `x${x}` });

  return (
    <svg
      ref={svgRef}
      className="kr-svg"
      viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
      role="group"
      aria-label="Rzut kuchni z góry. Przeciągnij szafkę, strzałki przesuwają zaznaczoną."
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onWybierz(null);
      }}
    >
      {plan.pomieszczenie ? (
        <rect className="kr-room" x={0} y={0} width={plan.pomieszczenie.szer} height={plan.pomieszczenie.dlug} />
      ) : null}
      {linie.map((l) => (
        <line key={l.k} className="kr-grid" x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
      ))}
      <line className="kr-wall" x1={0} y1={0} x2={plan.scianaA} y2={0} />
      {plan.uklad === "L" ? <line className="kr-wall" x1={0} y1={0} x2={0} y2={plan.scianaB} /> : null}
      <text className="kr-dim" x={plan.scianaA / 2} y={-10} textAnchor="middle">
        ściana A · {plan.scianaA} cm
      </text>
      {plan.uklad === "L" ? (
        <text className="kr-dim" x={-10} y={plan.scianaB / 2} textAnchor="middle" transform={`rotate(-90 -10 ${plan.scianaB / 2})`}>
          ściana B · {plan.scianaB} cm
        </text>
      ) : null}
      {elementy.map((e) => {
        const r = rect(e);
        const front = krawedzFrontu(e);
        const nachodziTeraz = podglad?.id === e.id && podgladNachodzi;
        const przesun = (dx: number, dz: number) => {
          const kandydat = { ...e, x: e.x + dx, z: e.z + dz };
          if (kolizjaZInnymi(plan, kandydat)) onKolizja();
          else onPrzesun(e.id, kandydat.x, kandydat.z);
        };
        return (
          <g key={e.id}>
            <rect
              className="kr-piece"
              data-zone={e.strefa}
              data-selected={zaznaczony === e.id ? "" : undefined}
              data-bad={nachodziTeraz ? "" : undefined}
              x={r.x0}
              y={r.z0}
              width={Math.max(1, r.x1 - r.x0)}
              height={Math.max(1, r.z1 - r.z0)}
              tabIndex={0}
              role="button"
              aria-label={`${e.nazwa}, ${STREFA_LABEL[e.strefa]}, ${e.w} na ${e.d} cm. Strzałki przesuwają o 5 cm.`}
              onPointerDown={(ev) => {
                if (ev.button !== 0) return;
                ev.stopPropagation();
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
                  const x = Math.max(-100, Math.min(1500, Math.round(q.x + drag.dx)));
                  const z = Math.max(-100, Math.min(1500, Math.round(q.y + drag.dz)));
                  const nastepne = { id: drag.id, x, z };
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
                }
              }}
            />
            <line className="kr-front" x1={front.x1} y1={front.y1} x2={front.x2} y2={front.y2} />
            <text className="kr-label" x={(r.x0 + r.x1) / 2} y={(r.z0 + r.z1) / 2} textAnchor="middle">
              {e.w}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
