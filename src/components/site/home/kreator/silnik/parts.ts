/*
 * Szafki -> formatki (lista elementów do cięcia).
 *
 * Konstrukcja korpusu (uproszczona, typowa dla kuchni z płyty 18 mm):
 *  - boki na całą wysokość, wieńce i półki między bokami,
 *  - szafka dolna: wieniec dolny + dwa trawersy 100 mm u góry (pod blat),
 *  - górna i słupek: wieniec dolny i górny,
 *  - plecy z HDF nakładane (szer. i wys. korpusu − 4 mm),
 *  - fronty nakładane, ze szczeliną z ustawień,
 *  - szuflady: dno i tył z odjęć systemu szuflad (boki są metalowe).
 * Krawędzie: "l" = ile długich krawędzi oklejamy (0–2), "w" = ile krótkich.
 */
import {
  SLIDE_LENGTHS,
  cabinetErrors,
  type Cabinet,
  type DrawerCounts,
  type ProductionSettings,
} from "./model";

export type MaterialKey = "korpus" | "front" | "hdf" | "szuflady";

export const MATERIAL_ORDER: MaterialKey[] = ["korpus", "front", "szuflady", "hdf"];

export function materialLabel(m: MaterialKey, s: ProductionSettings) {
  switch (m) {
    case "korpus":
      return `Płyta korpusu ${s.board} mm`;
    case "front":
      return `Fronty ${s.board} mm`;
    case "hdf":
      return "HDF 3 mm (plecy)";
    case "szuflady":
      return `Płyta ${s.drawer.thickness} mm (dna i tyły szuflad)`;
  }
}

export type Part = {
  material: MaterialKey;
  /** Nazwa elementu, np. "Bok". */
  label: string;
  /** Nazwa szafki, z której pochodzi. */
  cabinet: string;
  length: number;
  width: number;
  qty: number;
  edges: { l: 0 | 1 | 2; w: 0 | 1 | 2 };
};

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Najdłuższa prowadnica, która mieści się w szafce (20 mm luzu na plecy). */
export function slideFor(depth: number): number | null {
  const fit = SLIDE_LENGTHS.filter((l) => l <= depth - 20);
  return fit.length ? fit[fit.length - 1] : null;
}

/** Wysokości frontów szuflad: proporcjonalnie do wysokości tyłów, z odjęciem szczelin. */
function drawerFronts(c: Cabinet, s: ProductionSettings): number[] {
  const d: DrawerCounts = c.drawers ?? { low: 0, mid: 0, high: 0 };
  const [hl, hm, hh] = s.drawer.backHeights;
  const weights = [...Array(d.high).fill(hh), ...Array(d.mid).fill(hm), ...Array(d.low).fill(hl)] as number[];
  if (!weights.length) return [];
  const free = c.height - s.frontGap * weights.length;
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => Math.floor((free * w) / sum));
}

/** Formatki jednej szafki (ilości już pomnożone przez liczbę szafek). */
export function cabinetParts(c: Cabinet, s: ProductionSettings): Part[] {
  if (cabinetErrors(c).length) return [];
  const t = s.board;
  const inner = c.width - 2 * t;
  const out: Part[] = [];
  const add = (material: MaterialKey, label: string, length: number, width: number, qty: number, l: 0 | 1 | 2, w: 0 | 1 | 2) => {
    if (qty <= 0 || length <= 0 || width <= 0) return;
    out.push({ material, label, cabinet: c.name, length: round1(length), width: round1(width), qty: qty * c.qty, edges: { l, w } });
  };

  // Korpus
  add("korpus", "Bok", c.height, c.depth, 2, 1, 0);
  if (c.kind === "dolna" || c.kind === "szuflady") {
    add("korpus", "Wieniec dolny", inner, c.depth, 1, 1, 0);
    add("korpus", "Trawers", inner, 100, 2, 1, 0);
  } else {
    add("korpus", "Wieniec", inner, c.depth, 2, 1, 0);
  }
  if (c.kind !== "szuflady") add("korpus", "Półka", inner, c.depth - 20, c.shelves, 1, 0);

  // Plecy
  if (s.backPanel) add("hdf", "Plecy", c.height - 4, c.width - 4, 1, 0, 0);

  // Fronty
  const g = s.frontGap;
  if (c.kind === "szuflady") {
    for (const h of drawerFronts(c, s)) add("front", "Front szuflady", c.width - g, h, 1, 2, 2);
  } else if (c.doors === 1) {
    add("front", "Drzwi", c.height - g, c.width - g, 1, 2, 2);
  } else if (c.doors === 2) {
    add("front", "Drzwi", c.height - g, (c.width - 2 * g) / 2, 2, 2, 2);
  }

  // Szuflady: dno i tył
  if (c.kind === "szuflady" && c.drawers) {
    const nl = slideFor(c.depth);
    const d = s.drawer;
    const n = c.drawers.low + c.drawers.mid + c.drawers.high;
    if (nl && n > 0) {
      add("szuflady", `Dno szuflady (prowadnica ${nl})`, inner - d.bottomWidthCut, nl - d.bottomDepthCut, n, 0, 0);
      const backs: [number, number][] = [
        [c.drawers.low, d.backHeights[0]],
        [c.drawers.mid, d.backHeights[1]],
        [c.drawers.high, d.backHeights[2]],
      ];
      for (const [count, h] of backs) add("szuflady", `Tył szuflady ${h}`, inner - d.backWidthCut, h, count, 1, 0);
    }
  }
  return out;
}

export function productionParts(cabinets: Cabinet[], s: ProductionSettings): Part[] {
  return cabinets.flatMap((c) => cabinetParts(c, s));
}

/** Łączy identyczne formatki (ten sam materiał, nazwa, wymiary i oklejanie) z różnych szafek. */
export function groupParts(parts: Part[]): (Part & { cabinets: string[] })[] {
  const map = new Map<string, Part & { cabinets: string[] }>();
  for (const p of parts) {
    const key = [p.material, p.label, p.length, p.width, p.edges.l, p.edges.w].join("|");
    const cur = map.get(key);
    if (cur) {
      cur.qty += p.qty;
      if (!cur.cabinets.includes(p.cabinet)) cur.cabinets.push(p.cabinet);
    } else map.set(key, { ...p, cabinets: [p.cabinet] });
  }
  return Array.from(map.values()).sort(
    (a, b) => MATERIAL_ORDER.indexOf(a.material) - MATERIAL_ORDER.indexOf(b.material) || b.length * b.width - a.length * a.width,
  );
}

/** Metry bieżące okleiny dla listy formatek. */
export function edgeMeters(parts: Part[]) {
  return parts.reduce((sum, p) => sum + p.qty * (p.edges.l * p.length + p.edges.w * p.width), 0) / 1000;
}

/** Zapis oklejania jak na listach do zakładu: "2D 1K" itp. */
export function edgeCode(e: Part["edges"]) {
  const parts = [e.l ? `${e.l}D` : "", e.w ? `${e.w}K` : ""].filter(Boolean);
  return parts.length ? parts.join(" ") : "–";
}
