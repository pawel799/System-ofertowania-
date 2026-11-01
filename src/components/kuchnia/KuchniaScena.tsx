"use client";

import { Component, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, OrbitControls, useGLTF } from "@react-three/drei";
import { PerspectiveCamera, Vector3 } from "three";
import { konfliktElementow, nachodzi, przyciagnij, rect, type ElementKuchni, type PlanKuchni } from "@/lib/kuchnia";
import { meblaWOtworze } from "@/lib/otwory";
import { wGranicachPokoju } from "@/lib/sciany";
import { Plane, Raycaster, Vector2 } from "three";
import { applyRoles, lookFor, type PublicModel } from "../modelRoles";
import { useCountertop } from "../countertopStore";
import { useFront } from "../frontStore";
import { useHardware } from "../hardwareStore";
import { usePalettes } from "../paletteStore";
import { useKatalog } from "../katalogStore";
import AgdBryla from "./AgdBryla";
import { yElementu } from "./uklad3d";
import Wymiary3D, { type Wybor3D } from "./Wymiary3D";
import type { Otwor } from "@/lib/wywiad";
import { tloDlaKoloru, type TloSceny } from "../tloSceny";
import { dopasuj, Obrys, useUchwytModelu } from "./obrys";
import { useRuch } from "./MebelParametryczny";
import { przygotujRuchome, ustawOtwarcie } from "./ruchomeGlb";
import { otwarty, przelaczElement, useOtwarcie } from "./otwarcieStore";
import { useKoloryProjektu } from "../koloryStore";
import Sciany, { type EdycjaOtworow } from "./Sciany";
import { koloryMebla } from "@/lib/kolory";

export type KuchniaUjecie = { jpeg: () => string | null };

const BLAT: Record<string, string> = {
  "kwarcyt-calacatta": "#ece8e1",
  "granit-absolute-black": "#1a1a1c",
  "laminat-dab": "#b48a5e",
};

type Props = {
  plan: PlanKuchni;
  modele?: PublicModel[];
  zaznaczony?: string | null;
  onWybierz?: (id: string) => void;
  /** Bufor rysowania zostaje, żeby dało się zrobić zrzut do PDF. */
  zdjecie?: boolean;
  onUjecie?: (u: KuchniaUjecie | null) => void;
  /** Linie wymiarowe — tylko w kreatorze. */
  wymiary?: boolean;
  /** Kreator: przeciąganie okien i drzwi po ścianach (Sciany.tsx). */
  edycjaOtworow?: EdycjaOtworow;
  /** Kreator (tylko wykonawca): przeciąganie mebli po podłodze w 3D, z przyciąganiem i zabezpieczeniami. */
  edycjaMebli?: EdycjaMebli;
  /** Podgląd przesuwanego mebla (x, z na żywo) – np. do wymiarów obok sceny. */
  onPodgladMebla?: (p: { id: string; x: number; z: number; zly: string | null } | null) => void;
};

export type EdycjaMebli = {
  onPrzesun: (id: string, x: number, z: number) => void;
  /** Ruch odrzucony – komunikat (nachodzi na inny mebel, drzwi, okno). */
  onKolizja: (powod: string) => void;
};

type PodgladMebla = { id: string; x: number; z: number; zly: string | null };

/** Dlaczego mebel nie może stać w tym miejscu (null = może). */
function powodKolizji(plan: PlanKuchni, oryginal: ElementKuchni, kand: ElementKuchni): string | null {
  const r = rect(kand);
  const inny = plan.elementy.find((e) => e.id !== kand.id && konfliktElementow(kand, e) && nachodzi(r, rect(e)));
  if (inny) return `Nachodzi na „${inny.nazwa}”.`;
  const wOtworze = meblaWOtworze(plan, kand);
  if (wOtworze && !meblaWOtworze(plan, oryginal)) return wOtworze;
  return null;
}

/**
 * Przeciąganie mebla w 3D: punkt pod kursorem na poziomej płaszczyźnie spodu mebla, przyciąganie do ścian i sąsiadów
 * (przyciagnij), podgląd na żywo; puszczony w złym miejscu wraca. Krótki klik (do 4 px) zostaje zaznaczeniem.
 */
function usePrzeciaganieMebla(plan: PlanKuchni, edycja: EdycjaMebli | undefined, onPodglad?: (p: PodgladMebla | null) => void) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null;
  const invalidate = useThree((s) => s.invalidate);
  const [podglad, setPodglad] = useState<PodgladMebla | null>(null);
  const planRef = useRef(plan);
  planRef.current = plan;
  const sprzatanie = useRef<(() => void) | null>(null);
  useEffect(() => () => sprzatanie.current?.(), []);
  const ustaw = (p: PodgladMebla | null) => {
    setPodglad(p);
    onPodglad?.(p);
    invalidate();
  };

  const zacznij = (e: ThreeEvent<PointerEvent>, el: ElementKuchni) => {
    if (!edycja || e.button !== 0) return;
    const y = yElementu(el, planRef.current);
    const plaszczyzna = new Plane(new Vector3(0, 1, 0), -y);
    const ray = new Raycaster();
    const ndc = new Vector2();
    const naPodlodze = (cx: number, cy: number) => {
      const r = gl.domElement.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.ray.intersectPlane(plaszczyzna, new Vector3());
    };
    const p0 = naPodlodze(e.nativeEvent.clientX, e.nativeEvent.clientY);
    if (!p0) return;
    const dx = el.x - p0.x * 100;
    const dz = el.z - p0.z * 100;
    const sx = e.nativeEvent.clientX;
    const sy = e.nativeEvent.clientY;
    // Kamera stoi, dopóki trzymamy mebel (inaczej pierwsze piksele ruchu obracałyby widok).
    if (controls) controls.enabled = false;
    let ruch = false;
    let teraz: PodgladMebla | null = null;
    const move = (pe: PointerEvent) => {
      if (!ruch && Math.hypot(pe.clientX - sx, pe.clientY - sy) < 4) return;
      if (!ruch) {
        ruch = true;
        document.body.style.cursor = "grabbing";
      }
      const p = naPodlodze(pe.clientX, pe.clientY);
      if (!p) return;
      const pl = planRef.current;
      const oryginal = pl.elementy.find((x) => x.id === el.id);
      if (!oryginal) return;
      const surowe = { x: Math.max(-100, Math.min(1500, Math.round(p.x * 100 + dx))), z: Math.max(-100, Math.min(1500, Math.round(p.z * 100 + dz))) };
      const przyc = pe.shiftKey ? surowe : przyciagnij(pl, oryginal, surowe.x, surowe.z);
      // Mebel nie wychodzi za ściany pokoju.
      const przy = wGranicachPokoju(pl, rect({ ...oryginal, x: przyc.x, z: przyc.z }), przyc.x, przyc.z);
      teraz = { id: el.id, x: przy.x, z: przy.z, zly: powodKolizji(pl, oryginal, { ...oryginal, x: przy.x, z: przy.z }) };
      ustaw(teraz);
    };
    const up = () => {
      sprzatanie.current?.();
      sprzatanie.current = null;
      if (controls) controls.enabled = true;
      if (!ruch) return;
      document.body.style.cursor = "";
      ustaw(null);
      const oryginal = planRef.current.elementy.find((x) => x.id === el.id);
      if (!teraz || !oryginal || (teraz.x === oryginal.x && teraz.z === oryginal.z)) return;
      if (teraz.zly) edycja.onKolizja(teraz.zly);
      else edycja.onPrzesun(el.id, teraz.x, teraz.z);
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

function zakres(plan: PlanKuchni) {
  let x0 = 0;
  let x1 = plan.scianaA / 100;
  let z0 = 0;
  let z1 = (plan.uklad === "L" ? plan.scianaB : 90) / 100;
  let y1 = 1.2;
  if (plan.pomieszczenie) {
    x1 = Math.max(x1, plan.pomieszczenie.szer / 100);
    z1 = Math.max(z1, plan.pomieszczenie.dlug / 100);
  }
  for (const e of plan.elementy) {
    const r = rect(e);
    x0 = Math.min(x0, r.x0 / 100);
    x1 = Math.max(x1, r.x1 / 100);
    z0 = Math.min(z0, r.z0 / 100);
    z1 = Math.max(z1, r.z1 / 100);
    y1 = Math.max(y1, yElementu(e, plan) + e.h / 100);
  }
  return { x0, x1, z0, z1, y1 };
}

function Kamera({ plan }: { plan: PlanKuchni }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const controls = useThree((s) => s.controls) as { target: Vector3; update: () => void } | null;
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const invalidate = useThree((s) => s.invalidate);
  const sygnatura = `${plan.uklad}:${plan.scianaA}:${plan.scianaB}:${plan.pomieszczenie?.szer ?? 0}x${plan.pomieszczenie?.dlug ?? 0}:${plan.elementy.map((e) => e.id).join(",")}`;
  useLayoutEffect(() => {
    const { x0, x1, z0, z1, y1 } = zakres(plan);
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const target = new Vector3(cx, y1 * 0.38, cz);
    const radius = Math.max(x1 - x0, z1 - z0, y1, 1) * 0.62;
    const vHalf = (camera.fov * Math.PI) / 360;
    const half = aspect < 1 ? Math.atan(Math.tan(vHalf) * aspect) : vHalf;
    const dist = (radius / Math.sin(Math.max(0.2, half))) * 0.92;
    camera.position.set(cx + dist * 0.62, target.y + dist * 0.48, cz + dist * 0.78);
    camera.near = 0.05;
    camera.far = dist * 20;
    camera.updateProjectionMatrix();
    camera.lookAt(target);
    if (controls) {
      controls.target.copy(target);
      controls.update();
    }
    invalidate();
    // Kadrowanie tylko po dodaniu albo usunięciu szafki, nie przy każdym przeciągnięciu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sygnatura, aspect, camera, controls, invalidate]);
  return null;
}

function Ujecie({ aktywne, onUjecie }: { aktywne: boolean; onUjecie?: (u: KuchniaUjecie | null) => void }) {
  const gl = useThree((s) => s.gl);
  const advance = useThree((s) => s.advance);
  useEffect(() => {
    if (!aktywne || !onUjecie) return;
    onUjecie({
      jpeg: () => {
        try {
          advance(performance.now(), true);
          return gl.domElement.toDataURL("image/jpeg", 0.72);
        } catch {
          return null;
        }
      },
    });
    return () => onUjecie(null);
  }, [aktywne, advance, gl, onUjecie]);
  return null;
}

function ModelBryla({
  model,
  w,
  h,
  d,
  otwarte = false,
  kolorFrontu,
  kolorKorpusu,
}: {
  model: PublicModel;
  w: number;
  h: number;
  d: number;
  otwarte?: boolean;
  /** Kolory tego mebla (kolory.ts): front i boki; brak = wybór z paska materiałów. */
  kolorFrontu?: string;
  kolorKorpusu?: string;
}) {
  const { scene } = useGLTF(model.url, true, true);
  // Kopia sceny w osobnym węźle: plik zostaje nietknięty, dopasowanie robi grupa nad nim.
  const uchwyt = useUchwytModelu(scene);
  // Drzwi, klapy, szuflady i drzwi przesuwne na pivotach (ruchomeGlb.ts) + aliasy ról dla kawałków uchwytów.
  const { ruchome, aliasy } = useMemo(() => przygotujRuchome(uchwyt, model.tags), [uchwyt, model.tags]);
  const postep = useRef(0);
  // Pudełko liczone w układzie modelu (nie świata) – patrz obrys.tsx. Zawsze przy zamkniętych frontach.
  const fit = useMemo(() => {
    ustawOtwarcie(ruchome, 0);
    const f = dopasuj(uchwyt, w / 100, h / 100, d / 100);
    ustawOtwarcie(ruchome, postep.current);
    return f;
  }, [uchwyt, ruchome, w, h, d]);
  useRuch(otwarte, (p) => {
    postep.current = p;
    ustawOtwarcie(ruchome, p);
  });
  const tagi = useMemo(() => ({ ...model.tags, ...aliasy }), [model.tags, aliasy]);
  const invalidate = useThree((s) => s.invalidate);
  const frontWspolny = useFront();
  const front = kolorFrontu ?? frontWspolny;
  const countertop = useCountertop();
  const hardware = useHardware();
  const palettes = usePalettes();
  const katalogMat = useKatalog();
  useEffect(() => {
    return applyRoles(uchwyt, tagi, { front, countertop, hardware, korpus: kolorKorpusu ?? front }, palettes, katalogMat);
  }, [uchwyt, tagi, front, countertop, hardware, kolorKorpusu, palettes, katalogMat]);
  useEffect(() => invalidate(), [fit, invalidate]);
  return (
    <group position={fit.position} scale={fit.scale}>
      <primitive object={uchwyt} />
    </group>
  );
}

class BladModelu extends Component<{ children: ReactNode; fallback: ReactNode }, { blad: boolean }> {
  state = { blad: false };
  static getDerivedStateFromError() {
    return { blad: true };
  }
  render() {
    return this.state.blad ? this.props.fallback : this.props.children;
  }
}

function ElementWidok({
  el,
  plan,
  model,
  zaznaczony,
  kolor,
  chropowatosc,
  blat,
  uchwyt,
  onWybierz,
  otwarte,
  korpus,
  srodek,
  ids,
  onChwyt,
  zly = false,
}: {
  el: ElementKuchni;
  plan: PlanKuchni;
  model?: PublicModel;
  zaznaczony: boolean;
  kolor: string;
  chropowatosc: number;
  blat: string;
  uchwyt: boolean;
  onWybierz?: (id: string) => void;
  otwarte: boolean;
  /** Boki i środek (kolory.ts) – wygląd z próbki; ids do modeli GLB. */
  korpus: { color: string; roughness: number };
  srodek: { color: string; roughness: number };
  ids: { front: string; korpus: string };
  /** Kreator: przeciąganie mebla w 3D. */
  onChwyt?: (e: ThreeEvent<PointerEvent>, el: ElementKuchni) => void;
  /** Podgląd przesuwanego mebla w złym miejscu – obrys na czerwono. */
  zly?: boolean;
}) {
  const y = yElementu(el, plan);
  const szafka = <AgdBryla el={el} kolor={kolor} chropowatosc={chropowatosc} blat={blat} uchwyt={uchwyt} otwarte={otwarte} korpus={korpus} srodek={srodek} />;
  return (
    <group
      position={[el.x / 100, y, el.z / 100]}
      rotation={[0, ((el.rot + (el.kat ?? 0)) * Math.PI) / 180, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onWybierz?.(el.id);
      }}
      onDoubleClick={(e) => {
        // Dwuklik otwiera albo zamyka ten jeden mebel (drzwi, szuflady).
        e.stopPropagation();
        przelaczElement(el.id);
      }}
      onPointerDown={
        onChwyt
          ? (e) => {
              e.stopPropagation();
              onChwyt(e, el);
            }
          : undefined
      }
    >
      <Obrys aktywny={zaznaczony || zly} kolor={zly ? "#e5484d" : undefined}>
        {model ? (
          <BladModelu fallback={szafka}>
            <Suspense fallback={szafka}>
              <ModelBryla model={model} w={el.w} h={el.h} d={el.d} otwarte={otwarte} kolorFrontu={ids.front} kolorKorpusu={ids.korpus} />
            </Suspense>
          </BladModelu>
        ) : (
          szafka
        )}
      </Obrys>
    </group>
  );
}

/** Przyłącze wody z kroku „Okna i instalacje” (okna i drzwi są otworami w ścianach – Sciany.tsx). */
function Otwory({ plan }: { plan: PlanKuchni }) {
  const wy = plan.wywiad;
  if (!wy?.woda) return null;
  return (
    <mesh position={wy.woda.sciana === "A" ? [wy.woda.od / 100, 0.5, 0.02] : [0.02, 0.5, wy.woda.od / 100]}>
      <sphereGeometry args={[0.025, 16, 12]} />
      <meshStandardMaterial color="#2f7fd1" roughness={0.3} />
    </mesh>
  );
}

type WyborInny = Exclude<Wybor3D, { typ: "element" }> | null;

function Wnetrze({
  plan: planWejscie,
  modele = [],
  zaznaczony,
  onWybierz,
  zdjecie,
  onUjecie,
  wymiary,
  edycjaOtworow,
  edycjaMebli,
  onPodgladMebla,
  tlo,
  wyborInny,
  setWyborInny,
}: Props & { tlo: TloSceny; wyborInny: WyborInny; setWyborInny: (w: WyborInny) => void }) {
  const { podglad: przesuwany, zacznij: chwyc } = usePrzeciaganieMebla(planWejscie, edycjaMebli, onPodgladMebla);
  // Wykonawca (kreator): zaznaczenie okna, drzwi albo ściany w 3D – pokazuje ich wymiary na żywo.
  const wykonawca = !!edycjaMebli || !!edycjaOtworow;
  const [podgladOtworu, setPodgladOtworu] = useState<{ i: number; o: Otwor } | null>(null);
  useEffect(() => {
    if (zaznaczony) setWyborInny(null);
  }, [zaznaczony, setWyborInny]);
  const wybierzElement = useCallback(
    (id: string) => {
      setWyborInny(null);
      onWybierz?.(id);
    },
    [onWybierz, setWyborInny],
  );
  // Podgląd przeciągania: mebel rysowany w nowym miejscu (wymiary i ściany liczą się z niego na żywo).
  const plan = useMemo(
    () => (przesuwany ? { ...planWejscie, elementy: planWejscie.elementy.map((e) => (e.id === przesuwany.id ? { ...e, x: przesuwany.x, z: przesuwany.z } : e)) } : planWejscie),
    [planWejscie, przesuwany],
  );
  // Wymiary liczą się też z przeciąganego okna / drzwi (podgląd z Sciany.tsx).
  const planWymiarow = useMemo(
    () =>
      podgladOtworu && plan.wywiad
        ? { ...plan, wywiad: { ...plan.wywiad, otwory: plan.wywiad.otwory.map((o, i) => (i === podgladOtworu.i ? podgladOtworu.o : o)) } }
        : plan,
    [plan, podgladOtworu],
  );
  // Przeciągany mebel ma swoje wymiary na żywo, nawet gdy nie jest zaznaczony.
  const wybor3d: Wybor3D = przesuwany ? { typ: "element", id: przesuwany.id } : (wyborInny ?? (zaznaczony ? { typ: "element", id: zaznaczony } : null));
  const front = useFront();
  const countertop = useCountertop();
  const hardware = useHardware();
  const palettes = usePalettes();
  const katalogMat = useKatalog();
  const invalidate = useThree((s) => s.invalidate);
  const wybor = { front, countertop, hardware };
  const wyglad = lookFor("front", wybor, palettes, katalogMat);
  const blatLook = lookFor("blat", wybor, palettes, katalogMat);
  const kolor = wyglad.color ?? "#c9bcaa";
  const blat = blatLook.color ?? BLAT[countertop] ?? "#ece8e1";
  const uchwyt = !lookFor("uchwyt", wybor, palettes, katalogMat).hidden;
  const katalog = useMemo(() => new Map(modele.map((m) => [m.id, m])), [modele]);
  const otwarcie = useOtwarcie();
  const projektKolory = useKoloryProjektu();
  // Wygląd próbki (kolor, połysk) – ta sama funkcja co front, dla boków i środka każdego mebla.
  const wygladProbki = (id: string) => {
    const l = id === front ? wyglad : lookFor("front", { ...wybor, front: id }, palettes, katalogMat);
    return { color: l.color ?? "#c9bcaa", roughness: l.roughness };
  };
  const { x0, x1, z0, z1 } = zakres(plan);

  useEffect(() => {
    invalidate();
  }, [invalidate, plan, front, countertop, hardware, palettes, katalogMat, zaznaczony, projektKolory]);

  return (
    <>
      <color attach="background" args={[tlo.tlo]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[4, 6, 3]} intensity={1.7} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-3, 3, -2]} intensity={0.35} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(x0 + x1) / 2, 0, (z0 + z1) / 2]} receiveShadow onClick={wykonawca ? () => setWyborInny(null) : undefined}>
        <planeGeometry args={[Math.max(1.2, x1 - x0 + 1.4), Math.max(1.2, z1 - z0 + 1.4)]} />
        <meshStandardMaterial color={tlo.podloga} roughness={0.95} />
      </mesh>
      {/* Ściany pokoju z otworami na okna i drzwi, w kolorze z planu albo wybranym (Sciany.tsx). */}
      <Sciany
        plan={plan}
        kolorDomyslny={tlo.sciana}
        edycja={edycjaOtworow}
        onWybierz={wykonawca ? (w) => setWyborInny(w) : undefined}
        onPodglad={(p) => {
          setPodgladOtworu(p);
          if (p) setWyborInny({ typ: "otwor", i: p.i });
        }}
      />
      <Otwory plan={plan} />
      <Suspense fallback={null}>
        {plan.elementy.map((el) => {
          const kol = koloryMebla(el, front, projektKolory);
          const fr = kol.front === front ? { color: kolor, roughness: wyglad.roughness } : wygladProbki(kol.front);
          return (
            <ElementWidok
              key={el.id}
              el={el}
              plan={plan}
              model={el.modelId ? katalog.get(el.modelId) : undefined}
              zaznaczony={zaznaczony === el.id}
              kolor={fr.color}
              chropowatosc={fr.roughness}
              blat={blat}
              uchwyt={uchwyt}
              onWybierz={wybierzElement}
              otwarte={otwarty(otwarcie, el.id)}
              korpus={wygladProbki(kol.korpus)}
              srodek={wygladProbki(kol.srodek)}
              ids={{ front: kol.front, korpus: kol.korpus }}
              onChwyt={edycjaMebli ? chwyc : undefined}
              zly={przesuwany?.id === el.id && !!przesuwany.zly}
            />
          );
        })}
      </Suspense>
      {wymiary || (wykonawca && wybor3d) ? <Wymiary3D plan={planWymiarow} wybor={wybor3d} przeglad={!!wymiary} /> : null}
      <ContactShadows position={[0, 0.001, 0]} opacity={0.35} scale={12} blur={2.4} far={2} />
      <Kamera plan={plan} />
      <Ujecie aktywne={!!zdjecie} onUjecie={onUjecie} />
      <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 - 0.04} minDistance={0.6} maxDistance={14} />
    </>
  );
}

/** Ciemne fronty → jasne tło sceny (tloSceny.ts); kolor frontu z tych samych magazynów co pasek materiałów. */
function useTloKuchni(): TloSceny {
  const front = useFront();
  const countertop = useCountertop();
  const hardware = useHardware();
  const palettes = usePalettes();
  const katalogMat = useKatalog();
  return tloDlaKoloru(lookFor("front", { front, countertop, hardware }, palettes, katalogMat).color ?? null);
}

export default function KuchniaScena(props: Props) {
  const tlo = useTloKuchni();
  // Zaznaczone okno, drzwi albo ściana (wykonawca) – klik w puste miejsce sceny czyści.
  const [wyborInny, setWyborInny] = useState<WyborInny>(null);
  return (
    <div className="absolute inset-0 h-full w-full" data-tlo={tlo.jasne ? "jasne" : "ciemne"} style={{ background: tlo.tlo }}>
      <Canvas
        shadows
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{ position: [2.4, 1.8, 3.2], fov: 42 }}
        gl={{ antialias: true, preserveDrawingBuffer: !!props.zdjecie }}
        onPointerMissed={(e) => {
          if (e.type === "click") setWyborInny(null);
        }}
      >
        <Wnetrze {...props} tlo={tlo} wyborInny={wyborInny} setWyborInny={setWyborInny} />
      </Canvas>
    </div>
  );
}
