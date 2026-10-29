"use client";

import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls, useGLTF } from "@react-three/drei";
import { PerspectiveCamera, Vector3 } from "three";
import { rect, type ElementKuchni, type PlanKuchni } from "@/lib/kuchnia";
import { applyRoles, lookFor, type PublicModel } from "../modelRoles";
import { useCountertop } from "../countertopStore";
import { useFront } from "../frontStore";
import { useHardware } from "../hardwareStore";
import { usePalettes } from "../paletteStore";
import { useKatalog } from "../katalogStore";
import AgdBryla from "./AgdBryla";
import { yElementu } from "./uklad3d";
import Wymiary3D from "./Wymiary3D";
import { tloDlaKoloru, type TloSceny } from "../tloSceny";
import { dopasuj, Obrys, useUchwytModelu } from "./obrys";
import { useRuch } from "./MebelParametryczny";
import { przygotujRuchome, ustawOtwarcie } from "./ruchomeGlb";
import { otwarty, przelaczElement, useOtwarcie } from "./otwarcieStore";

export type KuchniaUjecie = { jpeg: () => string | null };

const BLAT: Record<string, string> = {
  "kwarcyt-calacatta": "#ece8e1",
  "granit-absolute-black": "#1a1a1c",
  "laminat-dab": "#b48a5e",
};

type Props = {
  plan: PlanKuchni;
  modele?: PublicModel[];
  zaznaczony?: string | null;
  onWybierz?: (id: string) => void;
  /** Bufor rysowania zostaje, żeby dało się zrobić zrzut do PDF. */
  zdjecie?: boolean;
  onUjecie?: (u: KuchniaUjecie | null) => void;
  /** Linie wymiarowe — tylko w kreatorze. */
  wymiary?: boolean;
};

function zakres(plan: PlanKuchni) {
  let x0 = 0;
  let x1 = plan.scianaA / 100;
  let z0 = 0;
  let z1 = (plan.uklad === "L" ? plan.scianaB : 90) / 100;
  let y1 = 1.2;
  if (plan.pomieszczenie) {
    x1 = Math.max(x1, plan.pomieszczenie.szer / 100);
    z1 = Math.max(z1, plan.pomieszczenie.dlug / 100);
  }
  for (const e of plan.elementy) {
    const r = rect(e);
    x0 = Math.min(x0, r.x0 / 100);
    x1 = Math.max(x1, r.x1 / 100);
    z0 = Math.min(z0, r.z0 / 100);
    z1 = Math.max(z1, r.z1 / 100);
    y1 = Math.max(y1, yElementu(e, plan) + e.h / 100);
  }
  return { x0, x1, z0, z1, y1 };
}

function Kamera({ plan }: { plan: PlanKuchni }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const controls = useThree((s) => s.controls) as { target: Vector3; update: () => void } | null;
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const invalidate = useThree((s) => s.invalidate);
  const sygnatura = `${plan.uklad}:${plan.scianaA}:${plan.scianaB}:${plan.pomieszczenie?.szer ?? 0}x${plan.pomieszczenie?.dlug ?? 0}:${plan.elementy.map((e) => e.id).join(",")}`;
  useLayoutEffect(() => {
    const { x0, x1, z0, z1, y1 } = zakres(plan);
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const target = new Vector3(cx, y1 * 0.38, cz);
    const radius = Math.max(x1 - x0, z1 - z0, y1, 1) * 0.62;
    const vHalf = (camera.fov * Math.PI) / 360;
    const half = aspect < 1 ? Math.atan(Math.tan(vHalf) * aspect) : vHalf;
    const dist = (radius / Math.sin(Math.max(0.2, half))) * 0.92;
    camera.position.set(cx + dist * 0.62, target.y + dist * 0.48, cz + dist * 0.78);
    camera.near = 0.05;
    camera.far = dist * 20;
    camera.updateProjectionMatrix();
    camera.lookAt(target);
    if (controls) {
      controls.target.copy(target);
      controls.update();
    }
    invalidate();
    // Kadrowanie tylko po dodaniu albo usunięciu szafki, nie przy każdym przeciągnięciu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sygnatura, aspect, camera, controls, invalidate]);
  return null;
}

function Ujecie({ aktywne, onUjecie }: { aktywne: boolean; onUjecie?: (u: KuchniaUjecie | null) => void }) {
  const gl = useThree((s) => s.gl);
  const advance = useThree((s) => s.advance);
  useEffect(() => {
    if (!aktywne || !onUjecie) return;
    onUjecie({
      jpeg: () => {
        try {
          advance(performance.now(), true);
          return gl.domElement.toDataURL("image/jpeg", 0.72);
        } catch {
          return null;
        }
      },
    });
    return () => onUjecie(null);
  }, [aktywne, advance, gl, onUjecie]);
  return null;
}

function ModelBryla({ model, w, h, d, otwarte = false }: { model: PublicModel; w: number; h: number; d: number; otwarte?: boolean }) {
  const { scene } = useGLTF(model.url, true, true);
  // Kopia sceny w osobnym węźle: plik zostaje nietknięty, dopasowanie robi grupa nad nim.
  const uchwyt = useUchwytModelu(scene);
  // Drzwi, klapy, szuflady i drzwi przesuwne na pivotach (ruchomeGlb.ts) + aliasy ról dla kawałków uchwytów.
  const { ruchome, aliasy } = useMemo(() => przygotujRuchome(uchwyt, model.tags), [uchwyt, model.tags]);
  const postep = useRef(0);
  // Pudełko liczone w układzie modelu (nie świata) – patrz obrys.tsx. Zawsze przy zamkniętych frontach.
  const fit = useMemo(() => {
    ustawOtwarcie(ruchome, 0);
    const f = dopasuj(uchwyt, w / 100, h / 100, d / 100);
    ustawOtwarcie(ruchome, postep.current);
    return f;
  }, [uchwyt, ruchome, w, h, d]);
  useRuch(otwarte, (p) => {
    postep.current = p;
    ustawOtwarcie(ruchome, p);
  });
  const tagi = useMemo(() => ({ ...model.tags, ...aliasy }), [model.tags, aliasy]);
  const invalidate = useThree((s) => s.invalidate);
  const front = useFront();
  const countertop = useCountertop();
  const hardware = useHardware();
  const palettes = usePalettes();
  const katalogMat = useKatalog();
  useEffect(() => {
    return applyRoles(uchwyt, tagi, { front, countertop, hardware }, palettes, katalogMat);
  }, [uchwyt, tagi, front, countertop, hardware, palettes, katalogMat]);
  useEffect(() => invalidate(), [fit, invalidate]);
  return (
    <group position={fit.position} scale={fit.scale}>
      <primitive object={uchwyt} />
    </group>
  );
}

class BladModelu extends Component<{ children: ReactNode; fallback: ReactNode }, { blad: boolean }> {
  state = { blad: false };
  static getDerivedStateFromError() {
    return { blad: true };
  }
  render() {
    return this.state.blad ? this.props.fallback : this.props.children;
  }
}

function ElementWidok({
  el,
  plan,
  model,
  zaznaczony,
  kolor,
  chropowatosc,
  blat,
  uchwyt,
  onWybierz,
  otwarte,
}: {
  el: ElementKuchni;
  plan: PlanKuchni;
  model?: PublicModel;
  zaznaczony: boolean;
  kolor: string;
  chropowatosc: number;
  blat: string;
  uchwyt: boolean;
  onWybierz?: (id: string) => void;
  otwarte: boolean;
}) {
  const y = yElementu(el, plan);
  const szafka = <AgdBryla el={el} kolor={kolor} chropowatosc={chropowatosc} blat={blat} uchwyt={uchwyt} otwarte={otwarte} />;
  return (
    <group
      position={[el.x / 100, y, el.z / 100]}
      rotation={[0, (el.rot * Math.PI) / 180, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onWybierz?.(el.id);
      }}
      onDoubleClick={(e) => {
        // Dwuklik otwiera albo zamyka ten jeden mebel (drzwi, szuflady).
        e.stopPropagation();
        przelaczElement(el.id);
      }}
    >
      <Obrys aktywny={zaznaczony}>
        {model ? (
          <BladModelu fallback={szafka}>
            <Suspense fallback={szafka}>
              <ModelBryla model={model} w={el.w} h={el.h} d={el.d} otwarte={otwarte} />
            </Suspense>
          </BladModelu>
        ) : (
          szafka
        )}
      </Obrys>
    </group>
  );
}

/** Okna (jasna szyba z ramą), drzwi (płyta drzwi) i przyłącze wody z kroku „Okna i instalacje”. */
function Otwory({ plan }: { plan: PlanKuchni }) {
  const wy = plan.wywiad;
  if (!wy) return null;
  const wys = Math.min(2.5, wy.wysokosc / 100);
  return (
    <group>
      {wy.otwory.map((o, i) => {
        const A = o.sciana === "A";
        const szer = o.szer / 100;
        const od = o.od / 100 + szer / 2;
        const y0 = o.rodzaj === "okno" ? (o.parapet ?? 90) / 100 : 0;
        // Okno do ok. 30 cm pod sufitem (max 140 cm wysokości), drzwi 205 cm.
        const hOkna = o.rodzaj === "okno" ? Math.max(0.4, Math.min(1.4, wys - 0.3 - y0)) : Math.min(2.05, wys - 0.1);
        const pos: [number, number, number] = A ? [od, y0 + hOkna / 2, 0.002] : [0.002, y0 + hOkna / 2, od];
        const rot: [number, number, number] = A ? [0, 0, 0] : [0, Math.PI / 2, 0];
        return (
          <group key={i} position={pos} rotation={rot}>
            <mesh>
              <planeGeometry args={[szer, hOkna]} />
              <meshStandardMaterial color={o.rodzaj === "okno" ? "#cfe3f5" : "#8a6f55"} roughness={o.rodzaj === "okno" ? 0.15 : 0.7} emissive={o.rodzaj === "okno" ? "#9ec4ea" : "#000000"} emissiveIntensity={o.rodzaj === "okno" ? 0.35 : 0} />
            </mesh>
            {o.rodzaj === "okno" ? (
              <mesh position={[0, -hOkna / 2 - 0.015, 0.06]}>
                <boxGeometry args={[szer + 0.08, 0.03, 0.14]} />
                <meshStandardMaterial color="#eceae6" roughness={0.5} />
              </mesh>
            ) : null}
          </group>
        );
      })}
      {wy.woda ? (
        <mesh position={wy.woda.sciana === "A" ? [wy.woda.od / 100, 0.5, 0.02] : [0.02, 0.5, wy.woda.od / 100]}>
          <sphereGeometry args={[0.025, 16, 12]} />
          <meshStandardMaterial color="#2f7fd1" roughness={0.3} />
        </mesh>
      ) : null}
    </group>
  );
}

function Wnetrze({ plan, modele = [], zaznaczony, onWybierz, zdjecie, onUjecie, wymiary, tlo }: Props & { tlo: TloSceny }) {
  const front = useFront();
  const countertop = useCountertop();
  const hardware = useHardware();
  const palettes = usePalettes();
  const katalogMat = useKatalog();
  const invalidate = useThree((s) => s.invalidate);
  const wybor = { front, countertop, hardware };
  const wyglad = lookFor("front", wybor, palettes, katalogMat);
  const blatLook = lookFor("blat", wybor, palettes, katalogMat);
  const kolor = wyglad.color ?? "#c9bcaa";
  const blat = blatLook.color ?? BLAT[countertop] ?? "#ece8e1";
  const uchwyt = !lookFor("uchwyt", wybor, palettes, katalogMat).hidden;
  const katalog = useMemo(() => new Map(modele.map((m) => [m.id, m])), [modele]);
  const otwarcie = useOtwarcie();
  const { x0, x1, z0, z1 } = zakres(plan);

  useEffect(() => {
    invalidate();
  }, [invalidate, plan, front, countertop, hardware, palettes, katalogMat, zaznaczony]);

  return (
    <>
      <color attach="background" args={[tlo.tlo]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[4, 6, 3]} intensity={1.7} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-3, 3, -2]} intensity={0.35} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(x0 + x1) / 2, 0, (z0 + z1) / 2]} receiveShadow>
        <planeGeometry args={[Math.max(1.2, x1 - x0 + 1.4), Math.max(1.2, z1 - z0 + 1.4)]} />
        <meshStandardMaterial color={tlo.podloga} roughness={0.95} />
      </mesh>
      <mesh position={[plan.scianaA / 200, 1.25, -0.01]}>
        <planeGeometry args={[plan.scianaA / 100, 2.5]} />
        <meshStandardMaterial color={tlo.sciana} roughness={0.9} />
      </mesh>
      {plan.uklad === "L" ? (
        <mesh position={[-0.01, 1.25, plan.scianaB / 200]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[plan.scianaB / 100, 2.5]} />
          <meshStandardMaterial color={tlo.sciana} roughness={0.9} />
        </mesh>
      ) : null}
      <Otwory plan={plan} />
      <Suspense fallback={null}>
        {plan.elementy.map((el) => (
          <ElementWidok
            key={el.id}
            el={el}
            plan={plan}
            model={el.modelId ? katalog.get(el.modelId) : undefined}
            zaznaczony={zaznaczony === el.id}
            kolor={kolor}
            chropowatosc={wyglad.roughness}
            blat={blat}
            uchwyt={uchwyt}
            onWybierz={onWybierz}
            otwarte={otwarty(otwarcie, el.id)}
          />
        ))}
      </Suspense>
      {wymiary ? <Wymiary3D plan={plan} zaznaczony={zaznaczony} /> : null}
      <ContactShadows position={[0, 0.001, 0]} opacity={0.35} scale={12} blur={2.4} far={2} />
      <Kamera plan={plan} />
      <Ujecie aktywne={!!zdjecie} onUjecie={onUjecie} />
      <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 - 0.04} minDistance={0.6} maxDistance={14} />
    </>
  );
}

/** Ciemne fronty → jasne tło sceny (tloSceny.ts); kolor frontu z tych samych magazynów co pasek materiałów. */
function useTloKuchni(): TloSceny {
  const front = useFront();
  const countertop = useCountertop();
  const hardware = useHardware();
  const palettes = usePalettes();
  const katalogMat = useKatalog();
  return tloDlaKoloru(lookFor("front", { front, countertop, hardware }, palettes, katalogMat).color ?? null);
}

export default function KuchniaScena(props: Props) {
  const tlo = useTloKuchni();
  return (
    <div className="absolute inset-0 h-full w-full" data-tlo={tlo.jasne ? "jasne" : "ciemne"} style={{ background: tlo.tlo }}>
      <Canvas
        shadows
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{ position: [2.4, 1.8, 3.2], fov: 42 }}
        gl={{ antialias: true, preserveDrawingBuffer: !!props.zdjecie }}
      >
        <Wnetrze {...props} tlo={tlo} />
      </Canvas>
    </div>
  );
}
