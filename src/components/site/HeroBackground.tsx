"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";

// Scena działa tylko w przeglądarce (WebGL), więc bez renderu po stronie serwera.
const HeroScene = dynamic(() => import("./HeroScene"), { ssr: false, loading: () => null });

/*
 * Błąd sceny (model się nie pobrał, brak WebGL) nie może położyć całej strony:
 * wtedy tła po prostu nie ma, reszta działa.
 */
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Czy przeglądarka da kontekst WebGL (headless bez GPU, stare telefony, wyłączone 3D). */
function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/*
 * Tło hero. Pod spodem zawsze statyczny kadr (public/strona/hero-poster.webp) – widać go,
 * zanim model się wczyta, i zostaje, gdy WebGL nie działa albo scena się wysypie.
 * Gdy hero zjedzie z ekranu (sekcje niżej), scena przestaje się renderować.
 */
export default function HeroBackground() {
  const box = useRef<HTMLDivElement>(null);
  const [offscreen, setOffscreen] = useState(false);
  const [webgl, setWebgl] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setWebgl(hasWebGL());
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOffscreen(!e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={box} className="relative h-full w-full bg-[#0c0b0a]">
      {/* eslint-disable-next-line @next/next/no-img-element -- statyczny eksport: zwykły <img> */}
      <img src="/strona/hero-poster.webp" alt="" className="absolute inset-0 h-full w-full object-cover" />
      {webgl ? (
        <div className={`absolute inset-0 transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}>
          <SceneBoundary>
            <HeroScene offscreen={offscreen} onReady={() => setReady(true)} />
          </SceneBoundary>
        </div>
      ) : null}
    </div>
  );
}
