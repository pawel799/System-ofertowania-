"use client";

import { useMemo } from "react";
import { Html, Line } from "@react-three/drei";
import { rect, rectBazowy, zasiegNaScianie, type ElementKuchni, type PlanKuchni } from "@/lib/kuchnia";
import { scianaPoId, scianyPokoju, wysokoscOtworu, wysokoscPokoju, type ScianaPokoju } from "@/lib/sciany";
import { yElementu } from "./uklad3d";

type Pkt = [number, number, number];

function Etykieta({ position, tekst, akcent = false }: { position: Pkt; tekst: string; akcent?: boolean }) {
  return (
    <Html position={position} center zIndexRange={[12, 0]} pointerEvents="none" style={{ pointerEvents: "none" }}>
      <span
        style={{
          display: "block",
          color: "#f7f3ec",
          background: akcent ? "rgba(44, 62, 140, 0.9)" : "rgba(18, 16, 14, 0.82)",
          borderRadius: 4,
          padding: "1px 6px",
          fontSize: 12,
          fontWeight: 650,
          whiteSpace: "nowrap",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "0.01em",
        }}
      >
        {tekst}
      </span>
    </Html>
  );
}

function Odcinek({ a, b, tekst, akcent = false }: { a: Pkt; b: Pkt; tekst: string; akcent?: boolean }) {
  const mid: Pkt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.03, (a[2] + b[2]) / 2];
  return (
    <group>
      <Line points={[a, b]} color={akcent ? "#9fb4ff" : "#f3efe6"} lineWidth={akcent ? 1.6 : 1.25} />
      <Etykieta position={mid} tekst={tekst} akcent={akcent} />
    </group>
  );
}

function cm(n: number) {
  return `${Math.round(n)} cm`;
}

/** Wymiary mebla obróconego o dowolny kąt: te same linie co dla rot, obrócone wokół środka (oś y, jak bryła). */
function wymiaryModulu(el: ElementKuchni, plan: PlanKuchni): { a: Pkt; b: Pkt; tekst: string }[] {
  const linie = wymiaryBazowe(el, plan);
  if (!el.kat) return linie;
  const k = (el.kat * Math.PI) / 180;
  const cx = el.x / 100;
  const cz = el.z / 100;
  const obroc = ([x, y, z]: Pkt): Pkt => {
    const dx = x - cx;
    const dz = z - cz;
    return [cx + dx * Math.cos(k) + dz * Math.sin(k), y, cz - dx * Math.sin(k) + dz * Math.cos(k)];
  };
  return linie.map((l) => ({ ...l, a: obroc(l.a), b: obroc(l.b) }));
}

function wymiaryBazowe(el: ElementKuchni, plan: PlanKuchni): { a: Pkt; b: Pkt; tekst: string }[] {
  const r = rectBazowy(el);
  const y0 = yElementu(el, plan);
  const y1 = y0 + el.h / 100;
  const x0 = r.x0 / 100;
  const x1 = r.x1 / 100;
  const z0 = r.z0 / 100;
  const z1 = r.z1 / 100;
  const o = 0.08;
  const szer = cm(el.w);
  const gl = cm(el.d);
  const wys = cm(el.h);
  if (el.rot === 180) {
    return [
      { a: [x0, y1 + 0.05, z0 - o], b: [x1, y1 + 0.05, z0 - o], tekst: szer },
      { a: [x1 + o, y0 + 0.04, z0], b: [x1 + o, y0 + 0.04, z1], tekst: gl },
      { a: [x0 - o, y0, z0 - o], b: [x0 - o, y1, z0 - o], tekst: wys },
    ];
  }
  if (el.rot === 90) {
    return [
      { a: [x1 + o, y1 + 0.05, z0], b: [x1 + o, y1 + 0.05, z1], tekst: szer },
      { a: [x0, y0 + 0.04, z0 - o], b: [x1, y0 + 0.04, z0 - o], tekst: gl },
      { a: [x1 + o, y0, z1 + o], b: [x1 + o, y1, z1 + o], tekst: wys },
    ];
  }
  if (el.rot === 270) {
    return [
      { a: [x0 - o, y1 + 0.05, z0], b: [x0 - o, y1 + 0.05, z1], tekst: szer },
      { a: [x0, y0 + 0.04, z1 + o], b: [x1, y0 + 0.04, z1 + o], tekst: gl },
      { a: [x0 - o, y0, z0 - o], b: [x0 - o, y1, z0 - o], tekst: wys },
    ];
  }
  return [
    { a: [x0, y1 + 0.05, z1 + o], b: [x1, y1 + 0.05, z1 + o], tekst: szer },
    { a: [x0 - o, y0 + 0.04, z0], b: [x0 - o, y0 + 0.04, z1], tekst: gl },
    { a: [x1 + o, y0, z1 + o], b: [x1 + o, y1, z1 + o], tekst: wys },
  ];
}

/** Co jest zaznaczone w 3D: mebel, okno / drzwi (indeks w wywiad.otwory) albo ściana. */
export type Wybor3D = { typ: "element"; id: string } | { typ: "otwor"; i: number } | { typ: "sciana"; id: ScianaPokoju } | null;

type Linia = { a: Pkt; b: Pkt; tekst: string; k: string; akcent?: boolean };

/** Odległości mebla od ścian, przy których stoi wzdłuż (od narożnika i do końca ściany) – na podłodze przed meblem. */
function odleglosciMebla(el: ElementKuchni, plan: PlanKuchni): Linia[] {
  const r = rect(el);
  const out: Linia[] = [];
  const y = 0.015;
  for (const s of scianyPokoju(plan)) {
    const przy = s.id === "A" ? r.z0 < 8 : s.id === "B" ? r.x0 < 8 : s.id === "C" ? r.z1 > s.z - 8 : r.x1 > s.x - 8;
    if (!przy) continue;
    const a0 = s.dx ? r.x0 : r.z0;
    const a1 = s.dx ? r.x1 : r.z1;
    // Linia na podłodze tuż przed frontem (od strony pokoju).
    const glebia = s.id === "A" ? r.z1 + 6 : s.id === "B" ? r.x1 + 6 : s.id === "C" ? r.z0 - 6 : r.x0 - 6;
    const pkt = (t: number): Pkt => (s.dx ? [t / 100, y, glebia / 100] : [glebia / 100, y, t / 100]);
    if (a0 > 1) out.push({ a: pkt(0), b: pkt(a0), tekst: `← ${cm(a0)}`, k: `od-${s.id}`, akcent: true });
    if (s.dlugosc - a1 > 1) out.push({ a: pkt(a1), b: pkt(s.dlugosc), tekst: `${cm(s.dlugosc - a1)} →`, k: `do-${s.id}`, akcent: true });
  }
  return out;
}

/** Okno albo drzwi: szerokość, wysokość, parapet i odległości od końców ściany (na ścianie, od strony pokoju). */
function wymiaryOtworu(plan: PlanKuchni, i: number): Linia[] {
  const o = plan.wywiad?.otwory[i];
  const s = o ? scianaPoId(plan, o.sciana as ScianaPokoju) : null;
  if (!o || !s) return [];
  const H = wysokoscPokoju(plan);
  const { y0, y1 } = wysokoscOtworu(o, H);
  const n = 0.04;
  const pkt = (t: number, y: number): Pkt => [(s.x + s.dx * t) / 100 + s.nx * n, y / 100, (s.z + s.dz * t) / 100 + s.nz * n];
  const out: Linia[] = [
    { a: pkt(o.od, y1 + 8), b: pkt(o.od + o.szer, y1 + 8), tekst: `szer. ${cm(o.szer)}`, k: "o-szer", akcent: true },
    { a: pkt(o.od - 8, y0), b: pkt(o.od - 8, y1), tekst: `wys. ${cm(y1 - y0)}`, k: "o-wys", akcent: true },
  ];
  if (o.rodzaj === "okno" && y0 > 1) out.push({ a: pkt(o.od + o.szer + 8, 0), b: pkt(o.od + o.szer + 8, y0), tekst: `parapet ${cm(y0)}`, k: "o-par", akcent: true });
  if (o.od > 1) out.push({ a: pkt(0, 12), b: pkt(o.od, 12), tekst: `← ${cm(o.od)}`, k: "o-od", akcent: true });
  const reszta = s.dlugosc - o.od - o.szer;
  if (reszta > 1) out.push({ a: pkt(o.od + o.szer, 12), b: pkt(s.dlugosc, 12), tekst: `${cm(reszta)} →`, k: "o-do", akcent: true });
  return out;
}

/** Ściana: długość (u góry) i wysokość (przy początku). */
function wymiaryScian(plan: PlanKuchni, id: ScianaPokoju): Linia[] {
  const s = scianaPoId(plan, id);
  if (!s) return [];
  const H = wysokoscPokoju(plan);
  const n = 0.04;
  const pkt = (t: number, y: number): Pkt => [(s.x + s.dx * t) / 100 + s.nx * n, y / 100, (s.z + s.dz * t) / 100 + s.nz * n];
  return [
    { a: pkt(0, H - 10), b: pkt(s.dlugosc, H - 10), tekst: `ściana ${s.id} · ${cm(s.dlugosc)}`, k: "s-dl", akcent: true },
    { a: pkt(10, 0), b: pkt(10, H), tekst: `wys. ${cm(H)}`, k: "s-wys", akcent: true },
  ];
}

/**
 * Hook wymiarowania w 3D: linie dla zaznaczonego mebla, okna, drzwi albo ściany, liczone z bieżącego planu –
 * także z podglądu przeciągania, więc liczby zmieniają się na żywo. przeglad = wymiary ścian i ciągów (przycisk „Pokaż wymiary”).
 */
export function useLinieWymiarow(plan: PlanKuchni, wybor: Wybor3D, przeglad: boolean): Linia[] {
  return useMemo(() => {
    const linie: Linia[] = [];
    const el = wybor?.typ === "element" ? (plan.elementy.find((e) => e.id === wybor.id) ?? null) : null;
    if (przeglad) {
      linie.push({ a: [0, 0.03, -0.16], b: [plan.scianaA / 100, 0.03, -0.16], tekst: cm(plan.scianaA), k: "sciana-a" });
      if (plan.uklad === "L") linie.push({ a: [-0.16, 0.03, 0], b: [-0.16, 0.03, plan.scianaB / 100], tekst: cm(plan.scianaB), k: "sciana-b" });
      if (plan.pomieszczenie) {
        const szer = plan.pomieszczenie.szer / 100;
        const dlug = plan.pomieszczenie.dlug / 100;
        linie.push(
          { a: [0, 0.02, dlug + 0.12], b: [szer, 0.02, dlug + 0.12], tekst: `pom. ${cm(plan.pomieszczenie.szer)}`, k: "pokoj-szer" },
          { a: [szer + 0.12, 0.02, 0], b: [szer + 0.12, 0.02, dlug], tekst: `pom. ${cm(plan.pomieszczenie.dlug)}`, k: "pokoj-dlug" },
        );
      }
      if (!wybor) {
        (["A", "B"] as const).forEach((sciana) => {
          if (sciana === "B" && plan.uklad !== "L") return;
          const zasieg = zasiegNaScianie(plan, "dolna", sciana);
          if (!zasieg) return;
          const od = zasieg.od / 100;
          const dok = zasieg.do / 100;
          const tekst = `ciąg ${cm(zasieg.do - zasieg.od)}`;
          if (sciana === "A") linie.push({ a: [od, 0.02, 0.78], b: [dok, 0.02, 0.78], tekst, k: "ciag-a" });
          else linie.push({ a: [0.78, 0.02, od], b: [0.78, 0.02, dok], tekst, k: "ciag-b" });
        });
      }
    }
    if (el) {
      wymiaryModulu(el, plan).forEach((linia, i) => linie.push({ ...linia, k: `el-${i}` }));
      linie.push(...odleglosciMebla(el, plan));
    }
    if (wybor?.typ === "otwor") linie.push(...wymiaryOtworu(plan, wybor.i));
    if (wybor?.typ === "sciana") linie.push(...wymiaryScian(plan, wybor.id));
    return linie;
  }, [plan, wybor, przeglad]);
}

export default function Wymiary3D({ plan, wybor, przeglad = true }: { plan: PlanKuchni; wybor: Wybor3D; przeglad?: boolean }) {
  const linie = useLinieWymiarow(plan, wybor, przeglad);
  if (!linie.length) return null;
  return (
    <group name="wymiary">
      {linie.map((l) => (
        <Odcinek key={l.k} a={l.a} b={l.b} tekst={l.tekst} akcent={l.akcent} />
      ))}
    </group>
  );
}
