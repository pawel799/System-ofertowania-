/*
 * Okucia, które oferta pokazuje jako osobne pozycje: wysuwy (typ prowadnic szuflad i cargo), kosze cargo,
 * mechanizm cargo wysokie, mechanizm narożnika typu LeMans. Wspólne dla ceny (kuchnia.ts → bazaKuchni,
 * cenaKoncowa), PDF oferty i listy formatek. Nazwy systemów tylko opisowo, bez marek producentów.
 *
 * Zgodność wstecz: szuflada bez wybranego typu prowadnic liczy się jak dotąd (dopłata „szuflada” z cennika
 * w cenie mebla) i nie trafia tutaj. Pozycja okuć powstaje dopiero, gdy mebel ma typ prowadnic albo jest
 * cargo / LeMans (nowe rodzaje) – stare oferty mają tu pustą listę i tę samą cenę.
 *
 * Wymiary elementu w cm (jak plan), długości okuć w mm.
 */
import type { ModulCennik } from "./modul";
import { wnetrzeDomyslne, zliczWnetrze, type StronaLP, type Wnetrze } from "./wnetrze";

export type TypProwadnic = "rolkowe" | "kulkowe" | "ukryte";
export const TYPY_PROWADNIC: readonly TypProwadnic[] = ["rolkowe", "kulkowe", "ukryte"];
export const PROWADNICE_LABEL: Record<TypProwadnic, string> = {
  rolkowe: "rolkowe",
  kulkowe: "kulkowe, pełny wysuw",
  ukryte: "ukryte z cichym domykiem",
};
/** Cargo i LeMans bez wybranego typu: ukryte z cichym domykiem (tak się je zwykle zamawia). */
export const PROWADNICE_CARGO: TypProwadnic = "ukryte";

export type KluczOkucia = "prowadnice-rolkowe" | "prowadnice-kulkowe" | "prowadnice-ukryte" | "kosz-cargo" | "cargo-wysokie" | "lemans";
export const KLUCZE_OKUC: readonly KluczOkucia[] = ["prowadnice-rolkowe", "prowadnice-kulkowe", "prowadnice-ukryte", "kosz-cargo", "cargo-wysokie", "lemans"];
export const OKUCIE_LABEL: Record<KluczOkucia, string> = {
  "prowadnice-rolkowe": "Prowadnice rolkowe (kpl.)",
  "prowadnice-kulkowe": "Prowadnice kulkowe, pełny wysuw (kpl.)",
  "prowadnice-ukryte": "Prowadnice ukryte z cichym domykiem (kpl.)",
  "kosz-cargo": "Kosz cargo dolny, 2 poziomy (kpl.)",
  "cargo-wysokie": "Mechanizm cargo wysokie z koszami (kpl.)",
  lemans: "Mechanizm narożny typu LeMans (kpl.)",
};
/** Ceny netto za komplet, gdy cennik firmy ich nie ma [zł]. */
export const CENY_OKUC_DOMYSLNE: Record<KluczOkucia, number> = {
  "prowadnice-rolkowe": 30,
  "prowadnice-kulkowe": 70,
  "prowadnice-ukryte": 160,
  "kosz-cargo": 420,
  "cargo-wysokie": 1500,
  lemans: 1100,
};

export const cenaOkucia = (k: KluczOkucia, c: Pick<ModulCennik, "okucia">) => c.okucia?.[k] ?? CENY_OKUC_DOMYSLNE[k];

type ElementOkuc = {
  rodzaj?: string;
  strefa: string;
  zrodlo?: string;
  w: number;
  h: number;
  d: number;
  wnetrze?: Wnetrze;
  prowadnice?: TypProwadnic;
  lemans?: { strona: StronaLP };
};

/** Długość prowadnicy [mm] z głębokości mebla [cm]: najbliższa mniejsza pełna 50-tka (plecy i luz 40 mm). */
export const dlugoscProwadnicy = (dCm: number) => Math.max(250, Math.min(650, Math.floor((dCm * 10 - 3 - 40) / 50) * 50));

/** Kosze w cargo wysokim: 5 do 200 cm wysokości, wyżej 6. */
export const koszeCargoWysokiego = (hCm: number) => (hCm > 200 ? 6 : 5);

export const jestCargo = (el: { rodzaj?: string }) => el.rodzaj === "cargo";
export const cargoWysokie = (el: { rodzaj?: string; strefa: string }) => jestCargo(el) && el.strefa === "wysoka";

/** Typ prowadnic mebla: wybrany, a dla cargo bez wyboru – ukryte. null = szuflady „jak dotąd” (bez osobnej pozycji). */
export function prowadniceElementu(el: Pick<ElementOkuc, "rodzaj" | "prowadnice">): TypProwadnic | null {
  if (el.prowadnice) return el.prowadnice;
  return jestCargo(el) ? PROWADNICE_CARGO : null;
}

/** Ile kompletów prowadnic mebel ma: szuflady z wnętrza (z frontem albo za drzwiami) albo 1 dla cargo. */
export function kompletyProwadnic(el: ElementOkuc): number {
  if (el.zrodlo === "model") return 0;
  if (jestCargo(el)) return 1;
  if (el.rodzaj === "lemans") return 0;
  const wn = el.wnetrze ?? wnetrzeDomyslne(el);
  return wn ? zliczWnetrze(el, wn).szuflady : 0;
}

/** Czy przy tym meblu wybór typu prowadnic ma sens (szuflady albo cargo). */
export const maProwadnice = (el: ElementOkuc) => kompletyProwadnic(el) > 0;

/** wariant – np. strona mechanizmu LeMans (L/P): osobna pozycja do zamówienia, ta sama cena. */
export type PozycjaOkuc = { klucz: KluczOkucia; wariant?: StronaLP; nazwa: string; ilosc: number };

const nazwaOkucia = (k: KluczOkucia, wariant?: StronaLP) =>
  wariant ? OKUCIE_LABEL[k].replace(" (kpl.)", `, ${wariant === "L" ? "lewy" : "prawy"} (kpl.)`) : OKUCIE_LABEL[k];

/** Okucia jednego mebla jako pozycje oferty (patrz komentarz na górze: stare meble – pusta lista). */
export function okuciaElementu(el: ElementOkuc): PozycjaOkuc[] {
  if (el.zrodlo === "model") return [];
  const out: PozycjaOkuc[] = [];
  const typ = prowadniceElementu(el);
  const n = kompletyProwadnic(el);
  if (typ && n) out.push({ klucz: `prowadnice-${typ}`, nazwa: OKUCIE_LABEL[`prowadnice-${typ}`], ilosc: n });
  if (jestCargo(el)) {
    if (cargoWysokie(el)) out.push({ klucz: "cargo-wysokie", nazwa: OKUCIE_LABEL["cargo-wysokie"], ilosc: 1 });
    else out.push({ klucz: "kosz-cargo", nazwa: OKUCIE_LABEL["kosz-cargo"], ilosc: 1 });
  }
  if (el.rodzaj === "lemans") {
    const strona = el.lemans?.strona ?? "L";
    out.push({ klucz: "lemans", wariant: strona, nazwa: nazwaOkucia("lemans", strona), ilosc: 1 });
  }
  return out;
}

/** Okucia całego planu zsumowane po rodzaju i wariancie (kolejność jak KLUCZE_OKUC, potem L przed P). */
export function okuciaPlanu(elementy: readonly ElementOkuc[]): PozycjaOkuc[] {
  const suma = new Map<string, PozycjaOkuc>();
  for (const el of elementy)
    for (const p of okuciaElementu(el)) {
      const k = `${p.klucz}|${p.wariant ?? ""}`;
      const b = suma.get(k);
      suma.set(k, b ? { ...b, ilosc: b.ilosc + p.ilosc } : { ...p });
    }
  const kolej = (p: PozycjaOkuc) => KLUCZE_OKUC.indexOf(p.klucz) * 3 + (p.wariant === "P" ? 2 : p.wariant === "L" ? 1 : 0);
  return Array.from(suma.values()).sort((a, b) => kolej(a) - kolej(b));
}
