"use client";

/*
 * Gniazdka, włączniki, kinkiety, RTV, zawór gazu i kratki na ścianach w 3D (wywiad.punkty, src/lib/punkty.ts).
 * Modele są proceduralne (kilka prostych brył, wymiary jak prawdziwe osprzęty). Punkt jest widoczny tylko od środka
 * pokoju – razem ze ścianą, na której wisi (ściana między kamerą a meblami znika, jego punkty też).
 *
 * Kreator: punkt przeciąga się po ścianach (wzdłuż i w pionie, także na inną ścianę); czerwona obwódka =
 * nie może tam być (sprawdzPunkt), puszczony wtedy wraca z komunikatem.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { PlanKuchni } from "@/lib/kuchnia";
import { naScianie, sprawdzPunkt } from "@/lib/punkty";
import { scianyPokoju, wysokoscPokoju, type Sciana, type ScianaPokoju } from "@/lib/sciany";
import { PUNKT_INFO, type PunktInstalacji, type RodzajPunktu } from "@/lib/wywiad";

const OBROT: Record<ScianaPokoju, number> = { A: 0, B: Math.PI / 2, C: Math.PI, D: -Math.PI / 2 };

export type EdycjaPunktow = {
  onPunkt: (i: number, p: PunktInstalacji) => void;
  onBlad: (powod: string) => void;
};

const mat = (color: string, roughness: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
const M = {
  bialy: mat("#f6f5f1", 0.35),
  wklad: mat("#e7e5df", 0.4),
  ciemny: mat("#2a2a2a", 0.6),
  szary: mat("#9b9a95", 0.5),
  metal: mat("#c4c4c0", 0.3, { metalness: 0.75 }),
  czerwony: mat("#c8372d", 0.45),
  zolty: mat("#e3b31f", 0.4),
  kratka: mat("#dcdad4", 0.5),
  swiatlo: mat("#fff3d2", 0.4, { emissive: "#ffd889", emissiveIntensity: 0.85 }),
  zly: mat("#d64545", 0.6, { transparent: true, opacity: 0.85 }),
};

/** Walec wzdłuż osi z (prostopadle do ściany). */
function WalecZ({ r, l, z, x = 0, y = 0, m }: { r: number; l: number; z: number; x?: number; y?: number; m: THREE.Material }) {
  return (
    <mesh position={[x, y, z]} rotation={[Math.PI / 2, 0, 0]} material={m}>
      <cylinderGeometry args={[r, r, l, 20]} />
    </mesh>
  );
}

function Box({ s, p, m }: { s: [number, number, number]; p: [number, number, number]; m: THREE.Material }) {
  return (
    <mesh position={p} material={m} castShadow>
      <boxGeometry args={s} />
    </mesh>
  );
}

/** Wkład gniazdka typu E (polski): okrągłe zagłębienie, dwa otwory, bolec uziemiający. */
function WkladGniazdka({ x = 0 }: { x?: number }) {
  return (
    <>
      <WalecZ r={0.027} l={0.004} z={0.013} x={x} m={M.wklad} />
      <WalecZ r={0.0035} l={0.003} z={0.0155} x={x - 0.0095} m={M.ciemny} />
      <WalecZ r={0.0035} l={0.003} z={0.0155} x={x + 0.0095} m={M.ciemny} />
      <WalecZ r={0.0022} l={0.012} z={0.019} x={x} y={0.011} m={M.metal} />
    </>
  );
}

/** Model punktu w lokalnym układzie ściany (m): x wzdłuż, y w górę, z do wnętrza pokoju. */
export function ModelPunktu({ rodzaj }: { rodzaj: RodzajPunktu }) {
  const { szer, h } = PUNKT_INFO[rodzaj];
  const ramka = <Box s={[szer / 100, h / 100, 0.012]} p={[0, 0, 0.006]} m={rodzaj === "kratka" ? M.kratka : rodzaj === "sila" ? M.szary : M.bialy} />;
  let srodek: ReactNode = null;
  if (rodzaj === "gniazdko") srodek = <WkladGniazdka />;
  else if (rodzaj === "gniazdko-2")
    srodek = (
      <>
        <WkladGniazdka x={-0.036} />
        <WkladGniazdka x={0.036} />
      </>
    );
  else if (rodzaj === "sila")
    // Gniazdo siłowe CEE 400 V: czerwony korpus z klapką.
    srodek = (
      <>
        <WalecZ r={0.034} l={0.05} z={0.037} m={M.czerwony} />
        <WalecZ r={0.037} l={0.008} z={0.064} y={0.004} m={M.czerwony} />
      </>
    );
  else if (rodzaj === "wlacznik")
    srodek = (
      <mesh position={[0, 0, 0.015]} rotation={[0.07, 0, 0]} material={M.bialy}>
        <boxGeometry args={[0.052, 0.052, 0.008]} />
      </mesh>
    );
  else if (rodzaj === "swiatlo")
    // Kinkiet: podstawa, ramię, świecący klosz.
    srodek = (
      <>
        <WalecZ r={0.04} l={0.014} z={0.013} m={M.metal} />
        <WalecZ r={0.006} l={0.1} z={0.06} m={M.metal} />
        <mesh position={[0, -0.01, 0.12]} material={M.swiatlo}>
          <cylinderGeometry args={[0.042, 0.068, 0.1, 24, 1, true]} />
        </mesh>
      </>
    );
  else if (rodzaj === "rtv")
    srodek = (
      <>
        <WalecZ r={0.007} l={0.012} z={0.017} x={-0.017} m={M.metal} />
        <Box s={[0.016, 0.014, 0.004]} p={[0.017, 0, 0.014]} m={M.ciemny} />
      </>
    );
  else if (rodzaj === "gaz")
    // Króciec ze ściany, korpus zaworu, żółta dźwignia.
    return (
      <>
        <Box s={[szer / 100, h / 100, 0.004]} p={[0, 0, 0.002]} m={M.bialy} />
        <WalecZ r={0.011} l={0.05} z={0.025} m={M.metal} />
        <Box s={[0.032, 0.036, 0.032]} p={[0, 0, 0.06]} m={M.metal} />
        <Box s={[0.075, 0.013, 0.009]} p={[0.025, 0.012, 0.08]} m={M.zolty} />
        <mesh position={[0, -0.04, 0.06]} material={M.metal}>
          <cylinderGeometry args={[0.009, 0.009, 0.05, 16]} />
        </mesh>
      </>
    );
  else if (rodzaj === "kratka")
    srodek = (
      <>
        <Box s={[0.12, 0.12, 0.002]} p={[0, 0, 0.0125]} m={M.ciemny} />
        {[-0.05, -0.03, -0.01, 0.01, 0.03, 0.05].map((y) => (
          <mesh key={y} position={[0, y, 0.015]} rotation={[-0.5, 0, 0]} material={M.kratka}>
            <boxGeometry args={[0.12, 0.012, 0.003]} />
          </mesh>
        ))}
      </>
    );
  return (
    <>
      {ramka}
      {srodek}
    </>
  );
}

/** Punkt na ścianie; widoczny, gdy kamera jest po stronie pokoju. */
function PunktNaScianie({
  s,
  p,
  zly,
  onPointerDown,
  onClick,
  edycja,
}: {
  s: Sciana;
  p: PunktInstalacji;
  zly: boolean;
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
  edycja: boolean;
}) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    if (g.current) g.current.visible = (camera.position.x - s.x / 100) * s.nx + (camera.position.z - s.z / 100) * s.nz > 0;
  });
  const { szer, h } = PUNKT_INFO[p.rodzaj];
  return (
    <group
      ref={g}
      name={`punkt-${p.rodzaj}`}
      position={[(s.x + s.dx * p.od) / 100 + s.nx * 0.001, p.wys / 100, (s.z + s.dz * p.od) / 100 + s.nz * 0.001]}
      rotation={[0, OBROT[s.id], 0]}
      onPointerDown={onPointerDown}
      onClick={onClick}
      onPointerOver={edycja ? () => (document.body.style.cursor = "grab") : undefined}
      onPointerOut={edycja ? () => (document.body.style.cursor = "") : undefined}
    >
      <ModelPunktu rodzaj={p.rodzaj} />
      {zly ? <Box s={[szer / 100 + 0.03, h / 100 + 0.03, 0.004]} p={[0, 0, 0.001]} m={M.zly} /> : null}
    </group>
  );
}

type Podglad = { i: number; p: PunktInstalacji; bledy: string[] };

/** Przeciąganie punktu: promień spod kursora → najbliższa ściana zwrócona do kamery → miejsce i wysokość na niej. */
function usePrzeciaganiePunktu(plan: PlanKuchni, edycja?: EdycjaPunktow, onPodglad?: (p: { i: number; p: PunktInstalacji } | null) => void) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null;
  const invalidate = useThree((s) => s.invalidate);
  const [podglad, ustawPodglad] = useState<Podglad | null>(null);
  const setPodglad = (p: Podglad | null) => {
    ustawPodglad(p);
    onPodglad?.(p ? { i: p.i, p: p.p } : null);
  };
  const planRef = useRef(plan);
  planRef.current = plan;
  const sprzatanie = useRef<(() => void) | null>(null);
  useEffect(() => () => sprzatanie.current?.(), []);

  const zacznij = (e: ThreeEvent<PointerEvent>, i: number) => {
    if (!edycja || e.button !== 0) return;
    e.stopPropagation();
    const start = planRef.current.wywiad?.punkty?.[i];
    if (!start) return;
    if (controls) controls.enabled = false;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let teraz: Podglad = { i, p: start, bledy: [] };
    setPodglad(teraz);
    const move = (pe: PointerEvent) => {
      const r = gl.domElement.getBoundingClientRect();
      ndc.set(((pe.clientX - r.left) / r.width) * 2 - 1, -((pe.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const pl = planRef.current;
      const H = wysokoscPokoju(pl) / 100;
      let traf: { s: Sciana; t: number; y: number; d: number } | null = null;
      for (const s of scianyPokoju(pl)) {
        const n = new THREE.Vector3(s.nx, 0, s.nz);
        if (ray.ray.direction.dot(n) >= 0) continue;
        const plaszczyzna = new THREE.Plane().setFromNormalAndCoplanarPoint(n, new THREE.Vector3(s.x / 100, 0, s.z / 100));
        const pt = ray.ray.intersectPlane(plaszczyzna, new THREE.Vector3());
        if (!pt || pt.y < -0.2 || pt.y > H + 0.3) continue;
        const t = (pt.x * 100 - s.x) * s.dx + (pt.z * 100 - s.z) * s.dz;
        if (t < -40 || t > s.dlugosc + 40) continue;
        const d = pt.distanceTo(ray.ray.origin);
        if (!traf || d < traf.d) traf = { s, t, y: pt.y * 100, d };
      }
      if (!traf) return;
      const p = naScianie(pl, start, traf.s.id, traf.t, traf.y, pe.shiftKey ? 1 : 5);
      teraz = { i, p, bledy: sprawdzPunkt(pl, i, p) };
      setPodglad(teraz);
      invalidate();
    };
    const up = () => {
      sprzatanie.current?.();
      sprzatanie.current = null;
      if (controls) controls.enabled = true;
      setPodglad(null);
      invalidate();
      if (teraz.p.od === start.od && teraz.p.wys === start.wys && teraz.p.sciana === start.sciana) return;
      if (teraz.bledy.length) edycja.onBlad(teraz.bledy[0]);
      else edycja.onPunkt(i, teraz.p);
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
  return { podglad, zacznij };
}

export default function PunktyInstalacji({
  plan,
  edycja,
  onWybierz,
  onPodglad,
}: {
  plan: PlanKuchni;
  edycja?: EdycjaPunktow;
  onWybierz?: (i: number) => void;
  onPodglad?: (p: { i: number; p: PunktInstalacji } | null) => void;
}) {
  const { podglad, zacznij } = usePrzeciaganiePunktu(plan, edycja, onPodglad);
  const sciany = scianyPokoju(plan);
  const punkty = (plan.wywiad?.punkty ?? []).map((p, i) => (podglad?.i === i ? podglad.p : p));
  if (!punkty.length) return null;
  return (
    <group name="punkty-instalacji">
      {punkty.map((p, i) => {
        const s = sciany.find((w) => w.id === p.sciana);
        if (!s) return null;
        return (
          <PunktNaScianie
            key={i}
            s={s}
            p={p}
            zly={podglad?.i === i && podglad.bledy.length > 0}
            edycja={!!edycja}
            onPointerDown={edycja ? (e) => zacznij(e, i) : undefined}
            onClick={
              onWybierz
                ? (e) => {
                    if (e.delta > 4) return;
                    e.stopPropagation();
                    onWybierz(i);
                  }
                : undefined
            }
          />
        );
      })}
    </group>
  );
}
