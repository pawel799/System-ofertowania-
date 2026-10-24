"use client";

import { Suspense, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import Szafka from "./Szafka";
import { MODUL_LIMITS, modulCena, type ModulCennik } from "@/lib/modul";
import { formatPln } from "../pricing";

type Param = { key: "szerokosc" | "wysokosc" | "glebokosc"; label: string; min: number; max: number };
const PARAMS: Param[] = [
  { key: "szerokosc", label: "Szerokość", ...MODUL_LIMITS.w },
  { key: "wysokosc", label: "Wysokość", ...MODUL_LIMITS.h },
  { key: "glebokosc", label: "Głębokość", ...MODUL_LIMITS.d },
];

export type ModulViewProps = {
  /** Wymiary startowe [cm]. */
  initial?: { w: number; h: number; d: number };
  /** Cennik firmy – cena liczona na bieżąco z wymiarów. */
  cennik?: ModulCennik | null;
  /** Stała cena (np. policzona przez serwer dla modułu z oferty). */
  price?: number;
  /** Tylko podgląd (wymiary z oferty, bez suwaków). */
  readOnly?: boolean;
  /** W okienku/ramce zamiast na cały ekran. */
  embedded?: boolean;
  title?: string;
  /** Dodatkowa treść pod ceną (np. przycisk „Poproś o wycenę”). */
  footer?: (dims: { w: number; h: number; d: number }) => ReactNode;
};

export default function ModulView({ initial, cennik, price, readOnly, embedded, title, footer }: ModulViewProps = {}) {
  const [v, setV] = useState({ szerokosc: initial?.w ?? 60, wysokosc: initial?.h ?? 72, glebokosc: initial?.d ?? 56 });
  const dims = { w: v.szerokosc, h: v.wysokosc, d: v.glebokosc };
  const cena = cennik ? modulCena(dims, cennik) : price;
  const set = (k: Param["key"], n: number, p: Param) =>
    setV((s) => ({ ...s, [k]: Number.isFinite(n) ? Math.min(p.max, Math.max(p.min, n)) : s[k] }));

  return (
    <div className={`flex ${embedded ? "h-full" : "h-[100dvh]"} flex-col bg-stone-100 text-stone-900 md:flex-row`}>
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
          <h1 className="text-lg font-semibold">{title ?? "Moduł parametryczny"}</h1>
          <p className="text-sm text-stone-600">Szafka dolna z płyty 18 mm. Obracaj widok palcem lub myszą.</p>
        </div>
        {readOnly ? (
          <p className="text-sm">
            {v.szerokosc} × {v.wysokosc} × {v.glebokosc} cm <span className="text-stone-500">(szer. × wys. × gł.)</span>
          </p>
        ) : null}
        {readOnly ? null : PARAMS.map((p) => (
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
        {cena !== undefined ? (
          <p className="flex items-baseline justify-between border-t border-stone-200 pt-3">
            <span className="text-sm text-stone-600">Cena modułu netto</span>
            <span className="text-xl font-semibold" data-testid="modul-cena">{formatPln(cena)}</span>
          </p>
        ) : null}
        {footer ? footer(dims) : null}
      </aside>
    </div>
  );
}
