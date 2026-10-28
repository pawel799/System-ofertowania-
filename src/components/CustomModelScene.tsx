"use client";

import { Component, Suspense, useEffect, useLayoutEffect, useMemo, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Box3, PerspectiveCamera, Sphere, Vector3 } from "three";
import { useCountertop } from "./countertopStore";
import { useFront } from "./frontStore";
import { useHardware } from "./hardwareStore";
import { applyRoles, type PublicModel } from "./modelRoles";
import { usePalettes } from "./paletteStore";
import { useKatalog } from "./katalogStore";

/*
 * Scena wgranego modelu (oferta z własnym modelem zamiast kuchni demo).
 * Kamera sama ustawia się na całą bryłę, obrót wokół jej środka; kolory frontów,
 * blatu i uchwytów idą z tych samych magazynów co pasek materiałów (MaterialsPanel).
 */

const HDRI_URL = "/hdri/lebombo_2k.hdr";

function Loading() {
  return (
    <Html center>
      <div className="whitespace-nowrap text-xs uppercase tracking-[0.25em] text-stone-300">Wczytywanie modelu…</div>
    </Html>
  );
}

function Model({ model }: { model: PublicModel }) {
  // Drugi argument: dekoder Draco, trzeci: meshopt (pliki z panelu są skompresowane meshopt).
  const { scene } = useGLTF(model.url, true, true);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const controls = useThree((s) => s.controls) as unknown as { target: Vector3; update: () => void } | null;
  const front = useFront();
  const countertop = useCountertop();
  const hardware = useHardware();
  const palettes = usePalettes();
  const katalog = useKatalog();

  // Środek bryły w (0, 0, 0) w poziomie, podłoga na y = 0.
  const { offset, sphere, floor } = useMemo(() => {
    scene.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    const box = new Box3().setFromObject(scene);
    const center = box.getCenter(new Vector3());
    const s = box.getBoundingSphere(new Sphere());
    return {
      offset: [-center.x, -box.min.y, -center.z] as [number, number, number],
      sphere: { radius: s.radius || 1, height: box.max.y - box.min.y },
      floor: 0,
    };
  }, [scene]);

  // Kamera z przodu, lekko z góry i z boku; odległość tak, żeby cała bryła weszła w kadr.
  useLayoutEffect(() => {
    const r = sphere.radius;
    const target = new Vector3(0, sphere.height * 0.45, 0);
    // Na wąskim ekranie (telefon) o kadrze decyduje szerokość kadru, nie wysokość.
    const vHalf = (camera.fov * Math.PI) / 360;
    const half = aspect < 1 ? Math.atan(Math.tan(vHalf) * aspect) : vHalf;
    const dist = (r / Math.sin(half)) * 0.95;
    camera.position.copy(target).add(new Vector3(0.45, 0.35, 1).normalize().multiplyScalar(dist));
    camera.near = Math.max(0.01, r / 200);
    camera.far = r * 40;
    camera.updateProjectionMatrix();
    camera.lookAt(target);
    if (controls) {
      controls.target.copy(target);
      controls.update();
    }
    invalidate();
  }, [camera, controls, sphere, aspect, invalidate]);

  useEffect(() => {
    const undo = applyRoles(scene, model.tags, { front, countertop, hardware }, palettes, katalog);
    invalidate();
    return undo;
  }, [scene, model.tags, front, countertop, hardware, palettes, katalog, invalidate]);

  return (
    <>
      <group position={offset}>
        <primitive object={scene} />
      </group>
      <ContactShadows position={[0, floor + 0.001, 0]} scale={sphere.radius * 3} blur={2.4} opacity={0.55} far={sphere.height || 1} frames={1} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        rotateSpeed={0.6}
        minDistance={sphere.radius * 0.5}
        maxDistance={sphere.radius * 4}
        maxPolarAngle={Math.PI / 2 - 0.05}
      />
    </>
  );
}

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
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

export default function CustomModelScene({ model, embedded = false }: { model: PublicModel; embedded?: boolean }) {
  return (
    <div className={embedded ? "absolute inset-0 h-full w-full bg-[#0c0b0a]" : "absolute inset-0 h-full w-full bg-[#0c0b0a]"}>
      <Boundary>
        <Canvas
          frameloop="demand"
          shadows="percentage"
          dpr={[1, 1.5]}
          gl={{ antialias: true, toneMappingExposure: 1.1 }}
          camera={{ position: [3, 2, 3], fov: 45 }}
        >
          <color attach="background" args={["#0c0b0a"]} />
          <directionalLight position={[4, 6, 5]} intensity={2} color="#fff4e6" />
          <Suspense fallback={<Loading />}>
            <Model model={model} />
            <Environment files={HDRI_URL} environmentIntensity={0.9} />
          </Suspense>
        </Canvas>
      </Boundary>
    </div>
  );
}
