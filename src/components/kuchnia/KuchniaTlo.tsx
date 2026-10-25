"use client";

import dynamic from "next/dynamic";
import type { PlanKuchni } from "@/lib/kuchnia";
import type { PublicModel } from "../modelRoles";
import type { KuchniaUjecie } from "./KuchniaScena";

export type { KuchniaUjecie };

const Scena = dynamic(() => import("./KuchniaScena"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center bg-[#141311] text-xs uppercase tracking-[0.2em] text-stone-400">
      Wczytywanie kuchni…
    </div>
  ),
});

export default function KuchniaTlo({
  className,
  ...props
}: {
  plan: PlanKuchni;
  modele?: PublicModel[];
  zaznaczony?: string | null;
  onWybierz?: (id: string) => void;
  zdjecie?: boolean;
  onUjecie?: (u: KuchniaUjecie | null) => void;
  className?: string;
}) {
  return (
    <div className={className ?? "absolute inset-0"}>
      <Scena {...props} />
    </div>
  );
}
