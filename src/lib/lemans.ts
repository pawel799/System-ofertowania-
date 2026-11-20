/*
 * Narożnik typu LeMans (szafka dolna w narożniku L): korpus 100–120 cm, którego część „ślepa” chowa się za
 * szafką prostopadłą, w miejscu styku blenda (zaślepka) na całą wysokość frontu, dalej otwierany front z koszami
 * „nerkami”, które wyjeżdżają z obrotem. Strona L = część ślepa po lewej (patrząc na front), P = po prawej.
 *
 * Podział szerokości (mm): ślepa + blenda + front = szerokość korpusu. Wymiary mebla w cm, tu mm.
 * Bez importów z kuchnia.ts (kuchnia.ts importuje ten plik).
 */
import type { StronaLP } from "./wnetrze";

export type UstawieniaLemans = {
  /** Strona części ślepej (narożnika), patrząc na front. */
  strona: StronaLP;
  /** Szerokość blendy [mm], 50–100. */
  blenda: number;
  /** Szerokość frontu [mm], 400–600. */
  front: number;
};

export const LEMANS = {
  blenda: { min: 50, max: 100 },
  front: { min: 400, max: 600 },
  /** Najmniejsza część ślepa [mm] – mechanizm potrzebuje miejsca na kosz tylny. */
  slepaMin: 300,
  /** Najmniejszy odstęp od frontu sąsiedniej szafki do krawędzi frontu LeMans [mm] – miejsce na uchwyt. */
  odstepUchwyt: 40,
} as const;

export const LEMANS_DOMYSLNIE: UstawieniaLemans = { strona: "L", blenda: 70, front: 450 };

/** Podział korpusu [mm] od lewej krawędzi (patrząc na front): ślepa, blenda, front – dla strony L i P. */
export function podzialLemans(wCm: number, u: UstawieniaLemans) {
  const W = Math.round(wCm * 10);
  const slepa = W - u.front - u.blenda;
  const lewo = u.strona === "L";
  return {
    W,
    slepa,
    blenda: u.blenda,
    front: u.front,
    /** Przedziały [od, do] w mm od lewej krawędzi korpusu. */
    xSlepa: lewo ? ([0, slepa] as const) : ([W - slepa, W] as const),
    xBlenda: lewo ? ([slepa, slepa + u.blenda] as const) : ([u.front, u.front + u.blenda] as const),
    xFront: lewo ? ([W - u.front, W] as const) : ([0, u.front] as const),
  };
}

/** Błąd ustawień (null = dobrze). */
export function sprawdzLemans(wCm: number, u: UstawieniaLemans): string | null {
  if (u.blenda < LEMANS.blenda.min || u.blenda > LEMANS.blenda.max) return `Blenda LeMans: od ${LEMANS.blenda.min} do ${LEMANS.blenda.max} mm.`;
  if (u.front < LEMANS.front.min || u.front > LEMANS.front.max) return `Front LeMans: od ${LEMANS.front.min} do ${LEMANS.front.max} mm.`;
  if (podzialLemans(wCm, u).slepa < LEMANS.slepaMin) return `Narożnik LeMans: na część ślepą zostaje mniej niż ${LEMANS.slepaMin} mm – poszerz korpus albo zwęź front.`;
  return null;
}

export function parseLemans(v: unknown, wCm: number, gdzie: string): UstawieniaLemans {
  const zle = (m: string): never => {
    throw new Error(`${gdzie}: ${m}`);
  };
  if (!v || typeof v !== "object" || Array.isArray(v)) zle("ustawienia narożnika LeMans mają zły format.");
  const o = v as Record<string, unknown>;
  if (o.strona !== "L" && o.strona !== "P") zle("strona narożnika LeMans musi być L albo P.");
  const liczba = (x: unknown, pole: string) => (typeof x === "number" && Number.isFinite(x) ? Math.round(x) : zle(`${pole} narożnika LeMans musi być liczbą.`));
  const u: UstawieniaLemans = { strona: o.strona as StronaLP, blenda: liczba(o.blenda, "blenda"), front: liczba(o.front, "front") };
  const blad = sprawdzLemans(wCm, u);
  if (blad) zle(blad);
  return u;
}
