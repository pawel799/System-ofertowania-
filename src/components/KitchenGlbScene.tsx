"use client";

import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  Html,
  OrbitControls,
  PerformanceMonitor,
  useGLTF,
} from "@react-three/drei";
import {
  Bloom,
  EffectComposer,
  N8AO,
  SMAA,
  ToneMapping,
  Vignette,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { Box3, MathUtils, PerspectiveCamera, Vector3 } from "three";
import { prepareKitchenModel } from "./kitchenMaterials";
import { installFrontSwap } from "./frontMaterials";
import { installCountertopSwap } from "./countertopMaterials";
import { installHardwareSwap } from "./hardwareMaterials";

const MODEL_URL = "/models/kitchen-opt.glb";

const MODEL_BYTES_FALLBACK = 18_440_100;

const HDRI_URL = "/hdri/lebombo_2k.hdr";

/* ---------- Ustawienia wyglądu ---------- */

const EXPOSURE = 1.15; // jasność całego obrazu
const ENV_INTENSITY = 0.9; // siła światła z panoramy HDR
const SUN_INTENSITY = 2.2; // siła światła „z okna” (rzuca cienie)


// Pokój ma ok. 6,1 m (x) × 5,9 m (z) × 3,1 m wysokości.
const CAMERA_START = new Vector3(0.3, 2.45, 2.85);
const CAMERA_TARGET = new Vector3(-0.6, 0.95, -1.15);

const ROOM_MIN = new Vector3(-1.6, 1.4, -1.2);
const ROOM_MAX = new Vector3(1.8, 2.95, 2.85);
// Na szerokim ekranie przesuwamy obraz w lewo, bo prawą stronę zasłania panel.
const LENS_SHIFT = 0.1;

/* ---------- Postęp pobierania modelu (w bajtach, nie w liczbie plików) ---------- */

let downloadProgress = 0;
const progressListeners = new Set<() => void>();

function setDownloadProgress(value: number) {
  downloadProgress = value;
  progressListeners.forEach((listener) => listener());
}

function subscribeProgress(listener: () => void) {
  progressListeners.add(listener);
  return () => {
    progressListeners.delete(listener);
  };
}

type ExtendLoader = NonNullable<Parameters<typeof useGLTF.preload>[3]>;

// Podpina się pod loader GLTF, żeby dostać zdarzenia "progress" z pobierania.
const trackDownloadProgress: ExtendLoader = (loader) => {
  const patched = loader as typeof loader & { __progressPatched?: boolean };
  if (patched.__progressPatched) return;
  patched.__progressPatched = true;

  const originalLoad = patched.load.bind(patched);
  patched.load = (url, onLoad, onProgress, onError) =>
    originalLoad(
      url,
      onLoad,
      (event) => {
        if (String(url).includes(MODEL_URL)) {
          const total = event.total || MODEL_BYTES_FALLBACK;
          setDownloadProgress(Math.min(1, event.loaded / total));
        }
        onProgress?.(event);
      },
      onError,
    );
};

// Startujemy pobieranie od razu po załadowaniu tego modułu.
// Drugi argument (true) = dekoder Draco, trzeci (true) = dekoder meshopt.
useGLTF.preload(MODEL_URL, true, true, trackDownloadProgress);

function Loader() {
  const progress = useSyncExternalStore(
    subscribeProgress,
    () => downloadProgress,
    () => 0,
  );
  const percent = Math.floor(progress * 100);

  return (
    <Html center>
      <div className="whitespace-nowrap text-center text-xs uppercase tracking-[0.25em] text-stone-300">
        {percent < 100
          ? `Wczytywanie modelu… ${percent}%`
          : "Przygotowywanie sceny…"}
        <div className="mx-auto mt-3 h-px w-48 bg-white/15">
          <div
            className="h-px bg-stone-200 transition-[width] duration-200"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </Html>
  );
}

/* ---------- Model + kamera ---------- */

function KitchenModel({
  onOrbitStart,
  onOrbitEnd,
}: {
  onOrbitStart: () => void;
  onOrbitEnd: () => void;
}) {
  const { scene } = useGLTF(MODEL_URL, true, true, trackDownloadProgress);
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);

  // Środek modelu w poziomie trafia w (0, 0), podłoga na y = 0.
  const offset = useMemo(() => {
    prepareKitchenModel(scene);
    const box = new Box3().setFromObject(scene);
    const center = box.getCenter(new Vector3());
    return [-center.x, -box.min.y, -center.z] as [number, number, number];
  }, [scene]);

  // Mapa cieni jest „zamrożona” (autoUpdate = false), a klatki rysują się
  // na żądanie (frameloop="demand"), więc po zmianie materiału prosimy o jedno i drugie.
  const refreshAfterSwap = useCallback(() => {
    gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [gl, invalidate]);

  // Fronty: podmiana materiału po wyborze próbki w MaterialsPanel.
  useEffect(
    () => installFrontSwap(scene, refreshAfterSwap),
    [scene, refreshAfterSwap],
  );

  // Blat: to samo dla materiału "Countertop".
  useEffect(
    () => installCountertopSwap(scene, refreshAfterSwap),
    [scene, refreshAfterSwap],
  );

  // Okucia: zadziała, gdy uchwyty będą w modelu osobną bryłą (patrz hardwareMaterials).
  useEffect(
    () => installHardwareSwap(scene, refreshAfterSwap),
    [scene, refreshAfterSwap],
  );

  useLayoutEffect(() => {
    camera.position.copy(CAMERA_START);
    camera.lookAt(CAMERA_TARGET);
  }, [camera]);

  // Meble i światło stoją w miejscu, więc mapa cieni wystarczy raz – bez tego
  // cały model renderuje się po raz drugi (do mapy 2048²) w każdej klatce.
  useLayoutEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
  }, [gl, scene]);

  // Model to wnętrze z dwustronnymi ścianami, więc kamera musi zostać w pokoju.
  useFrame(() => {
    camera.position.clamp(ROOM_MIN, ROOM_MAX);
  });

  return (
    <>
      <group position={offset}>
        <primitive object={scene} />
      </group>
      <OrbitControls
        makeDefault
        target={CAMERA_TARGET}
        onStart={onOrbitStart}
        onEnd={onOrbitEnd}
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        rotateSpeed={0.6}
        zoomSpeed={0.8}
        minDistance={1.2}
        maxDistance={5.2}
        minPolarAngle={0.85}
        maxPolarAngle={1.5}
        minAzimuthAngle={-0.55}
        maxAzimuthAngle={0.75}
      />
    </>
  );
}


function LensShift({ enabled = true }: { enabled?: boolean }) {
  const camera = useThree((state) => state.camera);
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);

  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const aspect = width / height;
    const shift = enabled && width >= 1024 && aspect > 1 ? LENS_SHIFT : 0;
    const viewWidth = 2 * Math.tan(MathUtils.degToRad(camera.fov / 2)) * aspect;
    camera.filmOffset = shift * camera.getFilmWidth() * viewWidth;
    camera.updateProjectionMatrix();
  }, [camera, width, height, enabled]);

  return null;
}

/* ---------- Światło ---------- */

// Przy frameloop="demand" klatka powstaje po zmianie w scenie Reacta.
// Panorama HDR podmienia oświetlenie poza Reactem, więc po jej doczytaniu
// prosimy o klatkę sami – inaczej światło pojawiłoby się dopiero po ruchu myszą.
function RequestFrame() {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    invalidate();
  }, [invalidate]);

  return null;
}

function Lights() {
  return (
    <>
      {/* „Okno” z przodu po prawej (tam, gdzie okno w panoramie HDR). */}
      <directionalLight
        position={[3.4, 5, 3.6]}
        intensity={SUN_INTENSITY}
        color="#fff4e6"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-radius={4}
        shadow-camera-left={-4.5}
        shadow-camera-right={4.5}
        shadow-camera-top={4.5}
        shadow-camera-bottom={-4.5}
        shadow-camera-near={0.5}
        shadow-camera-far={16}
      />
      {/* Osobny Suspense: panorama HDR nie blokuje pokazania modelu. */}
      <Suspense fallback={null}>
        <Environment files={HDRI_URL} environmentIntensity={ENV_INTENSITY} />
        <RequestFrame />
      </Suspense>
    </>
  );
}

/* ---------- Efekty końcowe ---------- */

function Effects({ lowQuality }: { lowQuality: boolean }) {
  return (
    <EffectComposer multisampling={0}>
      {/* Cienie kontaktowe w zagłębieniach i narożnikach (promień w metrach). */}
      <N8AO
        aoRadius={0.45}
        distanceFalloff={0.6}
        intensity={2}
        quality={lowQuality ? "low" : "medium"}
        halfRes={lowQuality}
      />
      <Bloom luminanceThreshold={1.1} intensity={0.25} mipmapBlur />
      <Vignette offset={0.3} darkness={0.45} />
      <SMAA />
      {/* Mapowanie tonów zawsze na końcu (komponent wyłącza je w rendererze). */}
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
    </EffectComposer>
  );
}

// Gdy model się nie wczyta (np. brak pliku), pokazujemy komunikat zamiast pustej strony.
class SceneErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-[0.25em] text-stone-500">
          Nie udało się wczytać modelu 3D
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * embedded = true: scena wypełnia rodzica (np. podgląd w panelu ofert)
 * zamiast całego okna i nie przesuwa obrazu pod panel boczny.
 */
export default function KitchenGlbScene({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  // Gdy komputer nie wyrabia, zmniejszamy rozdzielczość i jakość AO.
  const [lowQuality, setLowQuality] = useState(false);
  // Licznik FPS ma sens tylko wtedy, gdy klatki faktycznie lecą, czyli podczas
  // obracania i przybliżania. W bezruchu scena nic nie rysuje (frameloop="demand").
  const [orbiting, setOrbiting] = useState(false);

  return (
    <div
      className={
        embedded
          ? "absolute inset-0 h-full w-full bg-[#0c0b0a]"
          : "absolute inset-0 h-full w-full bg-[#0c0b0a]"
      }
    >
      <SceneErrorBoundary>
        {/* frameloop="demand": nowa klatka tylko przy zmianie (ruch kamery,
            doczytanie modelu), a nie 60 razy na sekundę w bezruchu. */}
        <Canvas
          frameloop="demand"
          shadows="percentage"
          dpr={lowQuality ? 1 : [1, 1.5]}
          gl={{ antialias: false, toneMappingExposure: EXPOSURE }}
          camera={{ position: [3, 2.2, 3], fov: 50, near: 0.05, far: 60 }}
        >
          <color attach="background" args={["#0c0b0a"]} />
          {orbiting && (
            <PerformanceMonitor
              onDecline={() => setLowQuality(true)}
              onIncline={() => setLowQuality(false)}
              flipflops={3}
              onFallback={() => setLowQuality(true)}
            />
          )}
          <LensShift enabled={!embedded} />
          <Suspense fallback={<Loader />}>
            <KitchenModel
              onOrbitStart={() => setOrbiting(true)}
              onOrbitEnd={() => setOrbiting(false)}
            />
          </Suspense>
          <Lights />
          <Effects lowQuality={lowQuality} />
        </Canvas>
      </SceneErrorBoundary>
    </div>
  );
}
