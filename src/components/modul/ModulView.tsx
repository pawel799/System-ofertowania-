"use client";

import { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import Szafka from "./Szafka";

type Param = { key: "szerokosc" | "wysokosc" | "glebokosc"; label: string; min: number; max: number };
const PARAMS: Param[] = [
  { key: "szerokosc", label: "Szerokość", min: 20, max: 120 },
  { key: "wysokosc", label: "Wysokość", min: 30, max: 220 },
  { key: "glebokosc", label: "Głębokość", min: 20, max: 70 },
];

export default function ModulView() {
  const [v, setV] = useState({ szerokosc: 60, wysokosc: 72, glebokosc: 56 });
  const set = (k: Param["key"], n: number, p: Param) =>
    setV((s) => ({ ...s, [k]: Number.isFinite(n) ? Math.min(p.max, Math.max(p.min, n)) : s[k] }));

  return (
    <div className="flex h-[100dvh] flex-col bg-stone-100 text-stone-900 md:flex-row">
      <div className="relative min-h-0 flex-1">
        <Canvas shadows dpr={[1, 2]} camera={{ position: [1.1, 0.9, 1.5], fov: 40 }}>
          <color attach="background" args={["#efece7"]} />
          <ambientLight intensity={0.35} />
          <directionalLight position={[2, 3, 2]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
          <Suspense fallback={null}>
            <Environment resolution={256} environmentIntensity={0.7}>
              <Lightformer intensity={2} position={[0, 4, 0]} rotation-x={Math.PI / 2} scale={[6, 6, 1]} />
              <Lightformer intensity={1} position={[-4, 1, 2]} rotation-y={Math.PI / 2} scale={[4, 3, 1]} />
              <Lightformer intensity={0.8} position={[4, 1, 3]} rotation-y={-Math.PI / 2} scale={[4, 3, 1]} />
            </Environment>
            <Szafka {...v} />
          </Suspense>
          <ContactShadows position={[0, 0, 0]} opacity={0.45} scale={4} blur={2.2} far={1.5} />
          <OrbitControls target={[0, v.wysokosc / 200, 0]} enablePan={false} minDistance={0.6} maxDistance={5} maxPolarAngle={Math.PI / 2 - 0.05} makeDefault />
        </Canvas>
      </div>
      <aside className="shrink-0 space-y-4 border-t border-stone-300 bg-white p-4 md:w-80 md:border-l md:border-t-0">
        <div>
          <h1 className="text-lg font-semibold">Moduł parametryczny</h1>
          <p className="text-sm text-stone-600">Szafka dolna z płyty 18 mm. Obracaj widok palcem lub myszą.</p>
        </div>
        {PARAMS.map((p) => (
          <label key={p.key} className="block">
            <span className="flex items-center justify-between text-sm font-medium">
              {p.label}
              <span className="flex items-center gap-1">
                <input
                  type="number"
                  inputMode="numeric"
                  className="w-16 rounded border border-stone-300 px-2 py-1 text-right"
                  min={p.min}
                  max={p.max}
                  value={v[p.key]}
                  onChange={(e) => set(p.key, parseFloat(e.target.value), p)}
                />
                cm
              </span>
            </span>
            <input
              type="range"
              className="mt-1 w-full accent-stone-700"
              min={p.min}
              max={p.max}
              value={v[p.key]}
              onChange={(e) => set(p.key, parseFloat(e.target.value), p)}
            />
          </label>
        ))}
      </aside>
    </div>
  );
}
