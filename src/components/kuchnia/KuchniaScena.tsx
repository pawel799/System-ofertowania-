"use client";

import { Component, Suspense, useEffect, useLayoutEffect, useMemo, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls, useGLTF } from "@react-three/drei";
import { Box3, PerspectiveCamera, Vector3 } from "three";
import Szafka from "../modul/Szafka";
import { rect, type ElementKuchni, type PlanKuchni } from "@/lib/kuchnia";
import { applyRoles, lookFor, type PublicModel } from "../modelRoles";
import { useCountertop } from "../countertopStore";
import { useFront } from "../frontStore";
import { useHardware } from "../hardwareStore";
import { usePalettes } from "../paletteStore";

export type KuchniaUjecie = { jpeg: () => string | null };

const BLAT: Record<string, string> = {
  "kwarcyt-calacatta": "#ece8e1",
  "granit-absolute-black": "#1a1a1c",
  "laminat-dab": "#b48a5e",
};

/** Dół szafek górnych nad blatem [m]. */
const Y_GORNA = 1.45;

type Props = {
  plan: PlanKuchni;
  modele?: PublicModel[];
  zaznaczony?: string | null;
  onWybierz?: (id: string) => void;
  /** Bufor rysowania zostaje, żeby dało się zrobić zrzut do PDF. */
  zdjecie?: boolean;
  onUjecie?: (u: KuchniaUjecie | null) => void;
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
    y1 = Math.max(y1, (e.strefa === "gorna" ? 145 + e.h : e.h) / 100);
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

function ModelBryla({ model, w, h, d }: { model: PublicModel; w: number; h: number; d: number }) {
  const { scene } = useGLTF(model.url, true, true);
  const clone = useMemo(() => scene.clone(true), [scene]);
  const front = useFront();
  const countertop = useCountertop();
  const hardware = useHardware();
  const palettes = usePalettes();
  useLayoutEffect(() => {
    clone.scale.set(1, 1, 1);
    clone.position.set(0, 0, 0);
    clone.updateMatrixWorld(true);
    const box = new Box3().setFromObject(clone);
    const size = box.getSize(new Vector3());
    clone.scale.set((w / 100) / Math.max(size.x, 0.001), (h / 100) / Math.max(size.y, 0.001), (d / 100) / Math.max(size.z, 0.001));
    clone.updateMatrixWorld(true);
    const box2 = new Box3().setFromObject(clone);
    const c = box2.getCenter(new Vector3());
    clone.position.set(-c.x, -box2.min.y, -c.z);
  }, [clone, w, h, d]);
  useEffect(() => {
    return applyRoles(clone, model.tags, { front, countertop, hardware }, palettes);
  }, [clone, model, front, countertop, hardware, palettes]);
  return <primitive object={clone} />;
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

function SzafkaElementu({
  el,
  kolor,
  chropowatosc,
  blat,
  uchwyt,
}: {
  el: ElementKuchni;
  kolor: string;
  chropowatosc: number;
  blat: string;
  uchwyt: boolean;
}) {
  const H = el.h / 100;
  return (
    <>
      <Szafka szerokosc={el.w} wysokosc={el.h} glebokosc={el.d} kolorFrontu={kolor} chropowatosc={chropowatosc} pokazUchwyt={uchwyt} />
      {el.strefa === "dolna" ? (
        <mesh position={[0, H + 0.016, 0.01]} castShadow receiveShadow>
          <boxGeometry args={[el.w / 100, 0.028, el.d / 100 + 0.02]} />
          <meshStandardMaterial color={blat} roughness={0.45} />
        </mesh>
      ) : null}
    </>
  );
}

function ElementWidok({
  el,
  model,
  zaznaczony,
  kolor,
  chropowatosc,
  blat,
  uchwyt,
  onWybierz,
}: {
  el: ElementKuchni;
  model?: PublicModel;
  zaznaczony: boolean;
  kolor: string;
  chropowatosc: number;
  blat: string;
  uchwyt: boolean;
  onWybierz?: (id: string) => void;
}) {
  const y = el.strefa === "gorna" ? Y_GORNA : 0;
  const szafka = <SzafkaElementu el={el} kolor={kolor} chropowatosc={chropowatosc} blat={blat} uchwyt={uchwyt} />;
  return (
    <group
      position={[el.x / 100, y, el.z / 100]}
      rotation={[0, (el.rot * Math.PI) / 180, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onWybierz?.(el.id);
      }}
    >
      {model ? (
        <BladModelu fallback={szafka}>
          <Suspense fallback={szafka}>
            <ModelBryla model={model} w={el.w} h={el.h} d={el.d} />
          </Suspense>
        </BladModelu>
      ) : (
        szafka
      )}
      {zaznaczony ? (
        <mesh position={[0, el.h / 200, 0]}>
          <boxGeometry args={[el.w / 100 + 0.02, el.h / 100 + 0.02, el.d / 100 + 0.02]} />
          <meshBasicMaterial color="#7c98ff" wireframe />
        </mesh>
      ) : null}
    </group>
  );
}

function Wnetrze({ plan, modele = [], zaznaczony, onWybierz, zdjecie, onUjecie }: Props) {
  const front = useFront();
  const countertop = useCountertop();
  const hardware = useHardware();
  const palettes = usePalettes();
  const invalidate = useThree((s) => s.invalidate);
  const wybor = { front, countertop, hardware };
  const wyglad = lookFor("front", wybor, palettes);
  const blatLook = lookFor("blat", wybor, palettes);
  const kolor = wyglad.color ?? "#c9bcaa";
  const blat = blatLook.color ?? BLAT[countertop] ?? "#ece8e1";
  const uchwyt = hardware !== "push-to-open";
  const katalog = useMemo(() => new Map(modele.map((m) => [m.id, m])), [modele]);
  const { x0, x1, z0, z1 } = zakres(plan);

  useEffect(() => {
    invalidate();
  }, [invalidate, plan, front, countertop, hardware, palettes, zaznaczony]);

  return (
    <>
      <color attach="background" args={["#141311"]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[4, 6, 3]} intensity={1.7} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-3, 3, -2]} intensity={0.35} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(x0 + x1) / 2, 0, (z0 + z1) / 2]} receiveShadow>
        <planeGeometry args={[Math.max(1.2, x1 - x0 + 1.4), Math.max(1.2, z1 - z0 + 1.4)]} />
        <meshStandardMaterial color="#2a2622" roughness={0.95} />
      </mesh>
      <mesh position={[plan.scianaA / 200, 1.25, -0.01]}>
        <planeGeometry args={[plan.scianaA / 100, 2.5]} />
        <meshStandardMaterial color="#3a342e" roughness={0.9} />
      </mesh>
      {plan.uklad === "L" ? (
        <mesh position={[-0.01, 1.25, plan.scianaB / 200]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[plan.scianaB / 100, 2.5]} />
          <meshStandardMaterial color="#3a342e" roughness={0.9} />
        </mesh>
      ) : null}
      <Suspense fallback={null}>
        {plan.elementy.map((el) => (
          <ElementWidok
            key={el.id}
            el={el}
            model={el.modelId ? katalog.get(el.modelId) : undefined}
            zaznaczony={zaznaczony === el.id}
            kolor={kolor}
            chropowatosc={wyglad.roughness}
            blat={blat}
            uchwyt={uchwyt}
            onWybierz={onWybierz}
          />
        ))}
      </Suspense>
      <ContactShadows position={[0, 0.001, 0]} opacity={0.35} scale={12} blur={2.4} far={2} />
      <Kamera plan={plan} />
      <Ujecie aktywne={!!zdjecie} onUjecie={onUjecie} />
      <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 - 0.04} minDistance={0.6} maxDistance={14} />
    </>
  );
}

export default function KuchniaScena(props: Props) {
  return (
    <div className="absolute inset-0 h-full w-full bg-[#141311]">
      <Canvas
        shadows
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{ position: [2.4, 1.8, 3.2], fov: 42 }}
        gl={{ antialias: true, preserveDrawingBuffer: !!props.zdjecie }}
      >
        <Wnetrze {...props} />
      </Canvas>
    </div>
  );
}
