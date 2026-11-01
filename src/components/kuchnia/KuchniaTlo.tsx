"use client";

import dynamic from "next/dynamic";
import type { PlanKuchni } from "@/lib/kuchnia";
import type { PublicModel } from "../modelRoles";
import type { EdycjaMebli, KuchniaUjecie } from "./KuchniaScena";
import type { EdycjaOtworow } from "./Sciany";

export type { KuchniaUjecie };

const Scena = dynamic(() => import("./KuchniaScena"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center bg-tlo2 text-xs uppercase tracking-[0.2em] text-stone-400">
      Wczytywanie podglądu 3D…
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
  wymiary?: boolean;
  /** Kreator: przeciąganie okien i drzwi po ścianach w 3D. */
  edycjaOtworow?: EdycjaOtworow;
  /** Kreator (tylko wykonawca): przeciąganie mebli w 3D. */
  edycjaMebli?: EdycjaMebli;
  onPodgladMebla?: (p: { id: string; x: number; z: number; zly: string | null } | null) => void;
  className?: string;
}) {
  return (
    <div className={className ?? "absolute inset-0"}>
      <Scena {...props} />
    </div>
  );
}
