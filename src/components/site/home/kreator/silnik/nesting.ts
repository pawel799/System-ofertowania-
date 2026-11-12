/*
 * Rozkrój płyt: układanie formatek na arkuszach.
 *
 * Algorytm gilotynowy (każde cięcie przez cały kawałek płyty, jak na pile
 * formatowej): wolne prostokąty, wybór najlepszego dopasowania krótszego boku,
 * podział resztki wzdłuż dłuższego odpadu. Formatki od największych.
 * Rzaz piły dodajemy do każdej formatki, formatowanie odcina brzegi arkusza.
 * Przy usłojeniu formatek nie obracamy (długość zawsze wzdłuż długości arkusza).
 * To heurystyka – wynik jest dobry, ale nie zawsze optymalny.
 */
import type { ProductionSettings } from "./model";
import { MATERIAL_ORDER, type MaterialKey, type Part } from "./parts";

export type Placement = {
  /** Pozycja względem lewego górnego rogu arkusza (z formatowaniem), mm. */
  x: number;
  y: number;
  /** Wymiary rysowane na arkuszu (po ewentualnym obrocie), bez rzazu. */
  w: number;
  h: number;
  rotated: boolean;
  part: Part;
};

export type Sheet = { placements: Placement[] };

export type MaterialLayout = {
  material: MaterialKey;
  sheets: Sheet[];
  /** Formatki większe niż arkusz roboczy. */
  tooBig: Part[];
  partsArea: number;
  sheetArea: number;
  /** Wykorzystanie 0–1 (pole formatek / pole zużytych arkuszy). */
  usage: number;
};

type Rect = { x: number; y: number; w: number; h: number };
type Piece = { part: Part; w: number; h: number };

function packMaterial(pieces: Piece[], s: ProductionSettings) {
  const k = s.kerf;
  // Rzaz po ostatniej formatce w rzędzie nie jest potrzebny: dodajemy go do obszaru roboczego.
  const areaW = s.sheetLength - 2 * s.trim + k;
  const areaH = s.sheetWidth - 2 * s.trim + k;
  const sheets: { free: Rect[]; placements: Placement[] }[] = [];
  const tooBig: Part[] = [];

  const sorted = [...pieces].sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h);

  for (const pc of sorted) {
    const pw = pc.w + k;
    const ph = pc.h + k;
    const orients: [number, number, boolean][] = [[pw, ph, false]];
    if (!s.grain && pw !== ph) orients.push([ph, pw, true]);

    let best: { sheet: number; rect: number; w: number; h: number; rot: boolean; score: number } | null = null;
    const tryPlace = (si: number) => {
      sheets[si].free.forEach((r, ri) => {
        for (const [w, h, rot] of orients) {
          if (w <= r.w && h <= r.h) {
            const score = Math.min(r.w - w, r.h - h);
            if (!best || score < best.score) best = { sheet: si, rect: ri, w, h, rot, score };
          }
        }
      });
    };
    for (let si = 0; si < sheets.length; si++) tryPlace(si);

    if (!best) {
      if (!orients.some(([w, h]) => w <= areaW && h <= areaH)) {
        tooBig.push(pc.part);
        continue;
      }
      sheets.push({ free: [{ x: 0, y: 0, w: areaW, h: areaH }], placements: [] });
      tryPlace(sheets.length - 1);
    }
    const b = best as unknown as { sheet: number; rect: number; w: number; h: number; rot: boolean };
    const sheet = sheets[b.sheet];
    const r = sheet.free[b.rect];
    sheet.placements.push({
      x: s.trim + r.x,
      y: s.trim + r.y,
      w: b.w - k,
      h: b.h - k,
      rotated: b.rot,
      part: pc.part,
    });
    // Podział gilotynowy: pełne cięcie wzdłuż dłuższej resztki.
    const restW = r.w - b.w;
    const restH = r.h - b.h;
    const next: Rect[] =
      restW > restH
        ? [
            { x: r.x + b.w, y: r.y, w: restW, h: r.h },
            { x: r.x, y: r.y + b.h, w: b.w, h: restH },
          ]
        : [
            { x: r.x, y: r.y + b.h, w: r.w, h: restH },
            { x: r.x + b.w, y: r.y, w: restW, h: b.h },
          ];
    sheet.free.splice(b.rect, 1, ...next.filter((n) => n.w > k && n.h > k));
  }
  return { sheets: sheets.map((sh) => ({ placements: sh.placements })), tooBig };
}

export function layoutParts(parts: Part[], s: ProductionSettings): MaterialLayout[] {
  const byMaterial = new Map<MaterialKey, Piece[]>();
  for (const p of parts) {
    const list = byMaterial.get(p.material) ?? [];
    for (let i = 0; i < p.qty; i++) list.push({ part: p, w: p.length, h: p.width });
    byMaterial.set(p.material, list);
  }
  const fullSheet = s.sheetLength * s.sheetWidth;
  return MATERIAL_ORDER.filter((m) => byMaterial.has(m)).map((material) => {
    const { sheets, tooBig } = packMaterial(byMaterial.get(material)!, s);
    const partsArea = sheets.reduce((sum, sh) => sum + sh.placements.reduce((a, p) => a + p.w * p.h, 0), 0);
    const sheetArea = sheets.length * fullSheet;
    return { material, sheets, tooBig, partsArea, sheetArea, usage: sheetArea ? partsArea / sheetArea : 0 };
  });
}
