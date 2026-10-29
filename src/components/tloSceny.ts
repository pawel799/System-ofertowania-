import type { Object3D } from "three";

/*
 * Tło sceny 3D dopasowane do modelu: ciemne fronty (grafit, dąb wędzony, czarny mat) giną na ciemnym tle,
 * więc przy ciemnym modelu scena przełącza się na jasne „studio”. Jasne i średnie fronty zostają na ciemnym tle.
 */
export type TloSceny = {
  jasne: boolean;
  /** Tło canvasu i kontenera (widać je też przed wczytaniem). */
  tlo: string;
  podloga: string;
  sciana: string;
  /** Kolor napisów „Wczytywanie…” na tle. */
  tekst: string;
};

export const TLO_CIEMNE: TloSceny = { jasne: false, tlo: "#141311", podloga: "#2a2622", sciana: "#3a342e", tekst: "#a8a29e" };
export const TLO_JASNE: TloSceny = { jasne: true, tlo: "#ebe8e3", podloga: "#d6d1c9", sciana: "#e2ddd5", tekst: "#57534e" };

/** Próg luminancji (sRGB → liniowa, 0–1). Dąb wędzony ≈ 0,08, grafit ≈ 0,04, dąb naturalny ≈ 0,28. */
export const PROG_CIEMNEGO = 0.15;

export function luminancja(hex: string | undefined | null): number | null {
  if (!hex) return null;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const kanal = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * kanal((n >> 16) & 255) + 0.7152 * kanal((n >> 8) & 255) + 0.0722 * kanal(n & 255);
}

/** Tło dla modelu o danym (dominującym) kolorze. Brak koloru = ciemne tło jak dotąd. */
export function tloDlaKoloru(hex: string | undefined | null): TloSceny {
  const l = luminancja(hex);
  return l !== null && l < PROG_CIEMNEGO ? TLO_JASNE : TLO_CIEMNE;
}

type ZKolorem = { color?: { r: number; g: number; b: number }; visible?: boolean };

/**
 * Średni kolor widocznych materiałów modelu, ważony liczbą wierzchołków siatki – dla wgranych GLB,
 * w których fronty nie są oznaczone (wtedy nie wiadomo, który kolor dominuje).
 */
export function sredniKolorModelu(root: Object3D): string | null {
  let r = 0;
  let g = 0;
  let b = 0;
  let waga = 0;
  root.traverseVisible((o) => {
    const mesh = o as Object3D & { isMesh?: boolean; geometry?: { attributes?: { position?: { count: number } } }; material?: ZKolorem | ZKolorem[] };
    if (!mesh.isMesh) return;
    const n = mesh.geometry?.attributes?.position?.count ?? 0;
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const mat of mats) {
      if (!mat.color || mat.visible === false) continue;
      // Kolory materiałów three są liniowe – sumujemy liniowo, na końcu wracamy do sRGB.
      r += mat.color.r * n;
      g += mat.color.g * n;
      b += mat.color.b * n;
      waga += n;
    }
  });
  if (!waga) return null;
  const doSrgb = (c: number) => {
    const v = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${doSrgb(r / waga)}${doSrgb(g / waga)}${doSrgb(b / waga)}`;
}
