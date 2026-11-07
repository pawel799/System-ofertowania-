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
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import {
  czyObrys,
  KOLOR_SUFITU,
  muryPokoju,
  polaczeniaScianek,
  ruchScianki,
  scianaZPolaczeniami,
  scianyPokoju,
  segmentySciany,
  wysokoscOtworu,
  wysokoscPokoju,
  wysokoscSciany,
  wysokoscScianyPokoju,
  zakresPokoju,
  type Sciana,
  type ScianaDodatkowa,
  type ScianaPokoju,
} from "@/lib/sciany";
import { otworWPunkcie, sprawdzOtwor, sprawdzScianeDodatkowa } from "@/lib/otwory";
import type { PlanKuchni } from "@/lib/kuchnia";
import type { Otwor } from "@/lib/wywiad";
import { useSciany } from "./scianyStore";
import { prostokatUV, strop, tynk } from "./teksturyPokoju";
import PunktyInstalacji, { type EdycjaPunktow } from "./PunktyInstalacji";
import type { PunktInstalacji } from "@/lib/wywiad";


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

/** Sufit pokoju o dowolnym kształcie: wielokąt na wysokości pokoju, widoczny od spodu. */
function SufitObrysu({ obrys, H, material }: { obrys: readonly { x: number; z: number }[]; H: number; material: THREE.Material }) {
  const geo = useMemo(() => {
    const ksztalt = new THREE.Shape(obrys.map((p) => new THREE.Vector2(p.x / 100, p.z / 100)));
    return new THREE.ShapeGeometry(ksztalt);
  }, [obrys]);
  useEffect(() => () => geo.dispose(), [geo]);
  // Kształt w płaszczyźnie XY obrócony o +90° wokół x: (x, y) → (x, 0, y), normalna w dół.
  return <mesh name="sufit" geometry={geo} position={[0, H / 100, 0]} rotation={[Math.PI / 2, 0, 0]} material={material} receiveShadow />;
}

/** Wierzch sufitu (widok z góry): kształt pokoju, jednolita płyta stropowa (bez fug). UV w metrach. */
function SufitOdGory({ punkty, H }: { punkty: readonly { x: number; z: number }[]; H: number }) {
  const klucz = punkty.map((p) => `${p.x},${p.z}`).join(";");
  const geo = useMemo(
    // Kształt (x, −z) obrócony o −90° wokół x → (x, 0, z), normalna w górę; UV = współrzędne kształtu (metry).
    () => new THREE.ShapeGeometry(new THREE.Shape(punkty.map((p) => new THREE.Vector2(p.x / 100, -p.z / 100)))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [klucz],
  );
  const material = useMemo(() => new THREE.MeshStandardMaterial({ map: strop(), roughness: 0.97, side: THREE.FrontSide }), []);
  useEffect(() => () => geo.dispose(), [geo]);
  useEffect(() => () => material.dispose(), [material]);
  // Płyta leży na ścianach (tuż nad wierzchem murów) – od spodu widać sufit, od góry płytę stropową.
  return <mesh name="sufit-gora" geometry={geo} position={[0, H / 100 + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} material={material} receiveShadow />;
}

/** Wysokość cokołu ściany przyciętej (kamera po zewnętrznej stronie ściany) [cm]. */
const COKOL = 32;

type OtworNaMurze = { o: Otwor; i: number };
type MaterialyMuru = { listwa: THREE.Material; szyba: THREE.Material; rama: THREE.Material; skrzydlo: THREE.Material; zly: THREE.Material };

/**
 * Ściana pokoju jako mur: wewnętrzna i zewnętrzna strona (tynk), ościeża okien i drzwi, wierzch, wolne końce, listwa.
 * Przycinanie (jak w grach o budowaniu domu): gdy kamera jest po zewnętrznej stronie ściany, zamiast pełnej ściany
 * widać niski cokół – wnętrze nie jest zasłonięte. Bez przycinania ściana zawsze pełna, z obu stron otynkowana.
 */
function Mur({
  s,
  H,
  Hs,
  g,
  polaczone,
  mur,
  otwory,
  material,
  m,
  przycinanie,
  podgladOtworu,
  onOtworDown,
  onWybierz,
  edycja,
}: {
  s: Sciana;
  H: number;
  Hs: number;
  g: number;
  polaczone: readonly [boolean, boolean];
  mur: { x: number; z: number }[] | null;
  otwory: OtworNaMurze[];
  material: THREE.Material;
  m: MaterialyMuru;
  przycinanie: boolean;
  podgladOtworu: { i: number; bledy: string[] } | null;
  onOtworDown?: (e: ThreeEvent<PointerEvent>, i: number) => void;
  onWybierz?: (w: { typ: "otwor"; i: number } | { typ: "sciana"; id: ScianaPokoju }) => void;
  edycja: boolean;
}) {
  const pelna = useRef<THREE.Group>(null);
  const cokol = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    // Kamera po zewnętrznej stronie (przeciwnie do normalnej do wnętrza) – ściana przycięta do cokołu.
    const zewnatrz = (camera.position.x * 100 - s.x) * s.nx + (camera.position.z * 100 - s.z) * s.nz < 0;
    const przytnij = przycinanie && zewnatrz;
    if (pelna.current) pelna.current.visible = !przytnij;
    if (cokol.current) cokol.current.visible = przytnij;
  });
  const poz = (a: number, y: number, wglab = 0): [number, number, number] => [(s.x + s.dx * a - s.nx * wglab) / 100, y / 100, (s.z + s.dz * a - s.nz * wglab) / 100];
  const klikSciany = onWybierz
    ? (e: ThreeEvent<MouseEvent>) => {
        // Puszczenie po przeciąganiu (mebla, otworu, obrotu kamery) to nie klik.
        if (e.delta > 4) return;
        e.stopPropagation();
        onWybierz({ typ: "sciana", id: s.id });
      }
    : undefined;
  const obrotZew = s.obrot + Math.PI;
  /** Obie strony ściany, wierzch, wolne końce i listwa – do wysokości h (pełna albo cokół). */
  const bryla = (h: number, zOtworami: boolean) => {
    const seg = segmentySciany(
      s.dlugosc,
      h,
      zOtworami ? otwory.map(({ o }) => o) : [],
    )
      .map((x) => ({ ...x, y1: Math.min(x.y1, h) }))
      .filter((x) => x.y1 > x.y0);
    return (
      <>
        {seg.map((x, i) => (
          <group key={i}>
            <mesh position={poz((x.a + x.b) / 2, (x.y0 + x.y1) / 2)} rotation={[0, s.obrot, 0]} material={material} receiveShadow onClick={klikSciany}>
              <KawalekSciany w={(x.b - x.a) / 100} h={(x.y1 - x.y0) / 100} u0={x.a / 100} v0={x.y0 / 100} />
            </mesh>
            {(() => {
              // Zewnętrzna strona w narożniku z sąsiednią ścianą sięga o grubość dalej – róg zamknięty.
              const a = x.a <= 0.01 && polaczone[0] ? -g : x.a;
              const b = x.b >= s.dlugosc - 0.01 && polaczone[1] ? s.dlugosc + g : x.b;
              return (
                <mesh position={poz((a + b) / 2, (x.y0 + x.y1) / 2, g)} rotation={[0, obrotZew, 0]} material={material} receiveShadow onClick={klikSciany}>
                  <KawalekSciany w={(b - a) / 100} h={(x.y1 - x.y0) / 100} u0={a / 100} v0={x.y0 / 100} />
                </mesh>
              );
            })()}
          </group>
        ))}
        {/* Listwa przypodłogowa po stronie pokoju (przerwana w drzwiach). */}
        {seg
          .filter((x) => x.y0 === 0 && x.b - x.a > 2)
          .map((x, i) => (
            <mesh key={`l${i}`} position={poz((x.a + x.b) / 2, 4, -0.8)} rotation={[0, s.obrot, 0]} material={m.listwa} receiveShadow>
              <boxGeometry args={[(x.b - x.a) / 100, 0.08, 0.016]} />
            </mesh>
          ))}
        {/* Wolne końce (bez sąsiedniej ściany) – widać grubość. */}
        {([0, 1] as const)
          .filter((e) => !polaczone[e])
          .map((e) => {
            const kier = e === 0 ? -1 : 1;
            return (
              <mesh key={`k${e}`} position={poz(e === 0 ? 0 : s.dlugosc, h / 2, g / 2)} rotation={[0, Math.atan2(s.dx * kier, s.dz * kier), 0]} material={material}>
                <planeGeometry args={[g / 100, h / 100]} />
              </mesh>
            );
          })}
        {mur ? <WierzchMuru punkty={mur} y={h} material={material} /> : null}
      </>
    );
  };
  return (
    <group name={`sciana-${s.id}`}>
      <group ref={pelna}>
        {bryla(Hs, true)}
        {/* Ościeża: boki i nadproże otworu (i parapet okna) na grubość muru – z zewnątrz nie widać szczeliny. */}
        {otwory.map(({ o, i }) => {
          const { y0, y1: y1r } = wysokoscOtworu(o, H);
          const y1 = Math.min(y1r, Hs);
          if (y1 <= y0) return null;
          const a0 = Math.max(0, o.od);
          const a1 = Math.min(s.dlugosc, o.od + o.szer);
          return (
            <group key={`os${i}`}>
              <mesh position={poz(a0, (y0 + y1) / 2, g / 2)} rotation={[0, Math.atan2(s.dx, s.dz), 0]} material={material}>
                <planeGeometry args={[g / 100, (y1 - y0) / 100]} />
              </mesh>
              <mesh position={poz(a1, (y0 + y1) / 2, g / 2)} rotation={[0, Math.atan2(-s.dx, -s.dz), 0]} material={material}>
                <planeGeometry args={[g / 100, (y1 - y0) / 100]} />
              </mesh>
              {y1 < Hs ? (
                <mesh position={poz((a0 + a1) / 2, y1, g / 2)} rotation={[Math.PI / 2, 0, Math.atan2(-s.dz, s.dx)]} material={material}>
                  <planeGeometry args={[(a1 - a0) / 100, g / 100]} />
                </mesh>
              ) : null}
              {y0 > 0 ? (
                <mesh position={poz((a0 + a1) / 2, y0, g / 2)} rotation={[-Math.PI / 2, 0, Math.atan2(-s.dz, s.dx)]} material={material}>
                  <planeGeometry args={[(a1 - a0) / 100, g / 100]} />
                </mesh>
              ) : null}
            </group>
          );
        })}
        {otwory.map(({ o, i }) => {
          const { y0, y1 } = wysokoscOtworu(o, H);
          const srodek = poz(o.od + o.szer / 2, (y0 + y1) / 2);
          const czerwony = podgladOtworu?.i === i && podgladOtworu.bledy.length > 0;
          // Szyba i drzwi w głębi ściany (od strony pokoju widać wnękę).
          const cofniecie: [number, number, number] = [srodek[0] - (s.nx * 6) / 100, srodek[1], srodek[2] - (s.nz * 6) / 100];
          return (
            <group key={`o${i}`} name={`otwor-${i}`}>
              <mesh
                position={cofniecie}
                rotation={[0, s.obrot, 0]}
                material={czerwony ? m.zly : o.rodzaj === "okno" ? m.szyba : m.skrzydlo}
                onPointerDown={onOtworDown ? (e) => onOtworDown(e, i) : undefined}
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
                <mesh position={[srodek[0] + (s.nx * 7) / 100, y0 / 100 - 0.015, srodek[2] + (s.nz * 7) / 100]} rotation={[0, s.obrot, 0]} material={m.rama} receiveShadow>
                  <boxGeometry args={[o.szer / 100 + 0.06, 0.03, 0.14]} />
                </mesh>
              ) : null}
            </group>
          );
        })}
      </group>
      <group ref={cokol} visible={false}>
        {bryla(Math.min(COKOL, Hs), true)}
      </group>
    </group>
  );
}

/** Kawałek ściany (między otworami) z UV w metrach – faktura tynku ciągła na całej ścianie. */
function KawalekSciany({ w, h, u0, v0 }: { w: number; h: number; u0: number; v0: number }) {
  const geo = useMemo(() => prostokatUV(w, h, u0, v0, 1), [w, h, u0, v0]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <primitive object={geo} attach="geometry" />;
}

/** Wierzch muru ściany pokoju (wielokąt z rzutu na wysokości ściany, widoczny z góry). */
function WierzchMuru({ punkty, y, material }: { punkty: readonly { x: number; z: number }[]; y: number; material: THREE.Material }) {
  const klucz = punkty.map((p) => `${p.x.toFixed(1)},${p.z.toFixed(1)}`).join(";");
  const geo = useMemo(
    // Kształt (x, −z) obrócony o −90° wokół x → (x, 0, z), normalna w górę.
    () => new THREE.ShapeGeometry(new THREE.Shape(punkty.map((p) => new THREE.Vector2(p.x / 100, -p.z / 100)))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [klucz],
  );
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} position={[0, y / 100 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} material={material} />;
}

type PodgladSciany = { zmiany: Map<number, ScianaDodatkowa>; bledy: string[] };

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
    const plan0 = planRef.current;
    let teraz: PodgladSciany = { zmiany: new Map([[i, start]]), bledy: [] };
    setPodglad(teraz);
    const move = (pe: PointerEvent) => {
      const p = naPodlodze(pe);
      if (!p) return;
      // Łączenie jak na rzucie: koniec przyciąga się do innych ścian (Alt – bez), połączone ścianki idą za nią.
      const r = ruchScianki(plan0, i, "srodek", { x: start.x + (p.x - p0.x) * 100, z: start.z + (p.z - p0.z) * 100 }, { krok: pe.shiftKey ? 1 : 5, laczenie: !pe.altKey });
      teraz = { zmiany: r.zmiany, bledy: Array.from(r.zmiany.values()).flatMap((s) => sprawdzScianeDodatkowa(planRef.current, s)) };
      setPodglad(teraz);
      invalidate();
    };
    const up = () => {
      sprzatanie.current?.();
      sprzatanie.current = null;
      if (controls) controls.enabled = true;
      setPodglad(null);
      invalidate();
      const lista = plan0.sciany?.dodatkowe ?? [];
      const zmienione = Array.from(teraz.zmiany).filter(([j, s]) => lista[j] && (s.x !== lista[j].x || s.z !== lista[j].z || s.kat !== lista[j].kat || s.dlugosc !== lista[j].dlugosc));
      if (!zmienione.length) return;
      if (teraz.bledy.length) edycja.onBlad(teraz.bledy[0]);
      else for (const [j, s] of zmienione) edycja.onSciana?.(j, s);
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
  onWybierz?: (w: { typ: "otwor"; i: number } | { typ: "sciana"; id: ScianaPokoju } | { typ: "punkt"; i: number } | { typ: "scianka"; i: number }) => void;
  /** Przeciągany otwór (do wymiarów na żywo); null po puszczeniu. */
  onPodglad?: (p: { i: number; o: Otwor } | null) => void;
  /** Przeciągany punkt instalacji; null po puszczeniu. */
  onPodgladPunktu?: (p: { i: number; p: PunktInstalacji } | null) => void;
}) {
  const { widoczne, kolor, przyciete } = useSciany();
  const { podglad, zacznij } = usePrzeciaganieOtworu(plan, edycja, onPodglad);
  const przeciaganieSciany = usePrzeciaganieSciany(plan, edycja);
  const podgladSciany = przeciaganieSciany.podglad;
  const H = wysokoscPokoju(plan);
  const sciany = scianyPokoju(plan);
  const muryLista = muryPokoju(plan);
  const mury = new Map(muryLista.map((m) => [m.s.id, m.punkty]));
  const wolneKonce = new Map(muryLista.map((m) => [m.s.id, { g: m.g, polaczone: m.polaczone }]));
  const polaczenia = polaczeniaScianek((plan.sciany?.dodatkowe ?? []).map((sd, i) => podgladSciany?.zmiany.get(i) ?? sd));
  const otwory = (plan.wywiad?.otwory ?? []).map((o, i) => (podglad?.i === i ? podglad.o : o));
  // Ściany z fakturą tynku (prawie biała mapa mnoży kolor – kolor ściany zostaje), też jako lekka wypukłość.
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: kolor ?? kolorDomyslny, map: tynk(), bumpMap: tynk(), bumpScale: 0.6, roughness: 0.92, side: THREE.FrontSide }), [kolor, kolorDomyslny]);
  const listwa = useMemo(() => new THREE.MeshStandardMaterial({ color: "#f3f1ec", roughness: 0.55 }), []);
  useEffect(() => () => listwa.dispose(), [listwa]);
  const szyba = useMemo(() => new THREE.MeshStandardMaterial({ color: "#cfe3f5", roughness: 0.12, emissive: "#9ec4ea", emissiveIntensity: 0.3, transparent: true, opacity: 0.55, side: THREE.DoubleSide }), []);
  const rama = useMemo(() => new THREE.MeshStandardMaterial({ color: "#eceae6", roughness: 0.5 }), []);
  const skrzydlo = useMemo(() => new THREE.MeshStandardMaterial({ color: "#8a6f55", roughness: 0.7, side: THREE.DoubleSide }), []);
  const zly = useMemo(() => new THREE.MeshStandardMaterial({ color: "#d64545", roughness: 0.6, transparent: true, opacity: 0.8, side: THREE.DoubleSide }), []);
  const kolorSufitu = plan.sciany?.sufit ? (plan.sciany.sufit.kolor ?? KOLOR_SUFITU) : null;
  const sufit = useMemo(() => new THREE.MeshStandardMaterial({ color: kolorSufitu ?? KOLOR_SUFITU, map: tynk(), roughness: 0.95, side: THREE.FrontSide }), [kolorSufitu]);
  useEffect(() => () => sufit.dispose(), [sufit]);
  // Własne kolory ścian (plan.sciany.koloryScian) i ścianek działowych – materiał na każdy użyty kolor.
  const koloryScian = plan.sciany?.koloryScian;
  const kolorySciankek = (plan.sciany?.dodatkowe ?? []).map((d) => d.kolor ?? "").join(",");
  const wlasne = useMemo(() => {
    const m = new Map<string, { sciana: THREE.MeshStandardMaterial; mur: THREE.MeshStandardMaterial }>();
    const kolory = new Set([...Object.values(koloryScian ?? {}), ...kolorySciankek.split(",")].filter((k): k is string => !!k));
    for (const k of Array.from(kolory))
      m.set(k, {
        sciana: new THREE.MeshStandardMaterial({ color: k, map: tynk(), bumpMap: tynk(), bumpScale: 0.6, roughness: 0.92, side: THREE.FrontSide }),
        mur: new THREE.MeshStandardMaterial({ color: k, map: tynk(), roughness: 0.92 }),
      });
    return m;
  }, [koloryScian, kolorySciankek]);
  useEffect(() => () => wlasne.forEach((x) => (x.sciana.dispose(), x.mur.dispose())), [wlasne]);
  const murMat = useMemo(() => new THREE.MeshStandardMaterial({ color: kolor ?? kolorDomyslny, map: tynk(), roughness: 0.92 }), [kolor, kolorDomyslny]);
  useEffect(() => () => murMat.dispose(), [murMat]);
  const materialSciany = (id: ScianaPokoju) => (koloryScian?.[id] && wlasne.get(koloryScian[id]!)?.sciana) || material;
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => [szyba, rama, skrzydlo, zly].forEach((m) => m.dispose()), [szyba, rama, skrzydlo, zly]);
  if (!widoczne) return null;

  return (
    <group name="sciany">
      {sciany.map((s) => {
        const k = wolneKonce.get(s.id);
        return (
          <Mur
            key={s.id}
            s={s}
            H={H}
            Hs={wysokoscScianyPokoju(plan, s.id)}
            g={k?.g ?? 12}
            polaczone={k?.polaczone ?? [true, true]}
            mur={mury.get(s.id) ?? null}
            otwory={otwory.map((o, i) => ({ o, i })).filter(({ o }) => o.sciana === s.id)}
            material={materialSciany(s.id)}
            m={{ listwa, szyba, rama, skrzydlo, zly }}
            przycinanie={przyciete}
            podgladOtworu={podglad}
            onOtworDown={edycja ? zacznij : undefined}
            onWybierz={onWybierz}
            edycja={!!edycja}
          />
        );
      })}
      {(plan.sciany?.dodatkowe ?? []).map((sd, i) => {
        const teraz = podgladSciany?.zmiany.get(i) ?? sd;
        // Połączone końce wydłużone o pół grubości – narożnik bez szczeliny.
        const pol = polaczenia[i];
        const w = scianaZPolaczeniami(teraz, [pol[0].length > 0, pol[1].length > 0]);
        const h = wysokoscSciany(w, plan);
        const czerwona = !!podgladSciany?.zmiany.has(i) && podgladSciany.bledy.length > 0;
        return (
          <mesh
            key={sd.id}
            name={`sciana-dodatkowa-${i + 1}`}
            position={[w.x / 100, h / 200, w.z / 100]}
            rotation={[0, (-w.kat * Math.PI) / 180, 0]}
            material={czerwona ? zly : (sd.kolor && wlasne.get(sd.kolor)?.mur) || murMat}
            castShadow
            receiveShadow
            onPointerDown={edycja?.onSciana ? (e) => przeciaganieSciany.zacznij(e, i) : undefined}
            onClick={(e) => {
              if (e.delta > 4) return;
              e.stopPropagation();
              onWybierz?.({ typ: "scianka", i });
            }}
            onPointerOver={edycja?.onSciana ? () => (document.body.style.cursor = "grab") : undefined}
            onPointerOut={edycja?.onSciana ? () => (document.body.style.cursor = "") : undefined}
          >
            <boxGeometry args={[w.dlugosc / 100, h / 100, w.grubosc / 100]} />
          </mesh>
        );
      })}
      {kolorSufitu && czyObrys(plan) ? <SufitObrysu obrys={plan.sciany!.obrys!} H={H} material={sufit} /> : null}
      {kolorSufitu
        ? (() => {
            // Prostokąt: płyta razem z grubością murów (zasięg ścian pokoju); inny kształt – obrys pokoju.
            const m = muryPokoju(plan).flatMap((x) => x.punkty);
            const z = m.length
              ? { x0: Math.min(...m.map((q) => q.x)), z0: Math.min(...m.map((q) => q.z)), x1: Math.max(...m.map((q) => q.x)), z1: Math.max(...m.map((q) => q.z)) }
              : zakresPokoju(plan);
            const punkty = czyObrys(plan)
              ? plan.sciany!.obrys!
              : [
                  { x: z.x0, z: z.z0 },
                  { x: z.x1, z: z.z0 },
                  { x: z.x1, z: z.z1 },
                  { x: z.x0, z: z.z1 },
                ];
            return <SufitOdGory punkty={punkty} H={H} />;
          })()
        : null}
      {kolorSufitu && !czyObrys(plan)
        ? (() => {
            const z = zakresPokoju(plan);
            return (
              <mesh name="sufit" position={[(z.x0 + z.x1) / 200, H / 100, (z.z0 + z.z1) / 200]} rotation={[Math.PI / 2, 0, 0]} material={sufit} receiveShadow>
                <KawalekSciany w={(z.x1 - z.x0) / 100} h={(z.z1 - z.z0) / 100} u0={0} v0={0} />
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
