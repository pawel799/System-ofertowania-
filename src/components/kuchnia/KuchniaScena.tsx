"use client";

import { DRACO } from "@/lib/draco";
import { Component, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, OrbitControls, useGLTF } from "@react-three/drei";
import { Box3, BufferAttribute, CanvasTexture, MeshStandardMaterial, PerspectiveCamera, Vector3, type Object3D } from "three";
import { konfliktElementow, nachodzi, przyciagnij, rect, wPokoju, type ElementKuchni, type PlanKuchni } from "@/lib/kuchnia";
import { meblaWOtworze } from "@/lib/otwory";
import { czyObrys, muryPokoju, podlogaPlanu, scianyPokoju, wGranicachPokoju, zakresPokoju, zasiegScian } from "@/lib/sciany";
import { panele, PLYTKA_PANELI, PLYTKA_PLYTEK, plytki, wielokatPoziomy } from "./teksturyPokoju";
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
import type { Otwor, PunktInstalacji } from "@/lib/wywiad";
import { tloDlaKoloru, tloMotywu, type TloSceny } from "../tloSceny";
import { useJasnaStrona } from "@/lib/motyw";
import { dopasuj, Obrys, useUchwytModelu } from "./obrys";
import { useRuch } from "./MebelParametryczny";
import { przygotujRuchome, ustawOtwarcie } from "./ruchomeGlb";
import { otwarty, przelaczElement, useOtwarcie } from "./otwarcieStore";
import { useKoloryProjektu } from "../koloryStore";
import PaletaSciany, { type EdycjaKolorowScian } from "./PaletaSciany";
import Sciany, { type EdycjaOtworow } from "./Sciany";
import { koloryMebla, uchwytMebla } from "@/lib/kolory";

/** Zdjęcia do PDF oferty: kilka ujęć całości i każdy mebel osobno (klucz: id elementu). */
/** glowne – najlepszy kadr całości (szeroki, na pierwszą stronę PDF); widoki – kilka ujęć; elementy – każdy mebel osobno. */
export type ZdjeciaOferty = { glowne?: string; widoki: { nazwa: string; jpeg: string }[]; elementy: Record<string, string> };
export type KuchniaUjecie = { jpeg: () => string | null; zdjecia?: () => ZdjeciaOferty | null };

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
  /** Ile pikseli od dołu sceny zasłania nakładka (strona klienta na komputerze: pasek materiałów) – kadr nad nią. */
  zasloniete?: number;
  /** Ile pikseli od góry zasłania pasek przycisków (kreator) – model kadrowany niżej, pod paskiem. */
  zaslonieteGora?: number;
  /** Kreator: kliknięta ściana dostaje własny kolor (okienko nad sceną). */
  edycjaKolorow?: EdycjaKolorowScian;
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
      const przyW = wGranicachPokoju(pl, rect({ ...oryginal, x: przyc.x, z: przyc.z }), przyc.x, przyc.z);
      // Nigdy przez ścianę: ślizganie po ścianie albo ostatnie dobre miejsce.
      const przy = wPokoju(pl, oryginal, przyW, teraz ? { x: teraz.x, z: teraz.z } : { x: oryginal.x, z: oryginal.z });
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

/**
 * Podłoga pokoju: panele albo płytki (kolor do wyboru) w obrysie pokoju (prostokąt – razem z grubością ścian), UV w metrach.
 * Krawędź, przy której nie stoi ściana (pokój bez wymiarów, otwarta przestrzeń), łagodnie przechodzi w tło.
 */
function PodlogaPokoju({ plan, onClick }: { plan: PlanKuchni; onClick?: () => void }) {
  const { punkty, zanik } = useMemo(() => {
    if (czyObrys(plan)) return { punkty: plan.sciany!.obrys!, zanik: null };
    const z = zakresPokoju(plan);
    const m = muryPokoju(plan).flatMap((x) => x.punkty);
    let x0 = Math.min(z.x0, ...m.map((q) => q.x));
    const z0 = Math.min(z.z0, ...m.map((q) => q.z));
    let x1 = Math.max(z.x1, ...m.map((q) => q.x));
    let z1 = Math.max(z.z1, ...m.map((q) => q.z));
    // Która krawędź ma ścianę (ściana leży wzdłuż niej, z tolerancją na grubość).
    const sc = scianyPokoju(plan);
    const wzdluz = (os: "x" | "z", v: number) => sc.some((s) => (os === "x" ? Math.abs(s.dx) < 0.01 && Math.abs(s.x - v) < 40 : Math.abs(s.dz) < 0.01 && Math.abs(s.z - v) < 40));
    const lewa = wzdluz("x", 0);
    const prawa = wzdluz("x", z.x1);
    const tyl = wzdluz("z", 0);
    const przod = wzdluz("z", z.z1);
    // Bez ściany: podłoga trochę dalej, potem zanika.
    if (!lewa) x0 -= 80;
    if (!prawa) x1 += 80;
    if (!przod) z1 = Math.max(z1 + 60, 360);
    return {
      punkty: [
        { x: x0, z: z0 },
        { x: x1, z: z0 },
        { x: x1, z: z1 },
        { x: x0, z: z1 },
      ],
      zanik: lewa && prawa && tyl && przod ? null : { lewa: !lewa, prawa: !prawa, tyl: !tyl, przod: !przod, w: x1 - x0, d: z1 - z0 },
    };
  }, [plan]);
  const klucz = punkty.map((p) => `${p.x},${p.z}`).join(";");
  const plytka = podlogaPlanu(plan).rodzaj === "plytki" ? PLYTKA_PLYTEK : PLYTKA_PANELI;
  const geo = useMemo(() => {
    const g = wielokatPoziomy(punkty, plytka);
    // Drugi zestaw UV (0–1 na całej podłodze) – dla mapy zanikania krawędzi.
    const pos = g.getAttribute("position");
    const xs = punkty.map((p) => p.x / 100);
    const zs = punkty.map((p) => p.z / 100);
    const [X0, X1, Z0, Z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    const uv1 = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv1[i * 2] = (pos.getX(i) - X0) / Math.max(0.01, X1 - X0);
      uv1[i * 2 + 1] = (-pos.getY(i) - Z0) / Math.max(0.01, Z1 - Z0);
    }
    g.setAttribute("uv1", new BufferAttribute(uv1, 2));
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [klucz, plytka]);
  useEffect(() => () => geo.dispose(), [geo]);
  const { rodzaj, kolor } = podlogaPlanu(plan);
  const zanikKlucz = zanik ? JSON.stringify(zanik) : "";
  const alpha = useMemo(() => {
    if (!zanik) return null;
    const N = 256;
    const c = document.createElement("canvas");
    c.width = c.height = N;
    const g = c.getContext("2d")!;
    const img = g.createImageData(N, N);
    // Pas zanikania ok. 1 m (nie więcej niż 40% wymiaru).
    const fu = Math.min(0.4, 100 / zanik.w);
    const fv = Math.min(0.4, 100 / zanik.d);
    const gladko = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const u = x / (N - 1);
        const v = y / (N - 1);
        let a = 1;
        if (zanik.lewa) a = Math.min(a, gladko(u / fu));
        if (zanik.prawa) a = Math.min(a, gladko((1 - u) / fu));
        if (zanik.tyl) a = Math.min(a, gladko(v / fv));
        if (zanik.przod) a = Math.min(a, gladko((1 - v) / fv));
        const k = Math.round(a * 255);
        const o = (y * N + x) * 4;
        img.data[o] = img.data[o + 1] = img.data[o + 2] = k;
        img.data[o + 3] = 255;
      }
    g.putImageData(img, 0, 0);
    const t = new CanvasTexture(c);
    t.channel = 1;
    t.flipY = false;
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zanikKlucz]);
  useEffect(() => () => alpha?.dispose(), [alpha]);
  // Panele albo płytki; tekstura w odcieniach szarości, kolor z wyboru (sciany.podloga). Płytki lekko błyszczą.
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        map: rodzaj === "plytki" ? plytki() : panele(),
        color: kolor,
        roughness: rodzaj === "plytki" ? 0.42 : 0.72,
        ...(alpha ? { alphaMap: alpha, transparent: true } : {}),
      }),
    [rodzaj, kolor, alpha],
  );
  useEffect(() => () => material.dispose(), [material]);
  return <mesh name="podloga" geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} material={material} receiveShadow onClick={onClick} />;
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
  // Podłoga rośnie razem ze ścianami: kształt pokoju, grubość ścian i ścianki działowe (też poza pokojem).
  const sc = zasiegScian(plan);
  x0 = Math.min(x0, sc.x0 / 100);
  z0 = Math.min(z0, sc.z0 / 100);
  x1 = Math.max(x1, sc.x1 / 100);
  z1 = Math.max(z1, sc.z1 / 100);
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

/**
 * Część sceny zasłonięta od dołu (pasek materiałów na stronie klienta): środek obrazu przesuwa się nad nią
 * (setViewOffset – płótno jest dolnym wycinkiem wyższego obrazu), więc mebel nie chowa się pod paskiem.
 */
function Zasloniecie({ px, gora = 0 }: { px: number; gora?: number }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const w = useThree((s) => s.size.width);
  const h = useThree((s) => s.size.height);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    const z = Math.max(0, Math.min(Math.round(px / 8) * 8, Math.round(h * 0.6)));
    // Zasłonięta góra (pasek przycisków nad sceną w kreatorze): płótno to górny wycinek wyższego obrazu –
    // środek obrazu schodzi w dół, model stoi na środku odsłoniętej części.
    const g = Math.max(0, Math.min(Math.round(gora / 8) * 8, Math.round(h * 0.4)));
    if (z > 0 || g > 0) {
      camera.aspect = w / (h + z + g);
      camera.setViewOffset(w, h + z + g, 0, z, w, h);
    } else {
      camera.aspect = w / Math.max(1, h);
      camera.clearViewOffset();
    }
    camera.updateProjectionMatrix();
    invalidate();
  }, [px, gora, w, h, camera, invalidate]);
  return null;
}

function Kamera({ plan, zasloniete = 0, gora = 0 }: { plan: PlanKuchni; zasloniete?: number; gora?: number }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const controls = useThree((s) => s.controls) as { target: Vector3; update: () => void } | null;
  const w = useThree((s) => s.size.width);
  const h = useThree((s) => Math.max(1, s.size.height));
  const aspect = w / h;
  // Zasłonięty dół (Zasloniecie): kadrujemy tak, żeby wszystko zmieściło się w odsłoniętej części.
  const z = Math.max(0, Math.min(Math.round(zasloniete / 8) * 8, Math.round(h * 0.6)));
  const g = Math.max(0, Math.min(Math.round(gora / 8) * 8, Math.round(h * 0.4)));
  const invalidate = useThree((s) => s.invalidate);
  const sygnatura = `${plan.uklad}:${plan.scianaA}:${plan.scianaB}:${plan.pomieszczenie?.szer ?? 0}x${plan.pomieszczenie?.dlug ?? 0}:${plan.elementy.map((e) => e.id).join(",")}`;
  useLayoutEffect(() => {
    const { x0, x1, z0, z1, y1 } = zakres(plan);
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const target = new Vector3(cx, y1 * 0.38, cz);
    const radius = Math.max(x1 - x0, z1 - z0, y1, 1) * 0.62;
    const tanV = Math.tan((camera.fov * Math.PI) / 360);
    const pelna = h + z + g;
    const half = Math.atan(Math.min((tanV * (h - z - g)) / pelna, (tanV * w) / pelna));
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
  }, [sygnatura, aspect, z, g, camera, controls, invalidate]);
  return null;
}

/** Kadr z płótna 3D: przycięty do proporcji i zmniejszony (lżejszy PDF). */
function kadr(zrodlo: HTMLCanvasElement, proporcja: number, maxW: number) {
  const W = zrodlo.width;
  const H = zrodlo.height;
  let w = W;
  let h = Math.round(W / proporcja);
  if (h > H) {
    h = H;
    w = Math.round(H * proporcja);
  }
  const skala = Math.min(1, maxW / w);
  const c = document.createElement("canvas");
  c.width = Math.round(w * skala);
  c.height = Math.round(h * skala);
  const ctx = c.getContext("2d");
  if (!ctx) return zrodlo.toDataURL("image/jpeg", 0.8);
  ctx.drawImage(zrodlo, (W - w) / 2, (H - h) / 2, w, h, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.82);
}

/**
 * Zdjęcia sceny: jpeg() – bieżący widok; zdjecia() – ujęcia do PDF (z przodu, z boku, z góry) i każdy mebel osobno
 * (pozostałe meble, ściany i wymiary ukryte na czas zdjęcia, kamera na wprost frontu). Po zdjęciach wszystko wraca.
 */
function Ujecie({ aktywne, onUjecie, plan }: { aktywne: boolean; onUjecie?: (u: KuchniaUjecie | null) => void; plan: PlanKuchni }) {
  const gl = useThree((s) => s.gl);
  const advance = useThree((s) => s.advance);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const controls = useThree((s) => s.controls) as { target: Vector3; update: () => void } | null;
  const invalidate = useThree((s) => s.invalidate);
  const planRef = useRef(plan);
  planRef.current = plan;
  useEffect(() => {
    if (!aktywne || !onUjecie) return;
    const zdjecia = (): ZdjeciaOferty | null => {
      const p = planRef.current;
      if (!p.elementy.length) return null;
      const pozycja = camera.position.clone();
      const kwaternion = camera.quaternion.clone();
      const cel = controls?.target.clone() ?? null;
      const ukryte: Object3D[] = [];
      const ukryj = (o: Object3D | undefined) => {
        if (o && o.visible) {
          o.visible = false;
          ukryte.push(o);
        }
      };
      const aspekt = gl.domElement.width / Math.max(1, gl.domElement.height);
      /** Ile szerokości / wysokości płótna (w NDC) zostaje po wycięciu kadru o danej proporcji (kadr()). */
      const okno = (proporcja: number) => (aspekt >= proporcja ? { x: proporcja / aspekt, y: 1 } : { x: 1, y: aspekt / proporcja });
      const rogi = (b: Box3) => {
        const out: Vector3[] = [];
        for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) out.push(new Vector3(x, y, z));
        return out;
      };
      const ustaw = (poz: Vector3, patrz: Vector3) => {
        camera.position.copy(poz);
        camera.lookAt(patrz);
        camera.updateMatrixWorld();
      };
      /** Rzut punktów w kadrze: zasięg w NDC (−1…1 kadru) albo null, gdy coś jest za kamerą. */
      const zasieg = (pkt: Vector3[], o: { x: number; y: number }) => {
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const p of pkt) {
          const v = p.clone().applyMatrix4(camera.matrixWorldInverse);
          if (v.z > -camera.near) return null;
          v.applyMatrix4(camera.projectionMatrix);
          x0 = Math.min(x0, v.x / o.x); x1 = Math.max(x1, v.x / o.x);
          y0 = Math.min(y0, v.y / o.y); y1 = Math.max(y1, v.y / o.y);
        }
        return { x0, x1, y0, y1 };
      };
      /**
       * Kamera w kierunku `kier` od celu, tak blisko, jak się da, żeby całe pudełko mieściło się w kadrze z marginesem
       * (szukanie połówkowe po odległości). Zwraca wypełnienie kadru (0…1) – im większe, tym lepszy kadr.
       */
      const dopasuj = (pudlo: Box3, kier: Vector3, proporcja: number, margines = 0.86) => {
        const cel = pudlo.getCenter(new Vector3());
        const pkt = rogi(pudlo);
        const o = okno(proporcja);
        const miesci = (d: number) => {
          ustaw(cel.clone().addScaledVector(kier, d), cel);
          const z = zasieg(pkt, o);
          return z && z.x0 >= -margines && z.x1 <= margines && z.y0 >= -margines && z.y1 <= margines ? z : null;
        };
        let lo = 0.2;
        let hi = 60;
        for (let i = 0; i < 22; i++) {
          const mid = (lo + hi) / 2;
          if (miesci(mid)) hi = mid;
          else lo = mid;
        }
        const z = miesci(hi);
        // Środek kadru na środku rzutu (pudełko w perspektywie nie jest symetryczne) – przesunięcie celu.
        if (z) {
          const dx = (z.x0 + z.x1) / 2;
          const dy = (z.y0 + z.y1) / 2;
          const prawo = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
          const gora = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
          const tanV = Math.tan((camera.fov * Math.PI) / 360);
          const sh = cel.clone().addScaledVector(prawo, dx * tanV * camera.aspect * o.x * hi).addScaledVector(gora, dy * tanV * o.y * hi);
          ustaw(sh.clone().addScaledVector(kier, hi), sh);
        }
        return { wypelnienie: z ? ((z.x1 - z.x0) * (z.y1 - z.y0)) / 4 : 0, poz: camera.position.clone(), cel: camera.getWorldDirection(new Vector3()).add(camera.position) };
      };
      // Ściany między kamerą a pokojem obniżone do cokołu (jak w podglądzie) – nic nie zasłania mebli.
      const sciany = scianyPokoju(p);
      const stanScian = sciany.map((sc) => {
        const g = scene.getObjectByName(`sciana-${sc.id}`);
        return { sc, pelna: g?.children[0], cokol: g?.children[1], v: [g?.children[0]?.visible, g?.children[1]?.visible] as const };
      });
      const przytnij = (poz: Vector3) => {
        for (const { sc, pelna, cokol } of stanScian) {
          const zew = (poz.x * 100 - sc.x) * sc.nx + (poz.z * 100 - sc.z) * sc.nz < 0;
          if (pelna) pelna.visible = !zew;
          if (cokol) cokol.visible = zew;
        }
      };
      const zrob = (poz: Vector3, patrz: Vector3, proporcja: number, maxW: number) => {
        ustaw(poz, patrz);
        przytnij(poz);
        gl.render(scene, camera);
        return kadr(gl.domElement, proporcja, maxW);
      };
      const kierunek = (azymut: number, wzniesienie: number) =>
        new Vector3(Math.sin(azymut) * Math.cos(wzniesienie), Math.sin(wzniesienie), Math.cos(azymut) * Math.cos(wzniesienie));
      try {
        const meble = new Box3();
        const grupy = new Map<string, Object3D>();
        // Kierunek, w którym patrzą fronty (ważony szerokością mebla) – najlepszy kadr widzi fronty.
        const fronty = new Vector3();
        for (const e of p.elementy) {
          const g = scene.getObjectByName(`el-${e.id}`);
          if (!g) continue;
          grupy.set(e.id, g);
          meble.expandByObject(g);
          const kat = ((e.rot + (e.kat ?? 0)) * Math.PI) / 180;
          fronty.add(new Vector3(Math.sin(kat), 0, Math.cos(kat)).multiplyScalar(e.w));
        }
        if (meble.isEmpty()) return null;
        if (fronty.lengthSq() < 1e-6) fronty.set(0, 0, 1);
        fronty.normalize();
        ukryj(scene.getObjectByName("wymiary"));
        // Kandydaci: co 10° dookoła, dwa wzniesienia. Ocena: jak bardzo widać fronty i jak wypełniony jest kadr.
        const SZEROKI = 2.4;
        const proporcja = 4 / 3;
        type Kadr = { az: number; ocena: number; poz: Vector3; cel: Vector3 };
        const kandydaci: Kadr[] = [];
        for (let st = 0; st < 360; st += 10) {
          const az = (st * Math.PI) / 180;
          for (const wz of [0.3, 0.45]) {
            const k = kierunek(az, wz);
            const naFronty = new Vector3(k.x, 0, k.z).normalize().dot(fronty);
            if (naFronty < 0.2) continue;
            const d = dopasuj(meble, k, proporcja);
            kandydaci.push({ az, ocena: naFronty * 0.55 + d.wypelnienie * 0.45 + (wz === 0.3 ? 0.03 : 0), poz: d.poz, cel: d.cel });
          }
        }
        kandydaci.sort((a, b) => b.ocena - a.ocena);
        const widoki: ZdjeciaOferty["widoki"] = [];
        let glowne: string | undefined;
        const najlepszy = kandydaci[0];
        if (najlepszy) {
          // Kadr główny: szeroki, z tego samego kierunku co najlepszy.
          const kg = new Vector3().subVectors(najlepszy.poz, najlepszy.cel).normalize();
          const dg = dopasuj(meble, kg, SZEROKI, 0.9);
          glowne = zrob(dg.poz, dg.cel, SZEROKI, 1600);
          widoki.push({ nazwa: "Widok główny", jpeg: zrob(najlepszy.poz, najlepszy.cel, proporcja, 1100) });
          // Dwa kolejne najlepsze kadry z wyraźnie innych stron (różnica kierunku co najmniej 40°).
          const roznica = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
          const wybrane = [najlepszy];
          for (const k of kandydaci) {
            if (wybrane.length >= 3) break;
            if (wybrane.every((w) => roznica(w.az, k.az) >= (40 * Math.PI) / 180)) wybrane.push(k);
          }
          for (const k of wybrane.slice(1)) {
            const strona = Math.sin(k.az - najlepszy.az) < 0 ? "Z prawej" : "Z lewej";
            widoki.push({ nazwa: strona, jpeg: zrob(k.poz, k.cel, proporcja, 1100) });
          }
        }
        // Z góry: ściany jako niski mur (widać kształt pokoju), kadr dopasowany do mebli.
        const gora = dopasuj(meble, new Vector3(0, 1, 0.08).normalize(), proporcja);
        widoki.push({ nazwa: "Z góry", jpeg: zrob(gora.poz, gora.cel, proporcja, 1100) });
        ukryj(scene.getObjectByName("sciany"));
        ukryj(scene.getObjectByName("woda"));
        // Każdy mebel osobno: reszta i ściany ukryte, na wprost frontu, lekko z góry i z boku, kadr dopasowany.
        const elementy: Record<string, string> = {};
        for (const e of p.elementy) {
          const g = grupy.get(e.id);
          if (!g) continue;
          const inne: Object3D[] = [];
          grupy.forEach((o, id) => {
            if (id !== e.id && o.visible) {
              o.visible = false;
              inne.push(o);
            }
          });
          const box = new Box3().setFromObject(g);
          const kat = ((e.rot + (e.kat ?? 0)) * Math.PI) / 180;
          const k = kierunek(kat + 0.35, 0.28);
          const d = dopasuj(box, k, proporcja, 0.8);
          elementy[e.id] = zrob(d.poz, d.cel, proporcja, 560);
          inne.forEach((o) => (o.visible = true));
        }
        return { glowne, widoki, elementy };
      } catch {
        return null;
      } finally {
        stanScian.forEach(({ pelna, cokol, v }) => {
          if (pelna) pelna.visible = !!v[0];
          if (cokol) cokol.visible = !!v[1];
        });
        ukryte.forEach((o) => (o.visible = true));
        camera.position.copy(pozycja);
        camera.quaternion.copy(kwaternion);
        camera.updateMatrixWorld();
        if (controls && cel) {
          controls.target.copy(cel);
          controls.update();
        }
        invalidate();
      }
    };
    onUjecie({
      jpeg: () => {
        try {
          advance(performance.now(), true);
          return gl.domElement.toDataURL("image/jpeg", 0.72);
        } catch {
          return null;
        }
      },
      zdjecia,
    });
    return () => onUjecie(null);
  }, [aktywne, advance, gl, onUjecie, scene, camera, controls, invalidate]);
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
  kolorUchwytu,
}: {
  model: PublicModel;
  w: number;
  h: number;
  d: number;
  otwarte?: boolean;
  /** Kolory tego mebla (kolory.ts): front i boki; brak = wybór z paska materiałów. */
  kolorFrontu?: string;
  kolorKorpusu?: string;
  /** Okucia tego mebla (id); brak = okucia oferty. */
  kolorUchwytu?: string;
}) {
  const { scene } = useGLTF(model.url, DRACO, true);
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
  const hardwareWspolny = useHardware();
  const hardware = kolorUchwytu ?? hardwareWspolny;
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
  ids: { front: string; korpus: string; uchwyt: string; uchwytKolor?: string };
  /** Kreator: przeciąganie mebla w 3D. */
  onChwyt?: (e: ThreeEvent<PointerEvent>, el: ElementKuchni) => void;
  /** Podgląd przesuwanego mebla w złym miejscu – obrys na czerwono. */
  zly?: boolean;
}) {
  const y = yElementu(el, plan);
  const szafka = <AgdBryla el={el} kolor={kolor} chropowatosc={chropowatosc} blat={blat} uchwyt={uchwyt} otwarte={otwarte} korpus={korpus} srodek={srodek} kolorUchwytu={ids.uchwytKolor} />;
  return (
    <group
      name={`el-${el.id}`}
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
              <ModelBryla model={model} w={el.w} h={el.h} d={el.d} otwarte={otwarte} kolorFrontu={ids.front} kolorKorpusu={ids.korpus} kolorUchwytu={ids.uchwyt} />
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
    <mesh name="woda" position={wy.woda.sciana === "A" ? [wy.woda.od / 100, 0.5, 0.02] : [0.02, 0.5, wy.woda.od / 100]}>
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
  zasloniete,
  zaslonieteGora,
  wyborInny,
  setWyborInny,
}: Props & { tlo: TloSceny; wyborInny: WyborInny; setWyborInny: (w: WyborInny) => void }) {
  const { podglad: przesuwany, zacznij: chwyc } = usePrzeciaganieMebla(planWejscie, edycjaMebli, onPodgladMebla);
  // Wykonawca (kreator): zaznaczenie okna, drzwi albo ściany w 3D – pokazuje ich wymiary na żywo.
  const wykonawca = !!edycjaMebli || !!edycjaOtworow;
  const [podgladOtworu, setPodgladOtworu] = useState<{ i: number; o: Otwor } | null>(null);
  const [podgladPunktu, setPodgladPunktu] = useState<{ i: number; p: PunktInstalacji } | null>(null);
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
  const planWymiarow = useMemo(() => {
    if (!plan.wywiad || (!podgladOtworu && !podgladPunktu)) return plan;
    const w = plan.wywiad;
    return {
      ...plan,
      wywiad: {
        ...w,
        otwory: podgladOtworu ? w.otwory.map((o, i) => (i === podgladOtworu.i ? podgladOtworu.o : o)) : w.otwory,
        punkty: podgladPunktu ? (w.punkty ?? []).map((p, i) => (i === podgladPunktu.i ? podgladPunktu.p : p)) : w.punkty,
      },
    };
  }, [plan, podgladOtworu, podgladPunktu]);
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
      {/* Podłoże w kolorze tła (nic nie wisi w pustce, cienie mają na czym paść) i podłoga pokoju z paneli. */}
      {/* Podłoże dokładnie w kolorze tła (bez linii horyzontu) + warstwa samych cieni. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(x0 + x1) / 2, -0.004, (z0 + z1) / 2]} onClick={wykonawca ? () => setWyborInny(null) : undefined}>
        <planeGeometry args={[Math.max(60, (x1 - x0) * 8), Math.max(60, (z1 - z0) * 8)]} />
        <meshBasicMaterial color={tlo.tlo} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(x0 + x1) / 2, -0.002, (z0 + z1) / 2]} receiveShadow>
        <planeGeometry args={[Math.max(12, (x1 - x0) * 3), Math.max(12, (z1 - z0) * 3)]} />
        <shadowMaterial opacity={tlo.jasne ? 0.14 : 0.3} />
      </mesh>
      <PodlogaPokoju plan={plan} onClick={wykonawca ? () => setWyborInny(null) : undefined} />
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
        onPodgladPunktu={(p) => {
          setPodgladPunktu(p);
          if (p) setWyborInny({ typ: "punkt", i: p.i });
        }}
      />
      <Otwory plan={plan} />
      <Suspense fallback={null}>
        {plan.elementy.map((el) => {
          const kol = koloryMebla(el, front, projektKolory);
          // Okucia tego mebla (okno elementu) – widoczność i kolor uchwytu.
          const uId = uchwytMebla(el, hardware);
          const uLook = uId !== hardware ? lookFor("uchwyt", { ...wybor, hardware: uId }, palettes, katalogMat) : null;
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
              uchwyt={uLook ? !uLook.hidden : uchwyt}
              onWybierz={wybierzElement}
              otwarte={otwarty(otwarcie, el.id)}
              korpus={wygladProbki(kol.korpus)}
              srodek={wygladProbki(kol.srodek)}
              ids={{ front: kol.front, korpus: kol.korpus, uchwyt: uId, uchwytKolor: uLook?.color }}
              onChwyt={edycjaMebli ? chwyc : undefined}
              zly={przesuwany?.id === el.id && !!przesuwany.zly}
            />
          );
        })}
      </Suspense>
      {wymiary || (wykonawca && wybor3d) ? <Wymiary3D plan={planWymiarow} wybor={wybor3d} przeglad={!!wymiary} /> : null}
      <ContactShadows position={[0, 0.001, 0]} opacity={0.35} scale={12} blur={2.4} far={2} />
      <Kamera plan={plan} zasloniete={zasloniete} gora={zaslonieteGora} />
      <Zasloniecie px={zasloniete ?? 0} gora={zaslonieteGora} />
      <Ujecie aktywne={!!zdjecie} onUjecie={onUjecie} plan={plan} />
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
  const jasnyMotyw = useJasnaStrona();
  return tloMotywu(tloDlaKoloru(lookFor("front", { front, countertop, hardware }, palettes, katalogMat).color ?? null), jasnyMotyw);
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
      {props.edycjaKolorow && (wyborInny?.typ === "sciana" || wyborInny?.typ === "scianka") ? (
        <div style={{ position: "absolute", left: 12, bottom: 12, zIndex: 5 }}>
          {wyborInny.typ === "sciana" ? (
            <PaletaSciany
              className="kr-sciany-panel"
              tytul={`Ściana ${wyborInny.id}`}
              kolor={props.plan.sciany?.koloryScian?.[wyborInny.id] ?? null}
              onKolor={(k) => props.edycjaKolorow!.onSciana(wyborInny.id, k)}
              onZamknij={() => setWyborInny(null)}
            />
          ) : (
            <PaletaSciany
              className="kr-sciany-panel"
              tytul={`Ścianka ${wyborInny.i + 1}`}
              kolor={props.plan.sciany?.dodatkowe?.[wyborInny.i]?.kolor ?? null}
              onKolor={(k) => props.edycjaKolorow!.onScianka(wyborInny.i, k)}
              onZamknij={() => setWyborInny(null)}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
