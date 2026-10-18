"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, useGLTF } from "@react-three/drei";
import { Box3, Timer, Vector3 } from "three";
import { prepareKitchenModel } from "../kitchenMaterials";

/*
 * Tło strony głównej: ta sama kuchnia co w ofercie, kamera sama powoli kołysze się
 * wokół wnętrza. Osobny, prostszy komponent (bez sterowania, cieni i efektów),
 * żeby nie ruszać sceny oferty (KitchenGlbScene). Pod nakładką 80% czerni detale i tak giną.
 * Wspólne z ofertą są tylko pliki (model, HDRI) i prepareKitchenModel, które działa raz na model.
 */

const MODEL_URL = "/models/kitchen-opt.glb"; // jak w KitchenGlbScene
const HDRI_URL = "/hdri/lebombo_2k.hdr";

const CAMERA_START = new Vector3(0.3, 2.45, 2.85);
const CAMERA_TARGET = new Vector3(-0.6, 0.95, -1.15);
const OFFSET = CAMERA_START.clone().sub(CAMERA_TARGET);
const Y_AXIS = new Vector3(0, 1, 0);
const SWAY = 0.24; // radiany w każdą stronę
const PERIOD = 40; // sekundy na pełne wahnięcie

function Kitchen({ still, onReady }: { still: boolean; onReady?: () => void }) {
  const { scene } = useGLTF(MODEL_URL, true, true);
  const camera = useThree((s) => s.camera);

  const offset = useMemo(() => {
    prepareKitchenModel(scene);
    const box = new Box3().setFromObject(scene);
    const center = box.getCenter(new Vector3());
    return [-center.x, -box.min.y, -center.z] as [number, number, number];
  }, [scene]);

  // Własny THREE.Timer zamiast przestarzałego THREE.Clock (zegar R3F wciąż go używa wewnętrznie).
  const timer = useMemo(() => new Timer(), []);
  useEffect(() => () => timer.dispose(), [timer]);
  const announced = useRef(false);

  useFrame(() => {
    timer.update();
    const angle = still ? 0 : Math.sin((timer.getElapsed() / PERIOD) * Math.PI * 2) * SWAY;
    camera.position.copy(CAMERA_TARGET).add(OFFSET.clone().applyAxisAngle(Y_AXIS, angle));
    camera.lookAt(CAMERA_TARGET);
    // Pierwsza klatka z modelem gotowa – tło może przejść z kadru statycznego na scenę.
    if (!announced.current) {
      announced.current = true;
      requestAnimationFrame(() => onReady?.());
    }
  });

  return (
    <group position={offset}>
      <primitive object={scene} />
    </group>
  );
}

export default function HeroScene({ offscreen = false, onReady }: { offscreen?: boolean; onReady?: () => void }) {
  // Ruch wyłączony przy prefers-reduced-motion, gdy karta jest w tle i gdy hero jest poza ekranem.
  const [still, setStill] = useState(false);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setStill(mq.matches);
    const vis = () => setVisible(document.visibilityState === "visible");
    sync();
    mq.addEventListener("change", sync);
    document.addEventListener("visibilitychange", vis);
    return () => {
      mq.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  return (
    <Canvas
      frameloop={still || !visible || offscreen ? "demand" : "always"}
      dpr={1}
      gl={{ antialias: true, toneMappingExposure: 1.15 }}
      camera={{ position: CAMERA_START.toArray(), fov: 50, near: 0.05, far: 60 }}
    >
      <color attach="background" args={["#0c0b0a"]} />
      <directionalLight position={[3.4, 5, 3.6]} intensity={2.2} color="#fff4e6" />
      <Suspense fallback={null}>
        <Kitchen still={still} onReady={onReady} />
        <Environment files={HDRI_URL} environmentIntensity={0.9} />
      </Suspense>
    </Canvas>
  );
}
