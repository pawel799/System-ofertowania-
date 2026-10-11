"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

// Scena działa tylko w przeglądarce (WebGL), więc bez renderu po stronie serwera.
const HeroScene = dynamic(() => import("./HeroScene"), { ssr: false, loading: () => null });

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
      <HeroScene offscreen={offscreen} />
    </div>
  );
}
