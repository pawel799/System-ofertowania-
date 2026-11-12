/*
 * Silnik danych pokazu kreatora na stronie głównej (tylko do animacji): uproszczony generator
 * formatek trzech przykładowych szafek. Prawdziwe formatki i rozkrój z projektu kreatora są w
 * src/components/produkcja/ (formatki.ts, rozkroj.ts).
 * Wszystkie wymiary w milimetrach.
 */

export type CabinetKind = "dolna" | "gorna" | "slupek" | "szuflady";

export const CABINET_KINDS: CabinetKind[] = ["dolna", "gorna", "slupek", "szuflady"];

export const CABINET_LABEL: Record<CabinetKind, string> = {
  dolna: "Dolna z drzwiami",
  gorna: "Górna (wisząca)",
  slupek: "Słupek",
  szuflady: "Dolna z szufladami",
};

/** Domyślne wymiary nowej szafki danego typu (szer., wys. korpusu, gł.). */
export const CABINET_DEFAULTS: Record<CabinetKind, { width: number; height: number; depth: number; shelves: number; doors: 0 | 1 | 2 }> = {
  dolna: { width: 600, height: 720, depth: 560, shelves: 1, doors: 1 },
  gorna: { width: 600, height: 720, depth: 320, shelves: 2, doors: 1 },
  slupek: { width: 600, height: 2100, depth: 560, shelves: 4, doors: 2 },
  szuflady: { width: 600, height: 720, depth: 560, shelves: 0, doors: 0 },
};

/** Liczba szuflad danej wysokości w szafce szufladowej. */
export type DrawerCounts = { low: number; mid: number; high: number };

export type Cabinet = {
  id: string;
  name: string;
  kind: CabinetKind;
  width: number;
  height: number;
  depth: number;
  qty: number;
  shelves: number;
  /** Liczba drzwi (szafka szufladowa: 0, fronty liczą się z szuflad). */
  doors: 0 | 1 | 2;
  drawers?: DrawerCounts;
};

/**
 * Parametry systemu szuflad (box metalowy). To odjęcia od wymiarów korpusu,
 * które podaje katalog producenta prowadnic – w panelu da się je zmienić,
 * bo różnią się między systemami i wersjami.
 */
export type DrawerSystem = {
  name: string;
  /** Szerokość dna = światło szafki − bottomWidthCut. */
  bottomWidthCut: number;
  /** Głębokość dna = długość prowadnicy − bottomDepthCut. */
  bottomDepthCut: number;
  /** Szerokość tyłu = światło szafki − backWidthCut. */
  backWidthCut: number;
  /** Wysokość tyłu dla szuflady niskiej, średniej i wysokiej. */
  backHeights: [number, number, number];
  /** Grubość płyty dna i tyłu. */
  thickness: number;
};

export const DEFAULT_DRAWER_SYSTEM: DrawerSystem = {
  name: "Box metalowy (ustaw wg katalogu)",
  bottomWidthCut: 75,
  bottomDepthCut: 8,
  backWidthCut: 87,
  backHeights: [68, 151, 183],
  thickness: 16,
};

/** Długości prowadnic dostępne w kalkulatorze (dobierana najdłuższa, która się mieści). */
export const SLIDE_LENGTHS = [270, 300, 350, 400, 450, 500, 550, 600, 650];

export type ProductionSettings = {
  /** Grubość płyty korpusu i frontów. */
  board: number;
  /** Plecy z HDF 3 mm (true) albo bez pleców. */
  backPanel: boolean;
  /** Arkusz płyty. */
  sheetLength: number;
  sheetWidth: number;
  /** Formatowanie: obcięcie krawędzi arkusza z każdej strony. */
  trim: number;
  /** Rzaz piły. */
  kerf: number;
  /** Usłojenie: formatek nie obracamy na arkuszu. */
  grain: boolean;
  /** Grubość okleiny, tylko do opisu na liście. */
  edge: string;
  /** Szczelina między frontami i na krawędziach. */
  frontGap: number;
  drawer: DrawerSystem;
};

export const DEFAULT_SETTINGS: ProductionSettings = {
  board: 18,
  backPanel: true,
  sheetLength: 2800,
  sheetWidth: 2070,
  trim: 15,
  kerf: 4,
  grain: false,
  edge: "0,8 mm",
  frontGap: 3,
  drawer: DEFAULT_DRAWER_SYSTEM,
};

export const EDGE_OPTIONS = ["brak", "0,6 mm", "0,8 mm", "1 mm", "2 mm"];

export type Production = {
  cabinets: Cabinet[];
  settings: ProductionSettings;
};

/* ---------- Limity (te same w panelu i w API) ---------- */

export const LIMITS = {
  cabinets: 120,
  name: 80,
  width: [100, 1200] as const,
  height: [150, 2700] as const,
  depth: [100, 800] as const,
  qty: [1, 50] as const,
  shelves: [0, 10] as const,
  drawersEach: [0, 6] as const,
  drawersTotal: 6,
  board: [8, 40] as const,
  sheetLength: [600, 4200] as const,
  sheetWidth: [400, 2200] as const,
  trim: [0, 50] as const,
  kerf: [0, 10] as const,
  frontGap: [0, 6] as const,
  drawerCut: [0, 200] as const,
  backHeight: [40, 400] as const,
  drawerThickness: [8, 25] as const,
};

export function newCabinetId() {
  const abc = "abcdefghijklmnopqrstuvwxyz0123456789";
  const buf = new Uint8Array(10);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => abc[b % abc.length]).join("");
}

export function newCabinet(kind: CabinetKind, index: number): Cabinet {
  const d = CABINET_DEFAULTS[kind];
  return {
    id: newCabinetId(),
    name: `${CABINET_LABEL[kind]} ${index}`,
    kind,
    width: d.width,
    height: d.height,
    depth: d.depth,
    qty: 1,
    shelves: d.shelves,
    doors: d.doors,
    ...(kind === "szuflady" ? { drawers: { low: 1, mid: 2, high: 0 } } : {}),
  };
}

export const emptyProduction = (): Production => ({ cabinets: [], settings: DEFAULT_SETTINGS });

const inRange = (v: number, [min, max]: readonly [number, number]) => Number.isFinite(v) && v >= min && v <= max;

/** Błędy jednej szafki po polsku (pusta lista = poprawna). */
export function cabinetErrors(c: Cabinet): string[] {
  const out: string[] = [];
  if (!inRange(c.width, LIMITS.width)) out.push(`Szerokość: od ${LIMITS.width[0]} do ${LIMITS.width[1]} mm.`);
  if (!inRange(c.height, LIMITS.height)) out.push(`Wysokość: od ${LIMITS.height[0]} do ${LIMITS.height[1]} mm.`);
  if (!inRange(c.depth, LIMITS.depth)) out.push(`Głębokość: od ${LIMITS.depth[0]} do ${LIMITS.depth[1]} mm.`);
  if (!inRange(c.qty, LIMITS.qty)) out.push(`Ilość: od ${LIMITS.qty[0]} do ${LIMITS.qty[1]}.`);
  if (c.kind === "szuflady") {
    const d = c.drawers ?? { low: 0, mid: 0, high: 0 };
    const total = d.low + d.mid + d.high;
    if (total < 1) out.push("Dodaj co najmniej jedną szufladę.");
    if (total > LIMITS.drawersTotal) out.push(`Najwyżej ${LIMITS.drawersTotal} szuflad w szafce.`);
    if (c.depth < SLIDE_LENGTHS[0] + 20) out.push(`Szafka za płytka na prowadnice (min. ${SLIDE_LENGTHS[0] + 20} mm).`);
  }
  return out;
}
