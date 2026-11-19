"use client";

/*
 * Meble, w których najważniejsze są okucia: cargo (dolne i wysokie). Własna, uproszczona geometria
 * (prostopadłościany), bez modeli i wyglądu konkretnych producentów.
 *
 * Kosze całego mebla są sklejone w jedną geometrię (jedno wywołanie rysowania), żeby kuchnia z kilkoma
 * cargo nie spowalniała sceny. Początek układu jak w MebelParametryczny: środek podstawy, front w +Z, metry.
 */
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { ElementKuchni } from "@/lib/kuchnia";
import { cargoWysokie, koszeCargoWysokiego } from "@/lib/okucia";
import { Box, GAP, PLECY, Przesuw, T, useMaterialyMebla, type KoloryBryly } from "./MebelParametryczny";

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
