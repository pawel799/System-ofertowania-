/*
 * Szafki -> bryły 3D (bez three.js, same liczby w metrach). Każda formatka z generatora
 * (parts.ts) dostaje pozycję w złożonej szafce i orientację (baza osi).
 * Osie lokalne formatki: x = długość, y = grubość, z = szerokość.
 * Używa tego pokaz na stronie głównej i podgląd 3D w teście kreatora.
 */
import type { Cabinet, ProductionSettings } from "./model";
import { cabinetParts, type MaterialKey, type Part } from "./parts";

export type Basis = [[number, number, number], [number, number, number], [number, number, number]];
export const FLAT: Basis = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const UPRIGHT_SIDE: Basis = [[0, 1, 0], [-1, 0, 0], [0, 0, 1]]; // długość w górę, szerokość w głąb (bok)
const UPRIGHT_FACE: Basis = [[0, 1, 0], [0, 0, 1], [1, 0, 0]]; // długość w górę, szerokość w poprzek (plecy, drzwi)
const LYING_FACE: Basis = [[1, 0, 0], [0, 0, 1], [0, -1, 0]]; // długość w poprzek, szerokość w górę (front szuflady, tył)

export type Solid = {
  material: MaterialKey;
  label: string;
  /** Długość, grubość, szerokość formatki w metrach. */
  size: [number, number, number];
  pos: [number, number, number];
  basis: Basis;
};

const mm = (v: number) => v / 1000;

export const thicknessOf = (m: MaterialKey, s: ProductionSettings) =>
  m === "hdf" ? 0.003 : m === "szuflady" ? mm(s.drawer.thickness) : mm(s.board);

/** Pozycja k-tej sztuki formatki `part` w szafce `c`, której lewy-dolny-tylny róg stoi w `origin`. */
export function placePart(
  c: Cabinet,
  part: Part,
  k: number,
  origin: [number, number, number],
  s: ProductionSettings,
): { pos: [number, number, number]; basis: Basis } {
  const [ox, oy, oz] = origin;
  const W = mm(c.width);
  const H = mm(c.height);
  const D = mm(c.depth);
  const t = mm(s.board);
  const g = mm(s.frontGap);
  const Wd = mm(part.width);
  const p = (x: number, y: number, z: number): [number, number, number] => [ox + x, oy + y, oz + z];
  const label = part.label;
  const n = (c.drawers?.low ?? 0) + (c.drawers?.mid ?? 0) + (c.drawers?.high ?? 0);

  if (label === "Bok") return { pos: p(k % 2 === 0 ? t / 2 : W - t / 2, H / 2, D / 2), basis: UPRIGHT_SIDE };
  if (label === "Wieniec dolny") return { pos: p(W / 2, t / 2, D / 2), basis: FLAT };
  if (label === "Wieniec") return { pos: p(W / 2, k % 2 === 0 ? t / 2 : H - t / 2, D / 2), basis: FLAT };
  if (label === "Trawers") return { pos: p(W / 2, H - t / 2, k % 2 === 0 ? D - 0.05 : 0.05), basis: FLAT };
  if (label === "Półka") return { pos: p(W / 2, (H * ((k % Math.max(1, c.shelves)) + 1)) / (c.shelves + 1), (D - 0.02) / 2), basis: FLAT };
  if (label === "Plecy") return { pos: p(W / 2, H / 2, -0.0015), basis: UPRIGHT_FACE };
  if (label === "Drzwi") {
    const doors = c.doors || 1;
    const i = k % doors;
    return { pos: p(doors === 1 ? W / 2 : i === 0 ? g + Wd / 2 : W - g - Wd / 2, H / 2, D + t / 2), basis: UPRIGHT_FACE };
  }
  if (label === "Front szuflady") {
    const heights = frontHeights(c, s);
    const i = k % Math.max(1, heights.length);
    const above = heights.slice(0, i).reduce((a, h) => a + h + g, 0);
    return { pos: p(W / 2, H - g - above - Wd / 2, D + t / 2), basis: LYING_FACE };
  }
  if (label.startsWith("Dno")) return { pos: p(W / 2, 0.06 + ((k % Math.max(1, n)) * (H - 0.12)) / Math.max(1, n), D / 2 - 0.01), basis: FLAT };
  if (label.startsWith("Tył")) {
    const i = backIndex(c, s).get(`${label}|${k % Math.max(1, n)}`) ?? k;
    return { pos: p(W / 2, 0.06 + ((i % Math.max(1, n)) * (H - 0.12)) / Math.max(1, n) + Wd / 2 + 0.01, 0.06), basis: LYING_FACE };
  }
  return { pos: p(W / 2, H / 2, D / 2), basis: FLAT };
}

/** Wysokości frontów szuflad od góry (jak w generatorze), metry. */
function frontHeights(c: Cabinet, s: ProductionSettings) {
  return cabinetParts({ ...c, qty: 1 }, s)
    .filter((p) => p.label === "Front szuflady")
    .flatMap((f) => Array(f.qty).fill(mm(f.width)) as number[]);
}

/** Numer szuflady (od dołu) dla kolejnych tyłów. */
function backIndex(c: Cabinet, s: ProductionSettings) {
  const map = new Map<string, number>();
  let i = 0;
  for (const b of cabinetParts({ ...c, qty: 1 }, s).filter((p) => p.label.startsWith("Tył"))) {
    for (let k = 0; k < b.qty; k++) map.set(`${b.label}|${k}`, i++);
  }
  return map;
}

/**
 * Cała zabudowa: szafki dolne i słupki w rzędzie, górne w rzędzie nad nimi (1,36 m od podłogi).
 * Szafka z ilością > 1 stoi tyle razy obok siebie. maxCabinets ogranicza liczbę brył (wydajność).
 */
export function assembleCabinets(cabinets: Cabinet[], s: ProductionSettings, maxCabinets = 24): Solid[] {
  const out: Solid[] = [];
  let lowerX = 0;
  let upperX = 0;
  let count = 0;
  for (const c of cabinets) {
    for (let copy = 0; copy < c.qty && count < maxCabinets; copy++, count++) {
      const upper = c.kind === "gorna";
      const x = upper ? upperX : lowerX;
      const origin: [number, number, number] = [x, upper ? 1.36 : 0, -0.28]; // plecy przy ścianie
      if (upper) upperX += mm(c.width);
      else lowerX += mm(c.width);
      const single = cabinetParts({ ...c, qty: 1 }, s);
      for (const part of single) {
        for (let k = 0; k < part.qty; k++) {
          const at = placePart(c, part, k, origin, s);
          out.push({ material: part.material, label: part.label, size: [mm(part.length), thicknessOf(part.material, s), mm(part.width)], ...at });
        }
      }
    }
  }
  // Wyśrodkowanie zabudowy w osi X.
  const width = Math.max(lowerX, upperX);
  for (const o of out) o.pos = [o.pos[0] - width / 2, o.pos[1], o.pos[2]];
  return out;
}
