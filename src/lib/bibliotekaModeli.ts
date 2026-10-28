/*
 * Biblioteka modeli GLB.
 * Kuchnia: seed/modele-kuchnia-50 (mk01–mk50). 01–46 wstawia kreator, 47–50 są modelem całej oferty.
 * Szafy, szafki i komody: seed/modele-szafy-komody-100 (ms001–ms100). Wszystkie wstawia kreator jak moduły.
 * Id są w id-map.json i spełniają ASSET_ID_RE. Po seedzie te same id wracają z GET /api/models.
 */
import type { RodzajElementu, Strefa } from "./kuchnia";
import mapaKuchnia from "../../seed/modele-kuchnia-50/id-map.json";
import mapaMeble from "../../seed/modele-szafy-komody-100/id-map.json";

export type GrupaBiblioteki = "dolne" | "gorne" | "slupki" | "blaty" | "agd" | "dodatki" | "szafy" | "szafki" | "komody";
export type UzycieModelu = "modul" | "kuchnia";

export type WpisModelu = {
  nr: number;
  katalogId: string;
  id: string;
  plik: string;
  nazwa: string;
  kategoria: string;
  uzycie: UzycieModelu;
  grupa: GrupaBiblioteki | null;
  strefa: Strefa | null;
  rodzaj: RodzajElementu | null;
  w: number;
  h: number;
  d: number;
};

export const GRUPY_BIBLIOTEKI: { id: GrupaBiblioteki; label: string }[] = [
  { id: "dolne", label: "Szafki dolne (model 3D)" },
  { id: "gorne", label: "Szafki górne (model 3D)" },
  { id: "slupki", label: "Słupki (model 3D)" },
  { id: "blaty", label: "Blaty (model 3D)" },
  { id: "agd", label: "AGD (model 3D)" },
  { id: "dodatki", label: "Dodatki (model 3D)" },
  { id: "szafy", label: "Szafy" },
  { id: "szafki", label: "Szafki" },
  { id: "komody", label: "Komody" },
];

export const WPISY_MODELI: readonly WpisModelu[] = [...mapaKuchnia.modele, ...mapaMeble.modele] as WpisModelu[];

const poId = new Map(WPISY_MODELI.map((w) => [w.id, w]));
if (poId.size !== WPISY_MODELI.length) {
  throw new Error("Biblioteka modeli ma powtórzone id.");
}

export function wpisPoId(id: string): WpisModelu | undefined {
  return poId.get(id);
}

export function podzielModele<T extends { id: string }>(models: readonly T[]) {
  const moduly: { model: T; wpis: WpisModelu }[] = [];
  const kuchnie: { model: T; wpis: WpisModelu }[] = [];
  const wlasne: T[] = [];
  for (const model of models) {
    const wpis = poId.get(model.id);
    if (!wpis) wlasne.push(model);
    else if (wpis.uzycie === "kuchnia") kuchnie.push({ model, wpis });
    else moduly.push({ model, wpis });
  }
  moduly.sort((a, b) => a.wpis.nr - b.wpis.nr);
  kuchnie.sort((a, b) => a.wpis.nr - b.wpis.nr);
  return { moduly, kuchnie, wlasne };
}

/** Selektor modelu całej oferty: gotowe kuchnie i własne GLB, bez szafek z biblioteki. */
export function pokazWyborModelu(models: readonly { id: string }[], value: string) {
  if (value) return true;
  const { kuchnie, wlasne } = podzielModele(models);
  return kuchnie.length + wlasne.length > 0;
}
