/*
 * Katalog materiałów firmy (stolarni): własne płyty frontów, korpusów, blatów, obrzeża, uchwyty i okucia.
 * Zwykły moduł bez Reacta – używa go panel, strona oferty, scena 3D i Pages Functions (walidacja, snapshot).
 *
 * Id w ofercie:
 *   - wbudowane (catalog.ts: FRONTS / COUNTERTOPS / HARDWARE) – zestaw startowy i oferta demo,
 *   - "ral:<pakiet>:<kod>" – kolor z pakietu RAL (palettes.ts, tylko fronty),
 *   - "cat:<id>" – pozycja z katalogu firmy (KV catalog:<id>).
 * Kolejność szukania: wbudowane → RAL → katalog firmy. Snapshot na ofercie (materialy) ma pierwszeństwo przy cenie.
 *
 * To katalog do oferty handlowej i wizualizacji – nie rozkrój, nie lista formatek.
 */
import { COUNTERTOPS, FRONTS, HARDWARE } from "./catalog";
import { FINISH_LOOK, findRalFront, paletteFronts, type Finish, type Palette } from "./palettes";

export const KATALOG_RODZAJE = [
  "plyta_front",
  "plyta_korpus",
  "plyta_blat",
  "obrzeze",
  "uchwyt",
  "zawias",
  "prowadnica",
  "noga",
  "inne",
] as const;
export type KatalogRodzaj = (typeof KATALOG_RODZAJE)[number];

export const RODZAJ_KATALOGU_LABEL: Record<KatalogRodzaj, string> = {
  plyta_front: "Płyta frontu",
  plyta_korpus: "Płyta korpusu",
  plyta_blat: "Blat",
  obrzeze: "Obrzeże",
  uchwyt: "Uchwyt / okucie widoczne",
  zawias: "Zawias",
  prowadnica: "Prowadnica",
  noga: "Noga",
  inne: "Inne",
};

export const KATALOG_WYKONCZENIA = ["mat", "satyna", "polysk", "struktura"] as const;
export type KatalogWykonczenie = (typeof KATALOG_WYKONCZENIA)[number];
export const WYKONCZENIE_LABEL: Record<KatalogWykonczenie, string> = { mat: "Mat", satyna: "Satyna", polysk: "Połysk", struktura: "Struktura" };

export const KATALOG_JEDNOSTKI = ["szt", "m2", "mb"] as const;
export type KatalogJednostka = (typeof KATALOG_JEDNOSTKI)[number];

export type KatalogPozycja = {
  /** 10–32 znaki alfanumeryczne (jak model i pakiet RAL); w ofercie jako "cat:<id>". */
  id: string;
  kind: KatalogRodzaj;
  /** Nazwa widoczna dla klienta, np. „Egger H1180 Dąb Halifax”. */
  name: string;
  producer?: string;
  collection?: string;
  thicknessMm?: number;
  finish?: KatalogWykonczenie;
  /** Kolor do 3D i próbki, #rrggbb. */
  color: string;
  ral?: string;
  /** Dopłata netto do oferty, zł (liczba całkowita, może być ujemna). */
  delta: number;
  unit?: KatalogJednostka;
  /** Nieaktywna = nie ma jej w nowych wyborach (stare oferty dalej ją pokazują). */
  active: boolean;
  /** Uchwyt: bezuchwytowe (push-to-open / Gola) – w 3D uchwyty znikają. */
  bezUchwytu?: boolean;
  sort?: number;
  createdAt?: string;
  updatedAt?: string;
};

export const KATALOG_ID_RE = /^[A-Za-z0-9]{10,32}$/;
export const KAT_REF_RE = /^cat:([A-Za-z0-9]{10,32})$/;
export const katRef = (id: string) => `cat:${id}`;
export function parseKatRef(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = KAT_REF_RE.exec(v);
  return m ? m[1] : null;
}

/** Rola materiału w ofercie i rodzaj pozycji katalogu, który do niej pasuje. */
export type RolaMaterialu = "front" | "countertop" | "hardware";
export const RODZAJ_ROLI: Record<RolaMaterialu, KatalogRodzaj> = { front: "plyta_front", countertop: "plyta_blat", hardware: "uchwyt" };

/** Wybrany materiał w jednym kształcie, niezależnie od źródła. */
export type Material = {
  id: string;
  name: string;
  color?: string;
  delta: number;
  finish?: KatalogWykonczenie | Finish;
  thicknessMm?: number;
  producer?: string;
  bezUchwytu?: boolean;
  /** Nazwa pakietu RAL, z którego pochodzi kolor. */
  palette?: string;
  zrodlo: "wbudowany" | "ral" | "katalog";
};

/** Snapshot nazw i dopłat w ofercie z chwili zapisu w panelu – link klienta nie zmienia ceny po edycji katalogu. */
export type MaterialySnapshot = { front: Material; countertop: Material; hardware: Material; at: string };

/** Wygląd 3D z wykończenia (RAL ma mat/satyna/połysk; katalog dodaje strukturę). */
export const LOOK_WYKONCZENIA: Record<KatalogWykonczenie, { roughness: number; clearcoat: number; clearcoatRoughness: number }> = {
  ...FINISH_LOOK,
  struktura: { roughness: 0.75, clearcoat: 0.05, clearcoatRoughness: 0.6 },
};

const zKatalogu = (p: KatalogPozycja): Material => ({
  id: katRef(p.id),
  name: p.name,
  color: p.color,
  delta: p.delta,
  finish: p.finish,
  thicknessMm: p.thicknessMm,
  producer: p.producer,
  bezUchwytu: p.kind === "uchwyt" ? !!p.bezUchwytu : undefined,
  zrodlo: "katalog",
});

function katalogPozycja(katalog: readonly KatalogPozycja[], id: string, rola: RolaMaterialu) {
  const ref = parseKatRef(id);
  if (!ref) return undefined;
  return katalog.find((p) => p.id === ref && p.kind === RODZAJ_ROLI[rola]);
}

const WBUDOWANE_KOLORY_BLATU: Record<string, string> = {
  "kwarcyt-calacatta": "#ece8e1",
  "granit-absolute-black": "#1a1a1c",
  "laminat-dab": "#b48a5e",
};
const WBUDOWANE_KOLORY_UCHWYTU: Record<string, string> = { mosiadz: "#b08d57", "czarny-mat": "#1c1b1a" };

/** Front: wbudowany, z pakietu RAL albo z katalogu firmy. */
export function findFront(id: string, palettes: readonly Palette[] = [], katalog: readonly KatalogPozycja[] = []): Material | undefined {
  const b = FRONTS.find((f) => f.id === id);
  if (b) return { ...b, zrodlo: "wbudowany" };
  const ral = findRalFront(palettes as Palette[], id);
  if (ral) return { id: ral.id, name: ral.name, color: ral.color, delta: ral.delta, finish: ral.finish, palette: ral.palette, zrodlo: "ral" };
  const k = katalogPozycja(katalog, id, "front");
  return k ? zKatalogu(k) : undefined;
}

export function findCountertop(id: string, katalog: readonly KatalogPozycja[] = []): Material | undefined {
  const b = COUNTERTOPS.find((c) => c.id === id);
  if (b) return { ...b, color: WBUDOWANE_KOLORY_BLATU[b.id], zrodlo: "wbudowany" };
  const k = katalogPozycja(katalog, id, "countertop");
  return k ? zKatalogu(k) : undefined;
}

export function findHardware(id: string, katalog: readonly KatalogPozycja[] = []): Material | undefined {
  const b = HARDWARE.find((h) => h.id === id);
  if (b) return { ...b, color: WBUDOWANE_KOLORY_UCHWYTU[b.id], bezUchwytu: b.id === "push-to-open", zrodlo: "wbudowany" };
  const k = katalogPozycja(katalog, id, "hardware");
  return k ? zKatalogu(k) : undefined;
}

export type KontekstMaterialow = {
  palettes?: readonly Palette[];
  katalog?: readonly KatalogPozycja[];
  /** Snapshot z oferty: dla tych samych id ma pierwszeństwo (nazwa i dopłata z chwili zapisu). */
  snapshot?: MaterialySnapshot | null;
};

export function findMaterial(rola: RolaMaterialu, id: string, ctx: KontekstMaterialow = {}): Material | undefined {
  const snap = ctx.snapshot?.[rola];
  if (snap && snap.id === id) return snap;
  if (rola === "front") return findFront(id, ctx.palettes, ctx.katalog);
  if (rola === "countertop") return findCountertop(id, ctx.katalog);
  return findHardware(id, ctx.katalog);
}

/** Dopłata do ceny (0, gdy materiału już nie ma). */
export const deltaMaterialu = (rola: RolaMaterialu, id: string, ctx: KontekstMaterialow = {}) => findMaterial(rola, id, ctx)?.delta ?? 0;

/**
 * Opcje do wyboru dla roli: aktywne pozycje firmy danego rodzaju; gdy firma nie ma żadnej – zestaw wbudowany.
 * Fronty dostają też kolory z pakietów RAL. Wybrana wcześniej opcja zostaje na liście, nawet nieaktywna.
 */
export function opcjeMaterialu(rola: RolaMaterialu, ctx: KontekstMaterialow = {}, wybrany?: string): Material[] {
  const katalog = ctx.katalog ?? [];
  const wlasne = katalog
    .filter((p) => p.kind === RODZAJ_ROLI[rola] && p.active)
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name, "pl"))
    .map(zKatalogu);
  let out: Material[];
  if (wlasne.length) out = wlasne;
  else if (rola === "front") out = FRONTS.map((f) => ({ ...f, zrodlo: "wbudowany" as const }));
  else if (rola === "countertop") out = COUNTERTOPS.map((c) => findCountertop(c.id)!);
  else out = HARDWARE.map((h) => findHardware(h.id)!);
  if (rola === "front") {
    for (const r of paletteFronts((ctx.palettes ?? []) as Palette[])) {
      out.push({ id: r.id, name: r.name, color: r.color, delta: r.delta, finish: r.finish, palette: r.palette, zrodlo: "ral" });
    }
  }
  if (wybrany && !out.some((o) => o.id === wybrany)) {
    const m = findMaterial(rola, wybrany, ctx);
    if (m) out.unshift(m);
  }
  return out;
}

/** Snapshot materiałów oferty (liczy serwer przy zapisie). Brak materiału = nazwa z id i dopłata 0. */
export function snapshotMaterialow(
  sel: { front: string; countertop: string; hardware: string },
  ctx: KontekstMaterialow,
  at = new Date().toISOString(),
): MaterialySnapshot {
  const bez = (rola: RolaMaterialu, id: string): Material =>
    findMaterial(rola, id, { palettes: ctx.palettes, katalog: ctx.katalog }) ?? { id, name: id, delta: 0, zrodlo: "katalog" };
  return { front: bez("front", sel.front), countertop: bez("countertop", sel.countertop), hardware: bez("hardware", sel.hardware), at };
}

/** Zestaw startowy firmy = kopia wbudowanych materiałów jako pozycje katalogu (przycisk w Ustawieniach). */
export function zestawStartowy(): Omit<KatalogPozycja, "id">[] {
  return [
    ...FRONTS.map((f, i) => ({ kind: "plyta_front" as const, name: f.name, color: f.color, delta: f.delta, finish: (f.id.startsWith("dab") ? "struktura" : "satyna") as KatalogWykonczenie, thicknessMm: 18, active: true, sort: i })),
    ...COUNTERTOPS.map((c, i) => ({ kind: "plyta_blat" as const, name: c.name, color: WBUDOWANE_KOLORY_BLATU[c.id] ?? "#cccccc", delta: c.delta, finish: (c.id === "laminat-dab" ? "struktura" : "polysk") as KatalogWykonczenie, thicknessMm: 38, active: true, sort: i })),
    ...HARDWARE.map((h, i) => ({ kind: "uchwyt" as const, name: h.name, color: WBUDOWANE_KOLORY_UCHWYTU[h.id] ?? "#888888", delta: h.delta, finish: (h.id === "czarny-mat" ? "mat" : "polysk") as KatalogWykonczenie, bezUchwytu: h.id === "push-to-open", active: true, sort: i })),
    { kind: "plyta_korpus", name: "Biały korpus 18 mm", color: "#f2f1ee", delta: 0, finish: "mat", thicknessMm: 18, active: true, sort: 0 },
    { kind: "obrzeze", name: "Obrzeże ABS 1 mm w kolorze płyty", color: "#f2f1ee", delta: 0, thicknessMm: 1, unit: "mb", active: true, sort: 0 },
  ];
}

/** Pozycja dla strony klienta: bez dat; przy ukrytej cenie bez dopłaty. */
export const publicznaPozycja = (p: KatalogPozycja, showPrice: boolean): KatalogPozycja => {
  const { createdAt: _c, updatedAt: _u, ...reszta } = p;
  void _c;
  void _u;
  return { ...reszta, delta: showPrice ? p.delta : 0 };
};
