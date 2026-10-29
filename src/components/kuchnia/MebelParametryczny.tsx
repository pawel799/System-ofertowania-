"use client";

/*
 * Moduł na wymiar z wnętrzem (src/lib/wnetrze.ts): boki, wieńce, przegrody, plecy, półki, drążki, szuflady ze skrzynką,
 * fronty – drzwi na zawiasach, szuflady na prowadnicach, drzwi przesuwne. Fronty umieją się otworzyć (prop `otwarte`),
 * żeby było widać, co jest w środku.
 *
 * Początek układu: środek podstawy, front w +Z (jak Szafka.tsx). Wymiary w metrach.
 */
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useDrewno } from "../modul/Szafka";
import { wnetrzeDomyslne, type Wnetrze } from "@/lib/wnetrze";
import type { ElementKuchni } from "@/lib/kuchnia";

const T = 0.018;
const PLECY = 0.003;
const GAP = 0.002;
const KAT_DRZWI = (100 * Math.PI) / 180;

/** Płynne otwieranie: 0 → 1 w ok. 0,5 s; klatki tylko w trakcie ruchu (frameloop="demand"). */
export function useRuch(otwarte: boolean, ustaw: (p: number) => void) {
  const p = useRef(otwarte ? 1 : 0);
  const invalidate = useThree((s) => s.invalidate);
  const cel = otwarte ? 1 : 0;
  useEffect(() => {
    ustaw(p.current);
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cel, invalidate]);
  useFrame((_, dt) => {
    if (Math.abs(p.current - cel) < 0.001) return;
    const krok = Math.min(1, dt * 3.2);
    p.current += (cel - p.current) * krok + Math.sign(cel - p.current) * 0.002;
    if ((cel === 1 && p.current > 1) || (cel === 0 && p.current < 0) || Math.abs(p.current - cel) < 0.002) p.current = cel;
    // Łagodny start i koniec.
    const e = p.current * p.current * (3 - 2 * p.current);
    ustaw(e);
    invalidate();
  });
}

function Zawias({ os, kat, pivot, otwarte, children }: { os: "y" | "x"; kat: number; pivot: [number, number, number]; otwarte: boolean; children: ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useRuch(otwarte, (p) => {
    if (!g.current) return;
    if (os === "y") g.current.rotation.y = kat * p;
    else g.current.rotation.x = kat * p;
  });
  return (
    <group ref={g} position={pivot}>
      <group position={[-pivot[0], -pivot[1], -pivot[2]]}>{children}</group>
    </group>
  );
}

function Przesuw({ o, otwarte, children }: { o: [number, number, number]; otwarte: boolean; children: ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useRuch(otwarte, (p) => {
    g.current?.position.set(o[0] * p, o[1] * p, o[2] * p);
  });
  return <group ref={g}>{children}</group>;
}

function Box({ s, p, m }: { s: [number, number, number]; p: [number, number, number]; m: THREE.Material }) {
  return (
    <mesh position={p} material={m} castShadow receiveShadow>
      <boxGeometry args={s} />
    </mesh>
  );
}

type Kawalek = { x0: number; x1: number; y0: number; y1: number };

/** Granice przestrzeni w kolumnie (m, od podłogi). Płyta między przestrzeniami, poza parą szuflada–szuflada. */
function przestrzenie(wn: Wnetrze["kolumny"][number], H: number) {
  let y = T;
  const out: { typ: string; y0: number; y1: number; plytaNad: boolean }[] = [];
  wn.sekcje.forEach((s, i) => {
    const y0 = y;
    const y1 = y0 + s.h / 100;
    const nast = wn.sekcje[i + 1];
    const plytaNad = !!nast && !(s.typ === "szuflada" && nast.typ === "szuflada");
    out.push({ typ: s.typ, y0, y1, plytaNad });
    y = plytaNad ? y1 + T : y1;
  });
  // Zaokrąglenia: ostatnia przestrzeń kończy się pod wieńcem.
  if (out.length) out[out.length - 1].y1 = H - T;
  return out;
}

export default function MebelParametryczny({
  el,
  kolor,
  chropowatosc,
  uchwyt,
  otwarte = false,
}: {
  el: ElementKuchni;
  kolor: string;
  chropowatosc: number;
  uchwyt: boolean;
  otwarte?: boolean;
}) {
  const m = useDrewno();
  const wn = useMemo(() => el.wnetrze ?? wnetrzeDomyslne(el), [el]);
  const frontMat = useMemo(() => new THREE.MeshStandardMaterial({ color: kolor, roughness: chropowatosc, metalness: 0.02 }), [kolor, chropowatosc]);
  const metal = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2b2b2b", metalness: 0.8, roughness: 0.35 }), []);
  const chrom = useMemo(() => new THREE.MeshStandardMaterial({ color: "#c9ccd0", metalness: 0.9, roughness: 0.25 }), []);
  const dno = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e9e4dc", roughness: 0.85 }), []);
  const ceramika = useMemo(() => new THREE.MeshStandardMaterial({ color: "#f4f4f2", roughness: 0.25 }), []);
  useEffect(() => () => [frontMat, metal, chrom, dno, ceramika].forEach((x) => x.dispose()), [frontMat, metal, chrom, dno, ceramika]);

  const W = el.w / 100;
  const H = el.h / 100;
  const D = el.d / 100;
  if (!wn) return null;

  const n = wn.kolumny.length;
  const colW = (W - 2 * T - (n - 1) * T) / n;
  const dK = D - PLECY;
  const zK = PLECY / 2;
  const zFront = D / 2 + T / 2 + 0.001;
  const kolX = (c: number) => -W / 2 + T + c * (colW + T);
  const rodzaj = el.rodzaj ?? "szafka";
  const zlew = rodzaj === "zlew";
  const czesci: ReactNode[] = [];

  // Korpus: boki, wieniec dolny, górny (zlew: dwie listwy), plecy, przegrody.
  czesci.push(<Box key="bl" m={m.korpus} s={[T, H, dK]} p={[-W / 2 + T / 2, H / 2, zK]} />);
  czesci.push(<Box key="bp" m={m.korpus} s={[T, H, dK]} p={[W / 2 - T / 2, H / 2, zK]} />);
  czesci.push(<Box key="wd" m={m.korpus} s={[W - 2 * T, T, dK]} p={[0, T / 2, zK]} />);
  if (zlew) {
    czesci.push(<Box key="lp" m={m.korpus} s={[W - 2 * T, T, 0.1]} p={[0, H - T / 2, zK + dK / 2 - 0.05]} />);
    czesci.push(<Box key="lt" m={m.korpus} s={[W - 2 * T, T, 0.1]} p={[0, H - T / 2, zK - dK / 2 + 0.05]} />);
  } else {
    czesci.push(<Box key="wg" m={m.korpus} s={[W - 2 * T, T, dK]} p={[0, H - T / 2, zK]} />);
  }
  czesci.push(<Box key="pl" m={m.plecy} s={[W, H, PLECY]} p={[0, H / 2, -D / 2 + PLECY / 2]} />);
  for (let c = 1; c < n; c++) {
    czesci.push(<Box key={`pr${c}`} m={m.korpus} s={[T, H - 2 * T, dK - 0.01]} p={[kolX(c) - T / 2, H / 2, zK - 0.005]} />);
  }

  // Fronty: drzwi uchylne nad ciągiem nie-szuflad, szuflady z własnym frontem (chyba że za drzwiami / przesuwne).
  const zewnetrzneSzuflady = wn.front !== "przesuwne" && !wn.szufladyZaDrzwiami;
  const kraniecL = (c: number) => (c === 0 ? -W / 2 : kolX(c) - T / 2);
  const kraniecP = (c: number) => (c === n - 1 ? W / 2 : kolX(c) + colW + T / 2);
  const wysokoUchwyt = el.strefa === "gorna" ? "dol" : H > 1.2 ? "srodek" : "gora";

  wn.kolumny.forEach((kol, c) => {
    const x0 = kolX(c);
    const prz = przestrzenie(kol, H);
    // Półki
    prz.forEach((s, i) => {
      if (s.plytaNad) czesci.push(<Box key={`po${c}-${i}`} m={m.korpus} s={[colW, T, dK - 0.02]} p={[x0 + colW / 2, s.y1 + T / 2, zK - 0.01]} />);
      if (s.typ === "drazek") {
        czesci.push(
          <mesh key={`dr${c}-${i}`} position={[x0 + colW / 2, s.y1 - 0.07, zK]} rotation={[0, 0, Math.PI / 2]} material={chrom} castShadow>
            <cylinderGeometry args={[0.0125, 0.0125, colW, 14]} />
          </mesh>,
        );
      }
    });
    // Szuflady (skrzynka + front), wysuwane do przodu.
    prz.forEach((s, i) => {
      if (s.typ !== "szuflada") return;
      const wysuw = dK * 0.75;
      const hb = Math.max(0.05, Math.min(0.22, (s.y1 - s.y0) * 0.78));
      const bw = colW - 0.026;
      const bd = dK - 0.05;
      const yb = s.y0 + 0.012;
      const zb = zK + 0.015;
      const skrzynka = (
        <group key="sk">
          <Box m={dno} s={[bw, 0.008, bd]} p={[x0 + colW / 2, yb + 0.004, zb]} />
          <Box m={m.korpus} s={[0.016, hb, bd]} p={[x0 + 0.013 + 0.008, yb + hb / 2, zb]} />
          <Box m={m.korpus} s={[0.016, hb, bd]} p={[x0 + colW - 0.013 - 0.008, yb + hb / 2, zb]} />
          <Box m={m.korpus} s={[bw, hb, 0.016]} p={[x0 + colW / 2, yb + hb / 2, zb - bd / 2 + 0.008]} />
          <Box m={m.korpus} s={[bw, hb, 0.016]} p={[x0 + colW / 2, yb + hb / 2, zb + bd / 2 - 0.008]} />
        </group>
      );
      let front: ReactNode = null;
      if (zewnetrzneSzuflady) {
        const prev = prz[i - 1];
        const next = prz[i + 1];
        const fy0 = !prev ? 0 : prev.plytaNad ? s.y0 - T / 2 : s.y0;
        const fy1 = !next ? H : s.plytaNad ? s.y1 + T / 2 : s.y1;
        const fx0 = kraniecL(c);
        const fx1 = kraniecP(c);
        const fh = fy1 - fy0 - 2 * GAP;
        front = (
          <group key="fr">
            <Box m={frontMat} s={[fx1 - fx0 - 2 * GAP, fh, T]} p={[(fx0 + fx1) / 2, (fy0 + fy1) / 2, zFront]} />
            {uchwyt ? <Box m={metal} s={[Math.min(0.16, (fx1 - fx0) * 0.4), 0.012, 0.012]} p={[(fx0 + fx1) / 2, fy1 - Math.min(0.05, fh * 0.3), zFront + T / 2 + 0.012]} /> : null}
          </group>
        );
      } else {
        // Szuflada wewnętrzna: niższy przód w kolorze korpusu.
        front = <Box key="fw" m={m.korpus} s={[bw, hb + 0.02, T]} p={[x0 + colW / 2, yb + (hb + 0.02) / 2, zK + dK / 2 - 0.03]} />;
      }
      czesci.push(
        <Przesuw key={`sz${c}-${i}`} o={[0, 0, wysuw]} otwarte={otwarte}>
          {skrzynka}
          {front}
        </Przesuw>,
      );
    });

    // Drzwi uchylne: na ciągach przestrzeni bez szuflad (albo cała kolumna, gdy szuflady są za drzwiami).
    if (wn.front !== "drzwi" || kol.bezFrontu) return;
    const ciagi: [number, number][] = [];
    if (!zewnetrzneSzuflady) ciagi.push([0, prz.length - 1]);
    else {
      let start = -1;
      prz.forEach((s, i) => {
        if (s.typ !== "szuflada" && start < 0) start = i;
        if ((s.typ === "szuflada" || i === prz.length - 1) && start >= 0) {
          ciagi.push([start, s.typ === "szuflada" ? i - 1 : i]);
          start = -1;
        }
      });
    }
    ciagi.forEach(([a, b], ci) => {
      const prev = prz[a - 1];
      const fy0 = a === 0 ? 0 : prev.plytaNad ? prz[a].y0 - T / 2 : prz[a].y0;
      const fy1 = b === prz.length - 1 ? H : prz[b].plytaNad ? prz[b].y1 + T / 2 : prz[b].y1;
      const fx0 = kraniecL(c);
      const fx1 = kraniecP(c);
      const szer = fx1 - fx0;
      const dwa = szer > 0.6 + 0.001;
      const skrzydla: Kawalek[] = dwa
        ? [
            { x0: fx0, x1: fx0 + szer / 2, y0: fy0, y1: fy1 },
            { x0: fx0 + szer / 2, x1: fx1, y0: fy0, y1: fy1 },
          ]
        : [{ x0: fx0, x1: fx1, y0: fy0, y1: fy1 }];
      skrzydla.forEach((k, li) => {
        const lewy = dwa ? li === 0 : n === 1 || c < n / 2;
        const hx = lewy ? k.x0 + GAP : k.x1 - GAP;
        const fh = k.y1 - k.y0 - 2 * GAP;
        const uy = wysokoUchwyt === "gora" ? k.y1 - 0.08 : wysokoUchwyt === "dol" ? k.y0 + 0.08 : Math.min(k.y1 - 0.1, k.y0 + 1.05);
        czesci.push(
          <Zawias key={`d${c}-${ci}-${li}`} os="y" kat={lewy ? -KAT_DRZWI : KAT_DRZWI} pivot={[hx, 0, zFront + T / 2]} otwarte={otwarte}>
            <Box m={frontMat} s={[k.x1 - k.x0 - 2 * GAP, fh, T]} p={[(k.x0 + k.x1) / 2, (k.y0 + k.y1) / 2, zFront]} />
            {uchwyt ? <Box m={metal} s={[0.012, Math.min(0.14, fh * 0.35), 0.012]} p={[lewy ? k.x1 - 0.04 : k.x0 + 0.04, uy, zFront + T / 2 + 0.012]} /> : null}
          </Zawias>,
        );
      });
    });
  });

  // Drzwi przesuwne: 2–4 skrzydła na dwóch torach; przednie odjeżdżają na tylne.
  if (wn.front === "przesuwne") {
    const p = Math.min(4, Math.max(2, Math.round(W / 1.0)));
    const pw = W / p;
    for (let i = 0; i < p; i++) {
      const przod = i % 2 === 0;
      const z = zFront + (przod ? 0.03 : 0);
      const cx = -W / 2 + pw * (i + 0.5);
      const kierunek = i + 1 < p ? 1 : -1;
      const skrzydlo = (
        <group key={`ps${i}`}>
          <Box m={frontMat} s={[pw + (przod ? 0.02 : 0), H - 0.02, T]} p={[cx, H / 2, z]} />
          {uchwyt ? <Box m={metal} s={[0.012, 0.5, 0.012]} p={[cx + (kierunek > 0 ? pw / 2 - 0.05 : -pw / 2 + 0.05), Math.min(1.1, H / 2), z + T / 2 + 0.01]} /> : null}
        </group>
      );
      czesci.push(
        przod ? (
          <Przesuw key={`pp${i}`} o={[kierunek * pw * 0.96, 0, 0]} otwarte={otwarte}>
            {skrzydlo}
          </Przesuw>
        ) : (
          skrzydlo
        ),
      );
    }
    // Tor górny i dolny.
    czesci.push(<Box key="tor-g" m={chrom} s={[W, 0.012, 0.07]} p={[0, H - 0.006, zFront + 0.015]} />);
    czesci.push(<Box key="tor-d" m={chrom} s={[W, 0.008, 0.07]} p={[0, 0.004, zFront + 0.015]} />);
  }

  // Szafka pod umywalkę: blat z ceramiki z misą.
  if (rodzaj === "umywalka") {
    czesci.push(<Box key="umb" m={ceramika} s={[W + 0.01, 0.03, D + 0.02]} p={[0, H + 0.015, 0.01]} />);
    czesci.push(
      <mesh key="umm" position={[0, H + 0.031, 0.02]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[Math.min(W, D) * 0.32, 32]} />
        <meshStandardMaterial color="#d9dcdf" roughness={0.2} />
      </mesh>,
    );
  }

  return <group>{czesci}</group>;
}
