/*
 * Pakiety kolorów RAL (fronty). Pakiet = nazwa, wykończenie, wybrane kody RAL
 * i dopłata. Zapisuje je panel (/panel/ustawienia → Kolory RAL), a w ofercie
 * front z pakietu ma id "ral:<id pakietu>:<kod>", np. "ral:Ab12Cd34Ef:9010".
 * Zwykły moduł bez Reacta – używa go panel, strona oferty i walidacja API.
 */
import { ralByCode } from "./ral";

export type Finish = "mat" | "satyna" | "polysk";

export const FINISHES: Finish[] = ["mat", "satyna", "polysk"];

export const FINISH_LABEL: Record<Finish, string> = {
  mat: "Mat",
  satyna: "Satyna",
  polysk: "Połysk",
};

/** Jak wykończenie wygląda w 3D (chropowatość i lakier). */
export const FINISH_LOOK: Record<Finish, { roughness: number; clearcoat: number; clearcoatRoughness: number }> = {
  mat: { roughness: 0.85, clearcoat: 0, clearcoatRoughness: 0.5 },
  satyna: { roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.35 },
  polysk: { roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05 },
};

export type Palette = {
  id: string;
  name: string;
  finish: Finish;
  /** Kody RAL Classic bez przedrostka, np. "9010". */
  colors: string[];
  /** Dopłata w zł za front z tego pakietu (0 = w cenie). */
  delta: number;
  createdAt?: string;
  updatedAt?: string;
};

export const PALETTE_ID_RE = /^[A-Za-z0-9]{10,32}$/;
export const RAL_FRONT_RE = /^ral:([A-Za-z0-9]{10,32}):(\d{4})$/;

export const ralFrontId = (paletteId: string, code: string) => `ral:${paletteId}:${code}`;

export function parseRalFront(id: string): { paletteId: string; code: string } | null {
  const m = RAL_FRONT_RE.exec(id);
  return m ? { paletteId: m[1], code: m[2] } : null;
}

/** Front do wyboru (próbka): taki sam kształt jak FRONTS z katalogu + wykończenie. */
export type FrontChoice = {
  id: string;
  name: string;
  color: string;
  delta: number;
  finish?: Finish;
  /** Nazwa pakietu, z którego pochodzi kolor. */
  palette?: string;
};

/** Wszystkie kolory ze wszystkich pakietów jako próbki frontów. */
export function paletteFronts(palettes: Palette[]): FrontChoice[] {
  const out: FrontChoice[] = [];
  for (const p of palettes) {
    for (const code of p.colors) {
      const ral = ralByCode(code);
      if (!ral) continue;
      out.push({
        id: ralFrontId(p.id, code),
        name: `RAL ${code} ${ral.name} · ${FINISH_LABEL[p.finish].toLowerCase()}`,
        color: ral.hex,
        delta: p.delta,
        finish: p.finish,
        palette: p.name,
      });
    }
  }
  return out;
}

/** Front z pakietu po id ("ral:…"); undefined, gdy pakietu albo koloru już nie ma. */
export function findRalFront(palettes: Palette[], id: string): FrontChoice | undefined {
  const ref = parseRalFront(id);
  if (!ref) return undefined;
  const p = palettes.find((x) => x.id === ref.paletteId);
  if (!p || !p.colors.includes(ref.code)) return undefined;
  return paletteFronts([{ ...p, colors: [ref.code] }])[0];
}
