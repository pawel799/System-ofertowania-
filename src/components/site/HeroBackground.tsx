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

/* Tło hero. Gdy hero zjedzie z ekranu (sekcje niżej), scena przestaje się renderować. */
export default function HeroBackground() {
  const box = useRef<HTMLDivElement>(null);
  const [offscreen, setOffscreen] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOffscreen(!e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={box} className="h-full w-full">
      <SceneBoundary>
        <HeroScene offscreen={offscreen} />
      </SceneBoundary>
    </div>
  );
}
