"use client";

import dynamic from "next/dynamic";

// Scena działa tylko w przeglądarce (WebGL), więc bez renderu po stronie serwera.
const HeroScene = dynamic(() => import("./HeroScene"), { ssr: false, loading: () => null });

export default function HeroBackground() {
  return <HeroScene />;
}
