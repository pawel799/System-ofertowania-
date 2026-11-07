"use client";

/*
 * Ściany pokoju w 3D: A, B, C, D (src/lib/sciany.ts) z prawdziwymi otworami na okna i drzwi, w wybranym kolorze.
 * Każda ściana jest widoczna tylko od środka pokoju (płaszczyzny jednostronne), więc ściana między kamerą a meblami
 * znika sama – widać wnętrze jak w domku dla lalek. Przycisk „Ukryj ściany” chowa wszystkie (scianyStore.ts).
 *
 * Kreator (prop edycja): okno albo drzwi przeciąga się po ścianach – także na inną ścianę. Podgląd na czerwono,
 * gdy otwór nie może tam stać (sprawdzOtwor: poza ścianą, na innym otworze, w meblach); puszczony – wraca.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { KOLOR_SUFITU, scianyPokoju, segmentySciany, wysokoscOtworu, wysokoscPokoju, wysokoscSciany, zakresPokoju, type ScianaDodatkowa, type ScianaPokoju } from "@/lib/sciany";
import { otworWPunkcie, sprawdzOtwor, sprawdzScianeDodatkowa } from "@/lib/otwory";
import type { PlanKuchni } from "@/lib/kuchnia";
import type { Otwor } from "@/lib/wywiad";
import { useSciany } from "./scianyStore";
import PunktyInstalacji, { type EdycjaPunktow } from "./PunktyInstalacji";
import type { PunktInstalacji } from "@/lib/wywiad";

/** Kąt obrotu płaszczyzny (normalna +z) tak, żeby patrzyła do wnętrza pokoju. */
const OBROT: Record<ScianaPokoju, number> = { A: 0, B: Math.PI / 2, C: Math.PI, D: -Math.PI / 2 };

export type EdycjaOtworow = {
  onOtwor: (i: number, o: Otwor) => void;
  onBlad: (powod: string) => void;
  /** Gniazdka i inne punkty instalacji (PunktyInstalacji.tsx). */
  onPunkt?: EdycjaPunktow["onPunkt"];
  /** Dodatkowa ściana przesunięta w 3D (przeciąganie po podłodze). */
  onSciana?: (i: number, s: ScianaDodatkowa) => void;
};

type Podglad = { i: number; o: Otwor; bledy: string[] };

/** Przeciąganie otworu: promień spod kursora → najbliższa ściana zwrócona do kamery → położenie na niej. */
function usePrzeciaganieOtworu(plan: PlanKuchni, edycja?: EdycjaOtworow, onPodglad?: (p: { i: number; o: Otwor } | null) => void) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null;
  const invalidate = useThree((s) => s.invalidate);
  const [podglad, ustawPodglad] = useState<Podglad | null>(null);
  const setPodglad = (p: Podglad | null) => {
    ustawPodglad(p);
    onPodglad?.(p ? { i: p.i, o: p.o } : null);
  };
  const planRef = useRef(plan);
  planRef.current = plan;
  const sprzatanie = useRef<(() => void) | null>(null);
  useEffect(() => () => sprzatanie.current?.(), []);

  const zacznij = (e: ThreeEvent<PointerEvent>, i: number) => {
    if (!edycja || e.button !== 0) return;
    e.stopPropagation();
    const start = planRef.current.wywiad?.otwory[i];
    if (!start) return;
    if (controls) controls.enabled = false;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let teraz: Podglad = { i, o: start, bledy: [] };
    setPodglad(teraz);
    const move = (pe: PointerEvent) => {
      const r = gl.domElement.getBoundingClientRect();
      ndc.set(((pe.clientX - r.left) / r.width) * 2 - 1, -((pe.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const p = planRef.current;
      const H = wysokoscPokoju(p) / 100;
      let traf: { x: number; z: number; d: number } | null = null;
      for (const s of scianyPokoju(p)) {
        const n = new THREE.Vector3(s.nx, 0, s.nz);
        // Ściana odwrócona tyłem do kamery jest niewidoczna – nie łapiemy na niej.
        if (ray.ray.direction.dot(n) >= 0) continue;
        const plaszczyzna = new THREE.Plane().setFromNormalAndCoplanarPoint(n, new THREE.Vector3(s.x / 100, 0, s.z / 100));
        const pt = ray.ray.intersectPlane(plaszczyzna, new THREE.Vector3());
        if (!pt || pt.y < -0.2 || pt.y > H + 0.3) continue;
        const t = (pt.x * 100 - s.x) * s.dx + (pt.z * 100 - s.z) * s.dz;
        if (t < -40 || t > s.dlugosc + 40) continue;
        const d = pt.distanceTo(ray.ray.origin);
        if (!traf || d < traf.d) traf = { x: pt.x * 100, z: pt.z * 100, d };
      }
      if (!traf) return;
      const o = otworWPunkcie(p, start, traf.x, traf.z, pe.shiftKey ? 1 : 5);
      teraz = { i, o, bledy: sprawdzOtwor(p, i, o) };
      setPodglad(teraz);
      invalidate();
    };
    const up = () => {
      sprzatanie.current?.();
      sprzatanie.current = null;
      if (controls) controls.enabled = true;
      setPodglad(null);
      invalidate();
      if (teraz.o.od === start.od && teraz.o.sciana === start.sciana) return;
      if (teraz.bledy.length) edycja.onBlad(teraz.bledy[0]);
      else edycja.onOtwor(i, teraz.o);
    };
    sprzatanie.current?.();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    sprzatanie.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  };
  return { podglad, zacznij };
}

type PodgladSciany = { i: number; s: ScianaDodatkowa; bledy: string[] };

/** Przeciąganie dodatkowej ściany po podłodze (krok 5 cm, z Shift 1 cm); czerwona = nie może tam stać. */
function usePrzeciaganieSciany(plan: PlanKuchni, edycja?: EdycjaOtworow) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null;
  const invalidate = useThree((s) => s.invalidate);
  const [podglad, setPodglad] = useState<PodgladSciany | null>(null);
  const planRef = useRef(plan);
  planRef.current = plan;
  const sprzatanie = useRef<(() => void) | null>(null);
  useEffect(() => () => sprzatanie.current?.(), []);
  const zacznij = (e: ThreeEvent<PointerEvent>, i: number) => {
    if (!edycja?.onSciana || e.button !== 0) return;
    e.stopPropagation();
    const start = planRef.current.sciany?.dodatkowe?.[i];
    if (!start) return;
    if (controls) controls.enabled = false;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const podloga = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const naPodlodze = (pe: { clientX: number; clientY: number }) => {
      const r = gl.domElement.getBoundingClientRect();
      ndc.set(((pe.clientX - r.left) / r.width) * 2 - 1, -((pe.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.ray.intersectPlane(podloga, new THREE.Vector3());
    };
    const p0 = naPodlodze(e.nativeEvent);
    if (!p0) return;
    let teraz: PodgladSciany = { i, s: start, bledy: [] };
    setPodglad(teraz);
    const move = (pe: PointerEvent) => {
      const p = naPodlodze(pe);
      if (!p) return;
      const krok = pe.shiftKey ? 1 : 5;
      const x = Math.round((start.x + (p.x - p0.x) * 100) / krok) * krok;
      const z = Math.round((start.z + (p.z - p0.z) * 100) / krok) * krok;
      const s = { ...start, x, z };
      teraz = { i, s, bledy: sprawdzScianeDodatkowa(planRef.current, s) };
      setPodglad(teraz);
      invalidate();
    };
    const up = () => {
      sprzatanie.current?.();
      sprzatanie.current = null;
      if (controls) controls.enabled = true;
      setPodglad(null);
      invalidate();
      if (teraz.s.x === start.x && teraz.s.z === start.z) return;
      if (teraz.bledy.length) edycja.onBlad(teraz.bledy[0]);
      else edycja.onSciana?.(i, teraz.s);
    };
    sprzatanie.current?.();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    sprzatanie.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  };
  return { podglad, zacznij };
}

export default function Sciany({
  plan,
  kolorDomyslny,
  edycja,
  onWybierz,
  onPodglad,
  onPodgladPunktu,
}: {
  plan: PlanKuchni;
  kolorDomyslny: string;
  edycja?: EdycjaOtworow;
  /** Wykonawca: klik w ścianę, otwór albo gniazdko – zaznaczenie (wymiary na żywo, Wymiary3D.tsx). */
  onWybierz?: (w: { typ: "otwor"; i: number } | { typ: "sciana"; id: ScianaPokoju } | { typ: "punkt"; i: number }) => void;
  /** Przeciągany otwór (do wymiarów na żywo); null po puszczeniu. */
  onPodglad?: (p: { i: number; o: Otwor } | null) => void;
  /** Przeciągany punkt instalacji; null po puszczeniu. */
  onPodgladPunktu?: (p: { i: number; p: PunktInstalacji } | null) => void;
}) {
  const { widoczne, kolor } = useSciany();
  const { podglad, zacznij } = usePrzeciaganieOtworu(plan, edycja, onPodglad);
  const przeciaganieSciany = usePrzeciaganieSciany(plan, edycja);
  const podgladSciany = przeciaganieSciany.podglad;
  const H = wysokoscPokoju(plan);
  const sciany = scianyPokoju(plan);
  const otwory = (plan.wywiad?.otwory ?? []).map((o, i) => (podglad?.i === i ? podglad.o : o));
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: kolor ?? kolorDomyslny, roughness: 0.92, side: THREE.FrontSide }), [kolor, kolorDomyslny]);
  const szyba = useMemo(() => new THREE.MeshStandardMaterial({ color: "#cfe3f5", roughness: 0.12, emissive: "#9ec4ea", emissiveIntensity: 0.3, transparent: true, opacity: 0.55, side: THREE.FrontSide }), []);
  const rama = useMemo(() => new THREE.MeshStandardMaterial({ color: "#eceae6", roughness: 0.5 }), []);
  const skrzydlo = useMemo(() => new THREE.MeshStandardMaterial({ color: "#8a6f55", roughness: 0.7, side: THREE.FrontSide }), []);
  const zly = useMemo(() => new THREE.MeshStandardMaterial({ color: "#d64545", roughness: 0.6, transparent: true, opacity: 0.8, side: THREE.DoubleSide }), []);
  const kolorSufitu = plan.sciany?.sufit ? (plan.sciany.sufit.kolor ?? KOLOR_SUFITU) : null;
  const sufit = useMemo(() => new THREE.MeshStandardMaterial({ color: kolorSufitu ?? KOLOR_SUFITU, roughness: 0.95, side: THREE.FrontSide }), [kolorSufitu]);
  const murMat = useMemo(() => new THREE.MeshStandardMaterial({ color: kolor ?? kolorDomyslny, roughness: 0.92 }), [kolor, kolorDomyslny]);
  useEffect(() => () => sufit.dispose(), [sufit]);
  useEffect(() => () => murMat.dispose(), [murMat]);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => [szyba, rama, skrzydlo, zly].forEach((m) => m.dispose()), [szyba, rama, skrzydlo, zly]);
  if (!widoczne) return null;

  return (
    <group name="sciany">
      {sciany.map((s) => {
        const naScianie = otwory.map((o, i) => ({ o, i })).filter(({ o }) => o.sciana === s.id);
        const segmenty = segmentySciany(
          s.dlugosc,
          H,
          naScianie.map(({ o }) => o),
        );
        // Lokalny układ ściany: x wzdłuż ściany (od początku), y w górę; potem przesunięcie i obrót do świata.
        const poz = (a: number, y: number): [number, number, number] => [(s.x + s.dx * a) / 100, y / 100, (s.z + s.dz * a) / 100];
        return (
          <group key={s.id} name={`sciana-${s.id}`}>
            {segmenty.map((g, i) => (
              <mesh
                key={i}
                position={poz((g.a + g.b) / 2, (g.y0 + g.y1) / 2)}
                rotation={[0, OBROT[s.id], 0]}
                material={material}
                receiveShadow
                onClick={
                  onWybierz
                    ? (e) => {
                        // Puszczenie po przeciąganiu (mebla, otworu, obrotu kamery) to nie klik.
                        if (e.delta > 4) return;
                        e.stopPropagation();
                        onWybierz({ typ: "sciana", id: s.id });
                      }
                    : undefined
                }
              >
                <planeGeometry args={[(g.b - g.a) / 100, (g.y1 - g.y0) / 100]} />
              </mesh>
            ))}
            {naScianie.map(({ o, i }) => {
              const { y0, y1 } = wysokoscOtworu(o, H);
              const srodek = poz(o.od + o.szer / 2, (y0 + y1) / 2);
              const czerwony = podglad?.i === i && podglad.bledy.length > 0;
              // Szyba i drzwi lekko w głąb ściany (od strony pokoju widać wnękę).
              const cofniecie: [number, number, number] = [srodek[0] - (s.nx * 6) / 100, srodek[1], srodek[2] - (s.nz * 6) / 100];
              return (
                <group key={`o${i}`} name={`otwor-${i}`}>
                  <mesh
                    position={cofniecie}
                    rotation={[0, OBROT[s.id], 0]}
                    material={czerwony ? zly : o.rodzaj === "okno" ? szyba : skrzydlo}
                    onPointerDown={edycja ? (e) => zacznij(e, i) : undefined}
                    onClick={
                      onWybierz
                        ? (e) => {
                            if (e.delta > 4) return;
                            e.stopPropagation();
                            onWybierz({ typ: "otwor", i });
                          }
                        : undefined
                    }
                    onPointerOver={edycja ? () => (document.body.style.cursor = "grab") : undefined}
                    onPointerOut={edycja ? () => (document.body.style.cursor = "") : undefined}
                  >
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
      {(plan.sciany?.dodatkowe ?? []).map((sd, i) => {
        const w = podgladSciany?.i === i ? podgladSciany.s : sd;
        const h = wysokoscSciany(w, plan);
        const czerwona = podgladSciany?.i === i && podgladSciany.bledy.length > 0;
        return (
          <mesh
            key={sd.id}
            name={`sciana-dodatkowa-${i + 1}`}
            position={[w.x / 100, h / 200, w.z / 100]}
            rotation={[0, (-w.kat * Math.PI) / 180, 0]}
            material={czerwona ? zly : murMat}
            castShadow
            receiveShadow
            onPointerDown={edycja?.onSciana ? (e) => przeciaganieSciany.zacznij(e, i) : undefined}
            onClick={(e) => {
              if (e.delta > 4) return;
              e.stopPropagation();
            }}
            onPointerOver={edycja?.onSciana ? () => (document.body.style.cursor = "grab") : undefined}
            onPointerOut={edycja?.onSciana ? () => (document.body.style.cursor = "") : undefined}
          >
            <boxGeometry args={[w.dlugosc / 100, h / 100, w.grubosc / 100]} />
          </mesh>
        );
      })}
      {kolorSufitu
        ? (() => {
            const z = zakresPokoju(plan);
            return (
              <mesh name="sufit" position={[(z.x0 + z.x1) / 200, H / 100, (z.z0 + z.z1) / 200]} rotation={[Math.PI / 2, 0, 0]} material={sufit} receiveShadow>
                <planeGeometry args={[(z.x1 - z.x0) / 100, (z.z1 - z.z0) / 100]} />
              </mesh>
            );
          })()
        : null}
      <PunktyInstalacji
        plan={plan}
        edycja={edycja?.onPunkt ? { onPunkt: edycja.onPunkt, onBlad: edycja.onBlad } : undefined}
        onWybierz={onWybierz ? (i) => onWybierz({ typ: "punkt", i }) : undefined}
        onPodglad={onPodgladPunktu}
      />
    </group>
  );
}
