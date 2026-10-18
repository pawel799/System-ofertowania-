"use client";

import dynamic from "next/dynamic";

// Scena 3D działa tylko w przeglądarce (WebGL), więc wyłączamy dla niej SSR.
const KitchenGlbScene = dynamic(() => import("./KitchenGlbScene"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-[#0c0b0a] text-xs uppercase tracking-[0.25em] text-stone-400">
      Wczytywanie sceny…
    </div>
  ),
});

export default function KitchenGlbBackground() {
  return <KitchenGlbScene />;
}
