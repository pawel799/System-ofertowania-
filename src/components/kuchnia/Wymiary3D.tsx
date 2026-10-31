"use client";

import { Html, Line } from "@react-three/drei";
import { rectBazowy, zasiegNaScianie, type ElementKuchni, type PlanKuchni } from "@/lib/kuchnia";
import { yElementu } from "./uklad3d";

type Pkt = [number, number, number];

function Etykieta({ position, tekst }: { position: Pkt; tekst: string }) {
  return (
    <Html position={position} center zIndexRange={[12, 0]} pointerEvents="none" style={{ pointerEvents: "none" }}>
      <span
        style={{
          display: "block",
          color: "#f7f3ec",
          background: "rgba(18, 16, 14, 0.82)",
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

function Odcinek({ a, b, tekst }: { a: Pkt; b: Pkt; tekst: string }) {
  const mid: Pkt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.03, (a[2] + b[2]) / 2];
  return (
    <group>
      <Line points={[a, b]} color="#f3efe6" lineWidth={1.25} />
      <Etykieta position={mid} tekst={tekst} />
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

export default function Wymiary3D({ plan, zaznaczony }: { plan: PlanKuchni; zaznaczony?: string | null }) {
  const el = plan.elementy.find((e) => e.id === zaznaczony) ?? null;
  const linie: { a: Pkt; b: Pkt; tekst: string; k: string }[] = [
    { a: [0, 0.03, -0.16], b: [plan.scianaA / 100, 0.03, -0.16], tekst: cm(plan.scianaA), k: "sciana-a" },
  ];
  if (plan.uklad === "L") {
    linie.push({ a: [-0.16, 0.03, 0], b: [-0.16, 0.03, plan.scianaB / 100], tekst: cm(plan.scianaB), k: "sciana-b" });
  }
  if (plan.pomieszczenie) {
    const szer = plan.pomieszczenie.szer / 100;
    const dlug = plan.pomieszczenie.dlug / 100;
    linie.push(
      { a: [0, 0.02, dlug + 0.12], b: [szer, 0.02, dlug + 0.12], tekst: `pom. ${cm(plan.pomieszczenie.szer)}`, k: "pokoj-szer" },
      { a: [szer + 0.12, 0.02, 0], b: [szer + 0.12, 0.02, dlug], tekst: `pom. ${cm(plan.pomieszczenie.dlug)}`, k: "pokoj-dlug" },
    );
  }
  if (el) {
    wymiaryModulu(el, plan).forEach((linia, i) => linie.push({ ...linia, k: `el-${i}` }));
  } else {
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

  return (
    <group>
      {linie.map((l) => (
        <Odcinek key={l.k} a={l.a} b={l.b} tekst={l.tekst} />
      ))}
    </group>
  );
}
