"use client";

import dynamic from "next/dynamic";
import type { PublicModel } from "./modelRoles";

// Scena wgranego modelu działa tylko w przeglądarce (WebGL), więc bez SSR – jak KitchenGlbBackground.
const CustomModelScene = dynamic(() => import("./CustomModelScene"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-[#0c0b0a] text-xs uppercase tracking-[0.25em] text-stone-400">
      Wczytywanie sceny…
    </div>
  ),
});

export default function CustomModelBackground({ model }: { model: PublicModel }) {
  return <CustomModelScene model={model} />;
}
