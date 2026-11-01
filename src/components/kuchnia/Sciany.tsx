"use client";

/*
 * Ściany pokoju w 3D: A, B, C, D (src/lib/sciany.ts) z prawdziwymi otworami na okna i drzwi, w wybranym kolorze.
 * Każda ściana jest widoczna tylko od środka pokoju (płaszczyzny jednostronne), więc ściana między kamerą a meblami
 * znika sama – widać wnętrze jak w domku dla lalek. Przycisk „Ukryj ściany” chowa wszystkie (scianyStore.ts).
 */
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { scianyPokoju, segmentySciany, wysokoscOtworu, wysokoscPokoju, type ScianaPokoju } from "@/lib/sciany";
import type { PlanKuchni } from "@/lib/kuchnia";
import { useSciany } from "./scianyStore";

/** Kąt obrotu płaszczyzny (normalna +z) tak, żeby patrzyła do wnętrza pokoju. */
const OBROT: Record<ScianaPokoju, number> = { A: 0, B: Math.PI / 2, C: Math.PI, D: -Math.PI / 2 };

export default function Sciany({ plan, kolorDomyslny }: { plan: PlanKuchni; kolorDomyslny: string }) {
  const { widoczne, kolor } = useSciany();
  const H = wysokoscPokoju(plan);
  const sciany = scianyPokoju(plan);
  const otwory = plan.wywiad?.otwory ?? [];
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: kolor ?? kolorDomyslny, roughness: 0.92, side: THREE.FrontSide }), [kolor, kolorDomyslny]);
  const szyba = useMemo(() => new THREE.MeshStandardMaterial({ color: "#cfe3f5", roughness: 0.12, emissive: "#9ec4ea", emissiveIntensity: 0.3, transparent: true, opacity: 0.55, side: THREE.FrontSide }), []);
  const rama = useMemo(() => new THREE.MeshStandardMaterial({ color: "#eceae6", roughness: 0.5 }), []);
  const skrzydlo = useMemo(() => new THREE.MeshStandardMaterial({ color: "#8a6f55", roughness: 0.7, side: THREE.FrontSide }), []);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => [szyba, rama, skrzydlo].forEach((m) => m.dispose()), [szyba, rama, skrzydlo]);
  if (!widoczne) return null;

  return (
    <group name="sciany">
      {sciany.map((s) => {
        const naScianie = otwory.filter((o) => o.sciana === s.id);
        const segmenty = segmentySciany(s.dlugosc, H, naScianie);
        // Lokalny układ ściany: x wzdłuż ściany (od początku), y w górę; potem przesunięcie i obrót do świata.
        const poz = (a: number, y: number): [number, number, number] => [(s.x + s.dx * a) / 100, y / 100, (s.z + s.dz * a) / 100];
        return (
          <group key={s.id} name={`sciana-${s.id}`}>
            {segmenty.map((g, i) => (
              <mesh key={i} position={poz((g.a + g.b) / 2, (g.y0 + g.y1) / 2)} rotation={[0, OBROT[s.id], 0]} material={material} receiveShadow>
                <planeGeometry args={[(g.b - g.a) / 100, (g.y1 - g.y0) / 100]} />
              </mesh>
            ))}
            {naScianie.map((o, i) => {
              const { y0, y1 } = wysokoscOtworu(o, H);
              const srodek = poz(o.od + o.szer / 2, (y0 + y1) / 2);
              // Szyba i drzwi lekko w głąb ściany (od strony pokoju widać wnękę).
              const cofniecie: [number, number, number] = [srodek[0] - (s.nx * 6) / 100, srodek[1], srodek[2] - (s.nz * 6) / 100];
              return (
                <group key={`o${i}`}>
                  <mesh position={cofniecie} rotation={[0, OBROT[s.id], 0]} material={o.rodzaj === "okno" ? szyba : skrzydlo}>
                    <planeGeometry args={[o.szer / 100, (y1 - y0) / 100]} />
                  </mesh>
                  {o.rodzaj === "okno" ? (
                    <mesh position={[srodek[0] + (s.nx * 7) / 100, y0 / 100 - 0.015, srodek[2] + (s.nz * 7) / 100]} rotation={[0, OBROT[s.id], 0]} material={rama} receiveShadow>
                      <boxGeometry args={[o.szer / 100 + 0.06, 0.03, 0.14]} />
                    </mesh>
                  ) : null}
                </group>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}
