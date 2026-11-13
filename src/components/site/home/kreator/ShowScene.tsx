"use client";

/*
 * Scena 3D pokazu kreatora. Wszystko sterowane postępem pokazu (progress.ts), bez stanu Reacta:
 *  - formatki zlatują się i składają w trzy szafki, gdy kursor je dodaje,
 *  - w fazie rozkroju te same formatki lecą łukiem na arkusze płyt leżące na podłodze,
 *  - w fazie materiałów pokazujemy prawdziwy model kuchni i zmieniamy mu fronty
 *    (jeśli model się nie wczyta – formatki wracają do szafek i zmieniają kolor frontów).
 * frameloop="demand": klatka rysuje się tylko, gdy zmieni się przewinięcie.
 */
import { Component, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, useGLTF } from "@react-three/drei";
import { Box3, Color, Group, Matrix4, Mesh, MeshStandardMaterial, PerspectiveCamera, Quaternion, Vector3 } from "three";
import { FRONTS } from "@/components/catalog";
import { prepareKitchenModel } from "@/components/kitchenMaterials";
import { installFrontSwap } from "@/components/frontMaterials";
import { setFront } from "@/components/frontStore";
import { preloadKitchenModel, useKitchenModelUrl } from "@/lib/protectedModel";
import { DRACO } from "@/lib/draco";
import { ADD_AT, PIECES, SHEETS, easeInOut, easeOut, frontAt, span, type Piece } from "./demoData";
import { getProgress, subscribeProgress } from "./progress";

const LS = 0.3; // skala rozkładu arkuszy na podłodze
const LAY_CENTER = new Vector3(0, 0.002, 0.25);
const KITCHEN_AT = 0.585; // od tego miejsca pokazujemy prawdziwą kuchnię (gdy jest gotowa)

const COLORS: Record<Piece["material"], string> = {
  korpus: "#ece7df",
  front: "#b8875a",
  hdf: "#a88b6a",
  szuflady: "#d9d2c6",
};
const frontColor = (id: string) => FRONTS.find((f) => f.id === id)?.color ?? "#b8875a";

/* ---------- Kamera: klatki kluczowe po przewinięciu ---------- */

type Cam = { p: number; pos: [number, number, number]; look: [number, number, number] };
const CAM_PARTS: Cam[] = [
  { p: 0, pos: [2.4, 1.7, 2.9], look: [0, 0.75, 0] },
  { p: 0.18, pos: [1.7, 1.35, 2.3], look: [0, 0.8, 0] },
  { p: 0.34, pos: [-1.5, 1.5, 2.3], look: [0, 0.75, 0] },
  { p: 0.47, pos: [0.1, 3.1, 1.35], look: [0, 0, 0.22] },
  { p: 0.58, pos: [0.05, 2.9, 1.25], look: [0, 0, 0.22] },
  { p: 0.7, pos: [1.9, 1.5, 2.4], look: [0, 0.8, 0] },
  { p: 1, pos: [2.2, 1.6, 2.7], look: [0, 0.8, 0] },
];
// Kuchnia: kamera jak w hero, obrót wokół wnętrza sterowany przewinięciem.
const K_START = new Vector3(0.3, 2.45, 2.85);
const K_TARGET = new Vector3(-0.6, 0.95, -1.15);
const K_OFFSET = K_START.clone().sub(K_TARGET);
const Y = new Vector3(0, 1, 0);

const va = new Vector3();
const vb = new Vector3();
function cameraAt(p: number, out: { pos: Vector3; look: Vector3 }) {
  let i = 0;
  while (i < CAM_PARTS.length - 2 && p > CAM_PARTS[i + 1].p) i++;
  const a = CAM_PARTS[i];
  const b = CAM_PARTS[i + 1];
  const t = easeInOut(span(p, a.p, b.p));
  out.pos.copy(va.fromArray(a.pos)).lerp(vb.fromArray(b.pos), t);
  out.look.copy(va.fromArray(a.look)).lerp(vb.fromArray(b.look), t);
}

/* ---------- Formatki ---------- */

const qOf = (basis: Piece["assembled"]["basis"]) =>
  new Quaternion().setFromRotationMatrix(
    new Matrix4().makeBasis(new Vector3(...basis[0]), new Vector3(...basis[1]), new Vector3(...basis[2])),
  );
const Q_FLAT = new Quaternion();
const Q_ROT = new Quaternion().setFromAxisAngle(Y, Math.PI / 2);

type Prepared = {
  piece: Piece;
  asm: Vector3;
  lay: Vector3;
  from: Vector3;
  qAsm: Quaternion;
  qLay: Quaternion;
  addAt: number;
  layAt: number;
};

function prepare(): Prepared[] {
  const n = PIECES.length;
  const perCab = [0, 0, 0];
  return PIECES.map((piece) => {
    const asm = new Vector3(...piece.assembled.pos);
    const lay = new Vector3(...piece.laid.pos).multiplyScalar(LS).add(LAY_CENTER);
    // Skąd formatka nadlatuje: z góry i od środka szafki na zewnątrz (deterministycznie, bez losowania).
    const k = perCab[piece.cabinet]++;
    const angle = (k * 2.39996) % (Math.PI * 2); // złoty kąt
    const from = asm.clone().add(new Vector3(Math.cos(angle) * 0.9, 1.1 + (k % 3) * 0.25, Math.sin(angle) * 0.9));
    return {
      piece,
      asm,
      lay,
      from,
      qAsm: qOf(piece.assembled.basis),
      qLay: piece.laid.rotated ? Q_ROT : Q_FLAT,
      // Kaskada nierówna: ważniejsze (duże) formatki pierwsze, odstępy maleją.
      addAt: ADD_AT[piece.cabinet] + Math.sqrt(k) * 0.006,
      layAt: 0.37 + Math.sqrt(piece.order / n) * 0.1,
    };
  });
}

const tmpQ = new Quaternion();
const spinQ = new Quaternion();
const tmpV = new Vector3();

function Pieces({ hidden }: { hidden: MutableRefObject<boolean> }) {
  const items = useMemo(prepare, []);
  const meshes = useRef<(Mesh | null)[]>([]);
  const group = useRef<Group>(null);
  const frontMat = useMemo(() => new MeshStandardMaterial({ color: COLORS.front, roughness: 0.55 }), []);
  const mats = useMemo(
    () => ({
      korpus: new MeshStandardMaterial({ color: COLORS.korpus, roughness: 0.7 }),
      front: frontMat,
      hdf: new MeshStandardMaterial({ color: COLORS.hdf, roughness: 0.85 }),
      szuflady: new MeshStandardMaterial({ color: COLORS.szuflady, roughness: 0.75 }),
    }),
    [frontMat],
  );
  const target = useMemo(() => new Color(), []);

  useFrame(() => {
    const p = getProgress();
    if (group.current) group.current.visible = !hidden.current;
    if (hidden.current) return;
    // Powrót do szafek, gdy prawdziwa kuchnia nie jest dostępna.
    const back = easeInOut(span(p, 0.58, 0.66));
    items.forEach((it, i) => {
      const m = meshes.current[i];
      if (!m) return;
      const tin = easeOut(span(p, it.addAt, it.addAt + 0.05));
      m.visible = tin > 0;
      if (!m.visible) return;
      const lay = easeInOut(span(p, it.layAt, it.layAt + 0.09)) * (1 - back);
      // Nadlot do szafki
      tmpV.copy(it.from).lerp(it.asm, tin);
      // Lot łukiem na arkusz
      if (lay > 0) {
        tmpV.lerp(it.lay, lay);
        tmpV.y += Math.sin(Math.PI * lay) * 0.55;
      }
      m.position.copy(tmpV);
      tmpQ.copy(it.qAsm).slerp(it.qLay, lay);
      if (tin < 1) tmpQ.multiply(spinQ.setFromAxisAngle(Y, (1 - tin) * 1.4));
      m.quaternion.copy(tmpQ);
      const s = 1 + (LS - 1) * lay;
      const pop = 0.92 + 0.08 * tin;
      m.scale.set(it.piece.size[0] * s * pop, it.piece.size[1] * Math.max(s, 0.6), it.piece.size[2] * s * pop);
    });
    frontMat.color.lerp(target.set(frontColor(frontAt(p))), 0.35);
  });

  return (
    <group ref={group}>
      {items.map((it, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshes.current[i] = el;
          }}
          material={mats[it.piece.material]}
          visible={false}
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
      ))}
    </group>
  );
}

function Sheets({ hidden }: { hidden: MutableRefObject<boolean> }) {
  const mat = useMemo(() => new MeshStandardMaterial({ color: "#57514a", roughness: 0.9, transparent: true, opacity: 0 }), []);
  const group = useRef<Group>(null);
  useFrame(() => {
    const p = getProgress();
    const o = span(p, 0.35, 0.42) * (1 - span(p, 0.58, 0.64));
    mat.opacity = o * 0.9;
    if (group.current) group.current.visible = o > 0 && !hidden.current;
  });
  return (
    <group ref={group} visible={false}>
      {SHEETS.map((s, i) => (
        <mesh
          key={i}
          material={mat}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[s.x * LS + LAY_CENTER.x + (s.w * LS) / 2, 0.001, s.z * LS + LAY_CENTER.z + (s.h * LS) / 2]}
        >
          <planeGeometry args={[s.w * LS, s.h * LS]} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------- Prawdziwa kuchnia (zaszyfrowany model) ---------- */

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Kitchen({ onReady, shown }: { onReady: () => void; shown: MutableRefObject<boolean> }) {
  const { scene } = useGLTF(useKitchenModelUrl(), DRACO, true);
  const invalidate = useThree((s) => s.invalidate);
  // Klon: oryginał może wisieć w scenie tła hero, a obiekt three.js ma jednego rodzica.
  const { clone, offset } = useMemo(() => {
    prepareKitchenModel(scene);
    const c = scene.clone(true);
    const box = new Box3().setFromObject(c);
    const center = box.getCenter(new Vector3());
    return { clone: c, offset: [-center.x, -box.min.y, -center.z] as [number, number, number] };
  }, [scene]);
  useLayoutEffect(() => installFrontSwap(clone, invalidate), [clone, invalidate]);
  useEffect(onReady, [onReady]);
  const group = useRef<Group>(null);
  useFrame(() => {
    if (group.current) group.current.visible = shown.current;
  });
  return (
    <group ref={group} position={offset} visible={false}>
      <primitive object={clone} />
    </group>
  );
}

/* ---------- Kamera i synchronizacja ---------- */

function Director({ kitchenReady, kitchenShown, piecesHidden }: {
  kitchenReady: boolean;
  kitchenShown: MutableRefObject<boolean>;
  piecesHidden: MutableRefObject<boolean>;
}) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  const size = useThree((s) => s.size);
  const cam = useMemo(() => ({ pos: new Vector3(), look: new Vector3() }), []);
  const lastFront = useRef("");
  const wide = size.width >= 1024;
  // Kamera dalej na pełnym ekranie, żeby całość mieściła się obok tekstu i makiety.
  const dist = wide ? 1.85 : 1.75;

  useEffect(() => subscribeProgress(() => invalidate()), [invalidate]);

  // Środek kadru przesunięty w wolne miejsce: na komputerze w prawo i w górę
  // (lewa strona to kroki, prawy dół to makieta), na telefonie w górę (dół to makieta).
  // Wnętrze kuchni wypełnia cały kadr, więc tam tylko lekko w prawo (bez przesunięcia w pionie).
  const offsetFor = useCallback(
    (kitchen: boolean) => {
      const { width: w, height: h } = size;
      if (kitchen) camera.setViewOffset(w, h, wide ? -0.06 * w : 0, 0, w, h);
      else camera.setViewOffset(w, h, wide ? -0.06 * w : 0, wide ? 0.1 * h : 0.14 * h, w, h);
      camera.updateProjectionMatrix();
    },
    [camera, size, wide],
  );
  const lastKitchen = useRef(false);
  useEffect(() => {
    offsetFor(lastKitchen.current);
    invalidate();
    return () => camera.clearViewOffset();
  }, [offsetFor, camera, invalidate]);

  useFrame(() => {
    const p = getProgress();
    const kitchen = kitchenReady && p >= KITCHEN_AT;
    if (kitchen !== lastKitchen.current) {
      lastKitchen.current = kitchen;
      offsetFor(kitchen);
    }
    kitchenShown.current = kitchen;
    piecesHidden.current = kitchen;
    if (kitchen) {
      const angle = (span(p, KITCHEN_AT, 1) - 0.5) * 0.7;
      camera.position.copy(K_TARGET).add(tmpV.copy(K_OFFSET).applyAxisAngle(Y, angle).multiplyScalar(wide ? 1 : 1.15));
      camera.lookAt(K_TARGET);
    } else {
      cameraAt(p, cam);
      camera.position.copy(cam.look).add(tmpV.copy(cam.pos).sub(cam.look).multiplyScalar(dist));
      camera.lookAt(cam.look);
    }
    const f = frontAt(p);
    if (f !== lastFront.current) {
      lastFront.current = f;
      setFront(f);
    }
  });
  return null;
}

export default function ShowScene({ loadKitchen, small, background = "#100f0d" }: { loadKitchen: boolean; small: boolean; background?: string }) {
  const [kitchenReady, setKitchenReady] = useState(false);
  const onReady = useCallback(() => setKitchenReady(true), []);
  const kitchenShown = useRef(false);
  const piecesHidden = useRef(false);

  useEffect(() => {
    if (loadKitchen) preloadKitchenModel().catch(() => undefined);
  }, [loadKitchen]);

  return (
    <Canvas
      frameloop="demand"
      dpr={small ? [1, 1.5] : [1, 2]}
      gl={{ antialias: true, toneMappingExposure: 1.1, powerPreference: "high-performance" }}
      camera={{ position: [2.4, 1.7, 2.9], fov: small ? 50 : 40, near: 0.05, far: 60 }}
    >
      <color attach="background" args={[background]} />
      <hemisphereLight args={["#fff6ea", "#2a2622", 1.1]} />
      <directionalLight position={[3, 5, 4]} intensity={2.4} color="#fff1e0" />
      <directionalLight position={[-4, 3, -2]} intensity={0.6} color="#c9d6ff" />
      <directionalLight position={[0.3, 6, 1.2]} intensity={1.3} color="#ffffff" />
      <Pieces hidden={piecesHidden} />
      <Sheets hidden={piecesHidden} />
      {loadKitchen ? (
        <Boundary>
          <Suspense fallback={null}>
            <Kitchen onReady={onReady} shown={kitchenShown} />
            <Environment files="/hdri/lebombo_2k.hdr" environmentIntensity={0.9} />
          </Suspense>
        </Boundary>
      ) : null}
      <Director kitchenReady={kitchenReady} kitchenShown={kitchenShown} piecesHidden={piecesHidden} />
    </Canvas>
  );
}

