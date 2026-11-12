/*
 * Dane pokazu kreatora na stronie głównej: trzy przykładowe szafki, ich formatki
 * (prawdziwy generator z src/lib/produkcja) i rozkrój (prawdziwy algorytm).
 * Dla każdej formatki dwie pozycje w 3D: w złożonej szafce i na arkuszu płyty.
 * Liczone raz, bez Reacta i bez three.js (same liczby), żeby dało się użyć wszędzie.
 */
import { DEFAULT_SETTINGS, type Cabinet } from "./silnik/model";
import { cabinetParts, edgeMeters, productionParts, type MaterialKey, type Part } from "./silnik/parts";
import { layoutParts } from "./silnik/nesting";
import { placePart, thicknessOf, type Basis } from "./silnik/assembly3d";

export const SETTINGS = DEFAULT_SETTINGS;

export const DEMO_CABINETS: Cabinet[] = [
  { id: "demo1", name: "Dolna 60", kind: "dolna", width: 600, height: 720, depth: 560, qty: 1, shelves: 1, doors: 1 },
  { id: "demo2", name: "Szuflady 60", kind: "szuflady", width: 600, height: 720, depth: 560, qty: 1, shelves: 0, doors: 0, drawers: { low: 1, mid: 2, high: 0 } },
  { id: "demo3", name: "Górna 80", kind: "gorna", width: 800, height: 720, depth: 320, qty: 1, shelves: 2, doors: 2 },
];

/** Gdzie stoi lewy-dolny-tylny róg szafki (metry). Górna wisi nad dolnymi. */
const ORIGIN: Record<string, [number, number, number]> = {
  "Dolna 60": [-0.6, 0, -0.28],
  "Szuflady 60": [0, 0, -0.28],
  "Górna 80": [-0.4, 1.36, -0.28],
};

export const PARTS: Part[] = productionParts(DEMO_CABINETS, SETTINGS);
export const PARTS_PER_CABINET = DEMO_CABINETS.map((c) => cabinetParts(c, SETTINGS).reduce((a, p) => a + p.qty, 0));
export const LAYOUT = layoutParts(PARTS, SETTINGS);
export const STATS = {
  count: PARTS.reduce((a, p) => a + p.qty, 0),
  area: PARTS.reduce((a, p) => a + (p.qty * p.length * p.width) / 1e6, 0),
  edge: edgeMeters(PARTS),
  sheets: LAYOUT.reduce((a, l) => a + l.sheets.length, 0),
  usage: LAYOUT[0]?.usage ?? 0,
};

export type Piece = {
  material: MaterialKey;
  label: string;
  cabinet: number;
  /** Wymiary formatki w metrach: długość, grubość, szerokość (osie lokalne x, y, z). */
  size: [number, number, number];
  assembled: { pos: [number, number, number]; basis: Basis };
  /** Na arkuszu (przed skalowaniem rozkładu): środek w metrach, obrót o 90° wokół pionu. */
  laid: { pos: [number, number, number]; rotated: boolean };
  /** Kolejność na arkuszu (do kaskady). */
  order: number;
};

const mm = (v: number) => v / 1000;

/** Arkusze leżą na podłodze w siatce 2 × 2 (przed skalowaniem). */
const SHEET_GAP = 0.3;
function sheetOrigin(index: number): [number, number] {
  const col = index % 2;
  const row = Math.floor(index / 2);
  const w = mm(SETTINGS.sheetLength);
  const h = mm(SETTINGS.sheetWidth);
  return [col * (w + SHEET_GAP) - (w + SHEET_GAP / 2), row * (h + SHEET_GAP) - (h + SHEET_GAP / 2)];
}

export type SheetRect = { x: number; z: number; w: number; h: number; material: MaterialKey };

function build() {
  const pieces: Piece[] = [];
  const sheets: SheetRect[] = [];
  const seen = new Map<Part, number>();
  let sheetIndex = 0;
  let order = 0;
  for (const layout of LAYOUT) {
    for (const sheet of layout.sheets) {
      const [sx, sz] = sheetOrigin(sheetIndex++);
      sheets.push({ x: sx, z: sz, w: mm(SETTINGS.sheetLength), h: mm(SETTINGS.sheetWidth), material: layout.material });
      for (const pl of sheet.placements) {
        const part = pl.part;
        const k = seen.get(part) ?? 0;
        seen.set(part, k + 1);
        const ci = DEMO_CABINETS.findIndex((c) => c.name === part.cabinet);
        const cab = DEMO_CABINETS[ci];
        pieces.push({
          material: part.material,
          label: part.label,
          cabinet: ci,
          size: [mm(part.length), thicknessOf(part.material, SETTINGS), mm(part.width)],
          assembled: placePart(cab, part, k, ORIGIN[cab.name], SETTINGS),
          laid: {
            pos: [sx + mm(pl.x + pl.w / 2), thicknessOf(part.material, SETTINGS) / 2, sz + mm(pl.y + pl.h / 2)],
            rotated: pl.rotated,
          },
          order: order++,
        });
      }
    }
  }
  return { pieces, sheets };
}

export const { pieces: PIECES, sheets: SHEETS } = build();

/* ---------- Oś czasu pokazu (postęp przewinięcia 0–1) ---------- */

export const PHASES = [0, 0.2, 0.36, 0.58, 0.8, 1] as const;
/** Kiedy kursor dodaje kolejne szafki (szafka pojawia się w tabeli i zaczyna się składać w 3D). */
export const ADD_AT = [0.035, 0.085, 0.135];
/** Kliknięcia próbek frontów w fazie materiałów. */
export const FRONT_AT: { p: number; id: string }[] = [
  { p: 0.62, id: "grafit" },
  { p: 0.68, id: "kaszmir" },
  { p: 0.74, id: "dab-naturalny" },
];
export const LINK_AT = 0.835;
export const COPY_AT = 0.9;

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** Postęp 0–1 wewnątrz przedziału [a, b]. */
export const span = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
/** Mocne ease-in-out (jak --ease-in-out w panelu) do ruchu na ekranie. */
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);

/** Indeks fazy (0–4) dla postępu. */
export function phaseOf(p: number) {
  for (let i = 4; i > 0; i--) if (p >= PHASES[i]) return i;
  return 0;
}

/** Aktualny front w pokazie. */
export function frontAt(p: number) {
  let id = "dab-naturalny";
  for (const f of FRONT_AT) if (p >= f.p) id = f.id;
  return id;
}
