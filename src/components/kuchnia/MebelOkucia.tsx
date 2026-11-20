"use client";

/*
 * Meble, w których najważniejsze są okucia: cargo (dolne i wysokie) i narożnik typu LeMans. Własna, uproszczona geometria
 * (prostopadłościany), bez modeli i wyglądu konkretnych producentów.
 *
 * Kosze całego mebla są sklejone w jedną geometrię (jedno wywołanie rysowania), żeby kuchnia z kilkoma
 * cargo nie spowalniała sceny. Początek układu jak w MebelParametryczny: środek podstawy, front w +Z, metry.
 */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { lemansElementu, type ElementKuchni } from "@/lib/kuchnia";
import { podzialLemans } from "@/lib/lemans";
import { cargoWysokie, koszeCargoWysokiego } from "@/lib/okucia";
import { Box, GAP, KAT_DRZWI, PLECY, Przesuw, T, useMaterialyMebla, useRuch, Zawias, type KoloryBryly } from "./MebelParametryczny";

type Klocek = { s: [number, number, number]; p: [number, number, number] };

/** Jedna geometria z wielu prostopadłościanów (pręty i dna koszy). */
function useSklejone(klocki: Klocek[], klucz: string) {
  const geo = useMemo(() => {
    if (!klocki.length) return null;
    const czesci = klocki.map((k) => new THREE.BoxGeometry(...k.s).translate(...k.p));
    const g = mergeGeometries(czesci, false);
    czesci.forEach((c) => c.dispose());
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [klucz]);
  useEffect(() => () => geo?.dispose(), [geo]);
  return geo;
}

/** Materiał koszy: jasny, półmatowy (pełny metal bez mapy otoczenia wychodzi w scenie prawie czarny). */
function useDrut() {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#c4c8cd", metalness: 0.35, roughness: 0.45 }), []);
  useEffect(() => () => mat.dispose(), [mat]);
  return mat;
}

/** Kosz z drutu w uproszczeniu: dno, dwa boki i dwie poprzeczki (przód, tył). */
function kosz(out: Klocek[], szer: number, gl: number, y: number, zSrodek: number, h = 0.08) {
  const g = 0.006;
  out.push({ s: [szer, g, gl], p: [0, y, zSrodek] });
  out.push({ s: [g, h, gl], p: [-szer / 2 + g / 2, y + h / 2, zSrodek] });
  out.push({ s: [g, h, gl], p: [szer / 2 - g / 2, y + h / 2, zSrodek] });
  out.push({ s: [szer, h, g], p: [0, y + h / 2, zSrodek + gl / 2 - g / 2] });
  out.push({ s: [szer, h, g], p: [0, y + h / 2, zSrodek - gl / 2 + g / 2] });
}

/** Korpus bez półek: boki, wieniec dolny i górny, plecy (jak MebelParametryczny). */
function korpusBez(m: { korpus: THREE.Material; plecy: THREE.Material }, W: number, H: number, D: number) {
  const dK = D - PLECY;
  const zK = PLECY / 2;
  return [
    <Box key="bl" m={m.korpus} s={[T, H, dK]} p={[-W / 2 + T / 2, H / 2, zK]} />,
    <Box key="bp" m={m.korpus} s={[T, H, dK]} p={[W / 2 - T / 2, H / 2, zK]} />,
    <Box key="wd" m={m.korpus} s={[W - 2 * T, T, dK]} p={[0, T / 2, zK]} />,
    <Box key="wg" m={m.korpus} s={[W - 2 * T, T, dK]} p={[0, H - T / 2, zK]} />,
    <Box key="pl" m={m.plecy} s={[W, H, PLECY]} p={[0, H / 2, -D / 2 + PLECY / 2]} />,
  ];
}

/**
 * Cargo: front na całą wysokość wyjeżdża na wprost razem ze stelażem i koszami.
 * Dolne – 2 kosze, wysokie (słupek) – 5 albo 6 (koszeCargoWysokiego).
 */
export function CargoBryla({ el, uchwyt, otwarte = false, ...kolory }: { el: ElementKuchni; uchwyt: boolean; otwarte?: boolean } & KoloryBryly) {
  const { m, frontMat, metal } = useMaterialyMebla(kolory);
  const drut = useDrut();
  const W = el.w / 100;
  const H = el.h / 100;
  const D = el.d / 100;
  const wysokie = cargoWysokie(el);
  const dK = D - PLECY;
  const zFront = D / 2 + T / 2 + 0.001;
  const wew = W - 2 * T;
  const szerKosza = Math.max(0.06, wew - 0.03);
  const glKosza = dK - 0.08;
  const zKosza = PLECY / 2 + 0.01;
  const ile = wysokie ? koszeCargoWysokiego(el.h) : 2;
  const klucz = `${W}|${H}|${D}|${ile}`;
  const klocki = useMemo(() => {
    const out: Klocek[] = [];
    const od = T + 0.06;
    const doo = H - T - (wysokie ? 0.22 : 0.2);
    for (let i = 0; i < ile; i++) kosz(out, szerKosza, glKosza, od + ((doo - od) * i) / (ile - 1), zKosza, wysokie ? 0.1 : 0.09);
    // Stelaż: słupek za frontem i z tyłu, łączy kosze z frontem.
    const sl = H - 2 * T - 0.04;
    out.push({ s: [0.012, sl, 0.012], p: [0, H / 2, zKosza + glKosza / 2 + 0.012] });
    out.push({ s: [0.012, sl, 0.012], p: [0, H / 2, zKosza - glKosza / 2 - 0.006] });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [klucz]);
  const geo = useSklejone(klocki, klucz);
  const fh = H - 2 * GAP;
  const fw = W - 2 * GAP;
  return (
    <group>
      {korpusBez(m, W, H, D)}
      <Przesuw o={[0, 0, dK * 0.85]} otwarte={otwarte}>
        <Box m={frontMat} s={[fw, fh, T]} p={[0, H / 2, zFront]} />
        {geo ? <mesh geometry={geo} material={drut} castShadow receiveShadow /> : null}
        {uchwyt ? (
          wysokie ? (
            <Box m={metal} s={[0.012, Math.min(0.5, fh * 0.3), 0.012]} p={[0, Math.min(1.1, H / 2), zFront + T / 2 + 0.012]} />
          ) : (
            <Box m={metal} s={[Math.min(0.16, fw * 0.6), 0.012, 0.012]} p={[0, H - 0.05, zFront + T / 2 + 0.012]} />
          )
        ) : null}
      </Przesuw>
    </group>
  );
}

/** Kosz „nerka” w rzucie: wydłużony owal z lekko wklęsłym bokiem od strony zawiasu (plaszczyzna XZ, środek w 0). */
function ksztaltNerki(L: number, G: number) {
  const r = G / 2;
  const s = new THREE.Shape();
  s.moveTo(-L / 2 + r, -r);
  s.quadraticCurveTo(0, -r * 0.55, L / 2 - r, -r);
  s.absarc(L / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(-L / 2 + r, r);
  s.absarc(-L / 2 + r, 0, r, Math.PI / 2, (3 * Math.PI) / 2, false);
  return s;
}

/** Dno i burta kosza na wysokości y (jedna geometria na poziom; wszystkie poziomy potem sklejone). */
function poziomNerki(L: number, G: number, y: number) {
  const ks = ksztaltNerki(L, G);
  const dno = new THREE.ExtrudeGeometry(ks, { depth: 0.006, bevelEnabled: false, curveSegments: 10 });
  const burta = new THREE.Shape(ks.getPoints(10));
  const wew = ksztaltNerki(L - 0.016, G - 0.016).getPoints(10);
  burta.holes.push(new THREE.Path(wew));
  const rant = new THREE.ExtrudeGeometry(burta, { depth: 0.06, bevelEnabled: false, curveSegments: 10 });
  // Kształt w XY, wyciągnięcie w +Z → obrót: dno leży w XZ, wyciągnięcie w górę.
  for (const g of [dno, rant]) g.rotateX(-Math.PI / 2).translate(0, y, 0);
  const out = mergeGeometries([dno, rant], false);
  dno.dispose();
  rant.dispose();
  return out;
}

/**
 * Kosze LeMans: wyjeżdżają do przodu z obrotem (0,5 rad) i lekko w stronę otworu – tak, żeby nie wchodziły
 * w szafkę prostopadłą stojącą przed częścią ślepą.
 */
function KoszeLemans({ geo, pivot, kierunek, otwarte, mat }: { geo: THREE.BufferGeometry; pivot: [number, number, number]; kierunek: 1 | -1; otwarte: boolean; mat: THREE.Material }) {
  const g = useRef<THREE.Group>(null);
  useRuch(otwarte, (p) => {
    if (!g.current) return;
    g.current.rotation.y = kierunek * 0.5 * p;
    g.current.position.set(pivot[0] + kierunek * 0.1 * p, pivot[1], pivot[2] + 0.42 * p);
  });
  return (
    <group ref={g} position={pivot} userData={{ ruchomy: true }}>
      <mesh geometry={geo} material={mat} position={[-pivot[0], -pivot[1], -pivot[2]]} castShadow receiveShadow />
    </group>
  );
}

/**
 * Narożnik typu LeMans: korpus na całą szerokość, część ślepa bez frontu (zasłania ją szafka prostopadła),
 * blenda przy styku, drzwi z zawiasem po stronie zewnętrznej (uchwyt przy blendzie), 2 poziomy koszy „nerek”.
 */
export function LemansBryla({ el, uchwyt, otwarte = false, ...kolory }: { el: ElementKuchni; uchwyt: boolean; otwarte?: boolean } & KoloryBryly) {
  const { m, frontMat, metal } = useMaterialyMebla(kolory);
  const drut = useDrut();
  const u = lemansElementu(el);
  const p = podzialLemans(el.w, u);
  const W = el.w / 100;
  const H = el.h / 100;
  const D = el.d / 100;
  const dK = D - PLECY;
  const zK = PLECY / 2;
  const zFront = D / 2 + T / 2 + 0.001;
  const lewo = u.strona === "L";
  // mm od lewej krawędzi → x lokalne [m].
  const x = (mmOdLewej: number) => mmOdLewej / 1000 - W / 2;
  const wew = W - 2 * T;
  const L = Math.min(wew - 0.04, (p.front + p.slepa * 0.25) / 1000);
  const G = Math.max(0.2, dK - 0.1);
  // Zewnętrzny koniec kosza przy boku po stronie otworu.
  const xZew = lewo ? W / 2 - T - 0.02 : -W / 2 + T + 0.02;
  const xSrodek = lewo ? xZew - L / 2 : xZew + L / 2;
  const klucz = `${W}|${H}|${D}|${u.strona}|${u.front}|${u.blenda}`;
  const geo = useMemo(() => {
    const poziomy = [poziomNerki(L, G, T + 0.05), poziomNerki(L, G, Math.max(T + 0.25, H * 0.5))];
    const g = mergeGeometries(poziomy, false);
    poziomy.forEach((x) => x.dispose());
    g.translate(xSrodek, 0, zK);
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [klucz]);
  useEffect(() => () => geo.dispose(), [geo]);
  const pivot: [number, number, number] = [lewo ? xZew - 0.05 : xZew + 0.05, 0, zK + G / 2 - 0.03];
  const fx0 = x(p.xFront[0]) + GAP;
  const fx1 = x(p.xFront[1]) - GAP;
  const fh = H - 2 * GAP;
  const hx = lewo ? fx1 : fx0;
  // Uchwyt przy blendzie (po stronie przeciwnej do zawiasu).
  const ux = lewo ? fx0 + 0.04 : fx1 - 0.04;
  return (
    <group>
      {korpusBez(m, W, H, D)}
      <Box m={drut} s={[0.025, H - 2 * T, 0.025]} p={[pivot[0], H / 2, pivot[2]]} />
      <KoszeLemans geo={geo} pivot={pivot} kierunek={lewo ? 1 : -1} otwarte={otwarte} mat={drut} />
      <Box m={frontMat} s={[p.blenda / 1000 - GAP, fh, T]} p={[(x(p.xBlenda[0]) + x(p.xBlenda[1])) / 2, H / 2, zFront]} />
      <Zawias os="y" kat={lewo ? KAT_DRZWI : -KAT_DRZWI} pivot={[hx, 0, zFront + T / 2]} otwarte={otwarte}>
        <Box m={frontMat} s={[fx1 - fx0, fh, T]} p={[(fx0 + fx1) / 2, H / 2, zFront]} />
        {uchwyt ? <Box m={metal} s={[0.012, Math.min(0.14, fh * 0.35), 0.012]} p={[ux, H - 0.08, zFront + T / 2 + 0.012]} /> : null}
      </Zawias>
    </group>
  );
}
