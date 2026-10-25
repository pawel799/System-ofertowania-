"use client";

import { useEffect, useMemo } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

/** Grubość płyty meblowej [m]. */
export const PLYTA = 0.018;
/** Grubość pleców (HDF) [m]. */
export const PLECY = 0.003;
/** Szczelina frontu [m]. */
export const SZCZELINA = 0.002;

const TEX = "/textures/wood049";

export type SzafkaProps = {
  /** szerokość [cm] */
  szerokosc?: number;
  /** wysokość korpusu [cm] */
  wysokosc?: number;
  /** głębokość korpusu [cm] */
  glebokosc?: number;
  position?: [number, number, number];
  /** Gładki kolor frontu (próbka albo RAL). Brak = usłojenie drewna, jak na stronie modułu. */
  kolorFrontu?: string;
  /** Chropowatość frontu, gdy podany jest kolor. */
  chropowatosc?: number;
  /** false = bez uchwytu (push-to-open). */
  pokazUchwyt?: boolean;
  /** Więcej niż 1 = front podzielony na szuflady. */
  szuflady?: number;
  /** Korpus bez frontu (zlew, piekarnik — front dokłada bryła AGD). */
  bezFrontu?: boolean;
};

/**
 * Prostopadłościan z UV w metrach (1 jednostka UV = 1 m tekstury),
 * oś U zawsze wzdłuż najdłuższego wymiaru panelu → słoje wzdłuż długości.
 */
function panelGeometry(sx: number, sy: number, sz: number) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  const size = [sx, sy, sz];
  const longest = size.indexOf(Math.max(...size));
  const pos = g.attributes.position;
  const nrm = g.attributes.normal;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const p = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const n = [Math.abs(nrm.getX(i)), Math.abs(nrm.getY(i)), Math.abs(nrm.getZ(i))];
    const normalAxis = n.indexOf(Math.max(...n));
    const inPlane = [0, 1, 2].filter((a) => a !== normalAxis);
    let uAxis = inPlane.includes(longest) ? longest : inPlane[0];
    if (!inPlane.includes(longest)) {
      // ściana prostopadła do długości (czoło) – bierz dłuższy z pozostałych
      uAxis = size[inPlane[0]] >= size[inPlane[1]] ? inPlane[0] : inPlane[1];
    }
    const vAxis = inPlane.find((a) => a !== uAxis)!;
    uv.setXY(i, p[uAxis] + size[uAxis] / 2, p[vAxis] + size[vAxis] / 2);
  }
  uv.needsUpdate = true;
  return g;
}

function Panel({
  size,
  position,
  material,
}: {
  size: [number, number, number];
  position: [number, number, number];
  material: THREE.Material;
}) {
  const geo = useMemo(() => panelGeometry(...size), [size[0], size[1], size[2]]); // eslint-disable-line react-hooks/exhaustive-deps
  return <mesh geometry={geo} position={position} material={material} castShadow receiveShadow />;
}

export function useDrewno() {
  const [map, normalMap, roughnessMap] = useTexture([
    `${TEX}/color.jpg`,
    `${TEX}/normal.jpg`,
    `${TEX}/roughness.jpg`,
  ]);
  return useMemo(() => {
    for (const t of [map, normalMap, roughnessMap]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(1, 1);
      t.anisotropy = 8;
    }
    map.colorSpace = THREE.SRGBColorSpace;
    const korpus = new THREE.MeshStandardMaterial({ map, normalMap, roughnessMap, color: "#e8dccb" });
    const front = new THREE.MeshStandardMaterial({ map, normalMap, roughnessMap });
    const plecy = new THREE.MeshStandardMaterial({ color: "#d9d4cc", roughness: 0.9 });
    return { korpus, front, plecy };
  }, [map, normalMap, roughnessMap]);
}

/**
 * Szafka dolna: boki na całą wysokość, wieniec dolny między bokami,
 * dwie listwy górne (przednia i tylna), plecy HDF, front z szczeliną.
 * Początek układu: środek podstawy, front w kierunku +Z.
 */
export default function Szafka({
  szerokosc = 60,
  wysokosc = 72,
  glebokosc = 56,
  position = [0, 0, 0],
  kolorFrontu,
  chropowatosc = 0.55,
  pokazUchwyt = true,
  szuflady = 1,
  bezFrontu = false,
}: SzafkaProps) {
  const W = szerokosc / 100;
  const H = wysokosc / 100;
  const D = glebokosc / 100;
  const t = PLYTA;
  const m = useDrewno();
  const frontKolor = useMemo(() => {
    if (!kolorFrontu) return null;
    return new THREE.MeshStandardMaterial({ color: kolorFrontu, roughness: chropowatosc, metalness: 0.02 });
  }, [kolorFrontu, chropowatosc]);
  useEffect(() => () => frontKolor?.dispose(), [frontKolor]);
  const frontMaterial = frontKolor ?? m.front;
  const inner = W - 2 * t;
  const listwa = 0.1;
  const dKorp = D - PLECY;
  const zKorp = PLECY / 2; // korpus przesunięty do przodu o grubość pleców

  return (
    <group position={position}>
      {/* boki */}
      <Panel material={m.korpus} size={[t, H, dKorp]} position={[-W / 2 + t / 2, H / 2, zKorp]} />
      <Panel material={m.korpus} size={[t, H, dKorp]} position={[W / 2 - t / 2, H / 2, zKorp]} />
      {/* wieniec dolny */}
      <Panel material={m.korpus} size={[inner, t, dKorp]} position={[0, t / 2, zKorp]} />
      {/* listwy górne */}
      <Panel material={m.korpus} size={[inner, t, listwa]} position={[0, H - t / 2, zKorp + dKorp / 2 - listwa / 2]} />
      <Panel material={m.korpus} size={[inner, t, listwa]} position={[0, H - t / 2, zKorp - dKorp / 2 + listwa / 2]} />
      {/* półka */}
      <Panel material={m.korpus} size={[inner, t, dKorp - 0.02]} position={[0, H / 2, zKorp - 0.01]} />
      {/* plecy */}
      <Panel material={m.plecy} size={[W, H, PLECY]} position={[0, H / 2, -D / 2 + PLECY / 2]} />
      {/* front */}
      {bezFrontu
        ? null
        : Array.from({ length: Math.max(1, Math.min(4, Math.round(szuflady))) }, (_, i) => {
            const n = Math.max(1, Math.min(4, Math.round(szuflady)));
            const szczelina = n > 1 ? 0.004 : 0;
            const fh = (H - 2 * SZCZELINA - szczelina * (n - 1)) / n;
            const y = SZCZELINA + fh / 2 + i * (fh + szczelina);
            return (
              <Panel
                key={i}
                material={frontMaterial}
                size={[W - 2 * SZCZELINA, Math.max(0.02, fh), t]}
                position={[0, y, D / 2 + t / 2 + 0.001]}
              />
            );
          })}
      {/* uchwyt */}
      {pokazUchwyt && !bezFrontu ? (
        <mesh position={[W / 2 - 0.05, H - 0.08, D / 2 + t + 0.012]} castShadow>
          <boxGeometry args={[0.012, Math.min(0.12, H * 0.35), 0.012]} />
          <meshStandardMaterial color="#2b2b2b" metalness={0.8} roughness={0.35} />
        </mesh>
      ) : null}
    </group>
  );
}
