/*
 * Ściany pomieszczenia (cm). Dwa rodzaje pokoju:
 *   prostokąt – A i B jak w rzucie (A wzdłuż x przy z = 0, B wzdłuż z przy x = 0), C naprzeciw A, D naprzeciw B
 *               (C i D, gdy podano wymiary pokoju w kroku „Pomiar”);
 *   dowolny kształt – obrys (plan.sciany.obrys): wielokąt 3–16 narożników, v0 = (0, 0), v1 na osi x.
 *               A = v0→v1, B = v0→v(n−1), C = v(n−1)→v(n−2), … – jak w prostokącie: A i B wychodzą z narożnika zabudowy,
 *               C naprzeciw A, dalsze litery dookoła pokoju.
 * Otwory (okna, drzwi) i gniazdka leżą na ścianach – „od” liczone od początku ściany.
 * Wspólne dla sceny 3D, rzutu, przesuwania otworów, kolizji mebli i rysunku technicznego.
 *
 * Bez importów z kuchnia.ts – plan podany strukturalnie.
 */
import { LITERY_SCIAN, type LiteraSciany } from "./wywiad";

export type ScianaPokoju = LiteraSciany;
export const SCIANY_POKOJU: readonly ScianaPokoju[] = LITERY_SCIAN;
/** Najwięcej ścian pokoju (litery A–P). */
export const MAX_SCIAN_POKOJU = LITERY_SCIAN.length;
export const SCIANA_LABEL: Record<"A" | "B" | "C" | "D", string> = { A: "Ściana A", B: "Ściana B", C: "Ściana C (naprzeciw A)", D: "Ściana D (naprzeciw B)" };

/** Nazwa ściany do list i podpisów: w prostokącie „Ściana C (naprzeciw A)”, w innym kształcie „Ściana C”. */
export function etykietaSciany(plan: PlanScian, id: ScianaPokoju) {
  if (!czyObrys(plan) && id in SCIANA_LABEL) return SCIANA_LABEL[id as keyof typeof SCIANA_LABEL];
  return `Ściana ${id}`;
}

/** Domyślna wysokość pomieszczenia [cm], gdy nie podano w pomiarze. */
export const WYSOKOSC_DOMYSLNA = 260;

/** Ściany pokoju, które można usunąć (otwarta przestrzeń). A zostaje zawsze – od niej liczy się zabudowa. */
export type ScianaUsuwalna = Exclude<ScianaPokoju, "A">;

export type Punkt = { x: number; z: number };

/**
 * Dodatkowa ściana: działowa, skos, wnęka, ścianka przy wyspie. Prostokąt w rzucie obrócony o `kat`,
 * środek w (x, z), długość wzdłuż kierunku, grubość w poprzek. Stoi na podłodze, wysokość do sufitu albo własna.
 */
export type ScianaDodatkowa = {
  id: string;
  /** Środek w rzucie [cm]. */
  x: number;
  z: number;
  dlugosc: number;
  /** Kierunek w rzucie [°]: 0 = wzdłuż ściany A (oś x), 90 = wzdłuż ściany B (oś z). Zakres 0–179. */
  kat: number;
  grubosc: number;
  /** Wysokość [cm]; brak = do sufitu. */
  wysokosc?: number;
  /** Własny kolor ścianki (#rrggbb); brak = kolor ścian. */
  kolor?: string;
};

/** Ustawienia ścian w planie (plan.sciany): kolor, usunięte ściany pokoju, dodatkowe ściany, sufit. */
export type UstawieniaScian = {
  kolor?: string;
  /** Pokój o dowolnym kształcie: narożniki w kolejności (v0 = (0, 0), v1 na osi x, wszystkie x, z ≥ 0). Brak = prostokąt. */
  obrys?: Punkt[];
  bez?: ScianaUsuwalna[];
  dodatkowe?: ScianaDodatkowa[];
  /** Sufit w 3D (na wysokości pokoju); kolor domyślnie biały. */
  sufit?: { kolor?: string };
  /** Podłoga w 3D: panele albo płytki, kolor (#rrggbb); brak = panele w kolorze dębu. */
  podloga?: { rodzaj: RodzajPodlogi; kolor?: string };
  /** Kolory pojedynczych ścian pokoju (#rrggbb); ściana bez wpisu ma kolor ścian (kolor ze sceny). */
  koloryScian?: Partial<Record<ScianaPokoju, string>>;
  /** Grubość pojedynczych ścian pokoju [cm] (na zewnątrz od wewnętrznej strony); brak = GRUBOSC_SCIANY. */
  grubosci?: Partial<Record<ScianaPokoju, number>>;
  /** Wysokość pojedynczych ścian pokoju [cm]; brak = do sufitu. */
  wysokosci?: Partial<Record<ScianaPokoju, number>>;
};

export type RodzajPodlogi = "panele" | "plytki";
export const PODLOGI: Record<RodzajPodlogi, { nazwa: string; domyslny: string; kolory: { kolor: string; nazwa: string }[] }> = {
  panele: {
    nazwa: "Panele",
    domyslny: "#c9a27c",
    kolory: [
      { kolor: "#c9a27c", nazwa: "Dąb naturalny" },
      { kolor: "#e2d5c3", nazwa: "Dąb bielony" },
      { kolor: "#a89f95", nazwa: "Dąb szary" },
      { kolor: "#8a6446", nazwa: "Orzech" },
      { kolor: "#4d3c30", nazwa: "Wenge" },
    ],
  },
  plytki: {
    nazwa: "Płytki",
    domyslny: "#d9d6d0",
    kolory: [
      { kolor: "#f0eeea", nazwa: "Biały" },
      { kolor: "#d9d6d0", nazwa: "Jasnoszary" },
      { kolor: "#d9c9b0", nazwa: "Beż" },
      { kolor: "#8d8b88", nazwa: "Szary" },
      { kolor: "#46464a", nazwa: "Grafit" },
    ],
  },
};

/** Podłoga z planu (domyślnie panele dąb naturalny). */
export const podlogaPlanu = (plan: { sciany?: UstawieniaScian | null }) => {
  const rodzaj = plan.sciany?.podloga?.rodzaj ?? "panele";
  return { rodzaj, kolor: plan.sciany?.podloga?.kolor ?? PODLOGI[rodzaj].domyslny };
};

export const LIMITY_SCIANY = { dlugosc: [20, 2000], grubosc: [5, 60], wysokosc: [30, 450], poz: [-1000, 3000] } as const;
export const MAX_SCIAN_DODATKOWYCH = 30;
export const GRUBOSC_SCIANY = 12;
export const KOLOR_SUFITU = "#f4f2ee";

type PlanScian = {
  uklad: "ciag" | "L";
  scianaA: number;
  scianaB: number;
  pomieszczenie: { szer: number; dlug: number } | null;
  wywiad?: { wysokosc?: number } | null;
  sciany?: UstawieniaScian | null;
};

export type Sciana = {
  id: ScianaPokoju;
  /** Początek ściany i kierunek wzdłuż niej (cm, rzut x/z). */
  x: number;
  z: number;
  dx: number;
  dz: number;
  dlugosc: number;
  /** Normalna do wnętrza pokoju. */
  nx: number;
  nz: number;
  /** Obrót płaszczyzny ściany w 3D wokół osi y (normalna +z → do wnętrza). */
  obrot: number;
};

export function wysokoscPokoju(plan: PlanScian) {
  return plan.wywiad?.wysokosc ?? WYSOKOSC_DOMYSLNA;
}

/** Grubość ściany pokoju [cm] (rzut i wierzch muru w 3D). */
export const gruboscScianyPokoju = (plan: PlanScian, id: ScianaPokoju) => plan.sciany?.grubosci?.[id] ?? GRUBOSC_SCIANY;

/** Wysokość ściany pokoju [cm] – własna (niższa ścianka) albo do sufitu. */
export const wysokoscScianyPokoju = (plan: PlanScian, id: ScianaPokoju) => Math.min(plan.sciany?.wysokosci?.[id] ?? wysokoscPokoju(plan), wysokoscPokoju(plan));

const sciana = (id: ScianaPokoju, x: number, z: number, dx: number, dz: number, dlugosc: number, nx: number, nz: number): Sciana => ({
  id,
  x,
  z,
  dx,
  dz,
  dlugosc,
  nx,
  nz,
  obrot: Math.atan2(nx, nz),
});

/** Pokój o dowolnym kształcie (obrys z co najmniej 3 narożnikami). */
export const czyObrys = (plan: PlanScian) => (plan.sciany?.obrys?.length ?? 0) >= 3;

/** Punkt wewnątrz wielokąta (promień w prawo, parzystość przecięć). */
export function wWielokacie(p: Punkt, w: readonly Punkt[]) {
  let wew = false;
  for (let i = 0, j = w.length - 1; i < w.length; j = i++) {
    const a = w[i];
    const b = w[j];
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) wew = !wew;
  }
  return wew;
}

/** Krawędzie obrysu w kolejności liter: A = v0→v1, B = v0→v(n−1), C = v(n−1)→v(n−2), …, ostatnia = v2→v1. */
export function krawedzieObrysu(n: number): [number, number][] {
  const out: [number, number][] = [
    [0, 1],
    [0, n - 1],
  ];
  for (let k = 2; k < n; k++) out.push([n - k + 1, n - k]);
  return out;
}

/** Ściany pokoju z obrysu (normalne do środka pokoju). */
export function scianyObrysu(obrys: readonly Punkt[]): Sciana[] {
  return krawedzieObrysu(obrys.length).map(([i, j], k) => {
    const P = obrys[i];
    const Q = obrys[j];
    const L = Math.hypot(Q.x - P.x, Q.z - P.z) || 1;
    const dx = (Q.x - P.x) / L;
    const dz = (Q.z - P.z) / L;
    const mid = { x: (P.x + Q.x) / 2, z: (P.z + Q.z) / 2 };
    // Normalna w lewo albo w prawo – ta, która wskazuje do środka pokoju.
    const lewa = wWielokacie({ x: mid.x - dz * 1, z: mid.z + dx * 1 }, obrys);
    const [nx, nz] = lewa ? [-dz, dx] : [dz, -dx];
    return sciana(LITERY_SCIAN[k], P.x, P.z, dx, dz, Math.round(L * 10) / 10, nx, nz);
  });
}

/** Ściany prostokąta (bez obrysu): A zawsze, B w L albo przy wymiarach pokoju, C i D przy wymiarach pokoju. */
function scianyProstokata(plan: PlanScian): Sciana[] {
  const pom = plan.pomieszczenie;
  const LA = Math.max(plan.scianaA, pom?.szer ?? 0);
  const LB = Math.max(plan.uklad === "L" ? plan.scianaB : 0, pom?.dlug ?? 0);
  const out: Sciana[] = [sciana("A", 0, 0, 1, 0, LA, 0, 1)];
  if (plan.uklad === "L" || pom) out.push(sciana("B", 0, 0, 0, 1, LB, 1, 0));
  if (pom) {
    out.push(sciana("C", 0, LB, 1, 0, LA, 0, -1));
    out.push(sciana("D", LA, 0, 0, 1, LB, -1, 0));
  }
  return out;
}

/** Ściany, które są w projekcie (bez usuniętych – otwarta przestrzeń). */
export function scianyPokoju(plan: PlanScian): Sciana[] {
  const out = czyObrys(plan) ? scianyObrysu(plan.sciany!.obrys!) : scianyProstokata(plan);
  const bez = plan.sciany?.bez;
  if (!bez?.length) return out;
  return out.filter((s) => s.id === "A" || (s.id === "B" && plan.uklad === "L") || !bez.includes(s.id as ScianaUsuwalna));
}

/** Ściany pokoju, które da się mieć (przed usunięciem) – do listy „jest / otwarta przestrzeń”. */
export function scianyPokojuWszystkie(plan: PlanScian): Sciana[] {
  return czyObrys(plan) ? scianyObrysu(plan.sciany!.obrys!) : scianyProstokata(plan);
}

export function scianaPoId(plan: PlanScian, id: ScianaPokoju) {
  return scianyPokoju(plan).find((s) => s.id === id) ?? null;
}

/** Punkt na ścianie (cm od początku ściany) → rzut x/z. */
export const punktNaScianie = (s: Sciana, od: number) => ({ x: s.x + s.dx * od, z: s.z + s.dz * od });

type OtworNaScianie = { rodzaj: "okno" | "drzwi"; od: number; szer: number; parapet?: number };

/** Pionowy zakres otworu [cm od podłogi]: okno od parapetu (domyślnie 90) do ok. 30 cm pod sufitem (max 140), drzwi 205. */
export function wysokoscOtworu(o: OtworNaScianie, wysokosc: number): { y0: number; y1: number } {
  if (o.rodzaj === "drzwi") return { y0: 0, y1: Math.min(205, wysokosc - 10) };
  const y0 = o.parapet ?? 90;
  return { y0, y1: y0 + Math.max(40, Math.min(140, wysokosc - 30 - y0)) };
}

/** Prostokąty ściany bez otworów (cm: od–do wzdłuż ściany, y0–y1) – ściana w 3D z prawdziwymi dziurami. */
export function segmentySciany(dlugosc: number, wysokosc: number, otwory: readonly OtworNaScianie[]) {
  const dziury = otwory
    .map((o) => ({ a: Math.max(0, o.od), b: Math.min(dlugosc, o.od + o.szer), ...wysokoscOtworu(o, wysokosc) }))
    .filter((d) => d.b > d.a)
    .sort((p, q) => p.a - q.a);
  const out: { a: number; b: number; y0: number; y1: number }[] = [];
  let x = 0;
  for (const d of dziury) {
    if (d.a > x) out.push({ a: x, b: d.a, y0: 0, y1: wysokosc });
    const a = Math.max(x, d.a);
    if (d.b > a) {
      if (d.y0 > 0) out.push({ a, b: d.b, y0: 0, y1: d.y0 });
      if (d.y1 < wysokosc) out.push({ a, b: d.b, y0: d.y1, y1: wysokosc });
    }
    x = Math.max(x, d.b);
  }
  if (x < dlugosc) out.push({ a: x, b: dlugosc, y0: 0, y1: wysokosc });
  return out;
}

/* ---------- kolory ścian ---------- */

export type KolorSciany = { id: string; nazwa: string; kolor: string };

/** Typowe farby – w kreatorze można też wpisać własny kolor. */
export const KOLORY_SCIAN: readonly KolorSciany[] = [
  { id: "bialy", nazwa: "Biały", kolor: "#f2f0eb" },
  { id: "jasnoszary", nazwa: "Jasny szary", kolor: "#d9d8d4" },
  { id: "bez", nazwa: "Beż", kolor: "#e6dccb" },
  { id: "greige", nazwa: "Greige", kolor: "#c9c0b3" },
  { id: "szalwia", nazwa: "Szałwia", kolor: "#b9c3ad" },
  { id: "blekit", nazwa: "Błękit", kolor: "#bfcfd8" },
  { id: "terakota", nazwa: "Terakota", kolor: "#c98f73" },
  { id: "antracyt", nazwa: "Antracyt", kolor: "#4a4c4f" },
];

export const KOLOR_SCIANY_RE = /^#[0-9a-f]{6}$/i;

export function nazwaKoloruSciany(kolor: string | null | undefined) {
  if (!kolor) return "Domyślny";
  return KOLORY_SCIAN.find((k) => k.kolor.toLowerCase() === kolor.toLowerCase())?.nazwa ?? kolor;
}

/**
 * Położenie mebla w granicach pokoju: obrys (prostokąt w rzucie, cm) nie wychodzi za ściany, które są w projekcie.
 * Dla każdej ściany, wzdłuż której leży mebel, narożniki za ścianą wracają do środka pokoju. Zwraca przesunięcie środka.
 */
export function wGranicachPokoju(plan: PlanScian, r: { x0: number; z0: number; x1: number; z1: number }, x: number, z: number) {
  let px = 0;
  let pz = 0;
  for (const s of scianyPokoju(plan)) {
    const rogi = [
      { x: r.x0 + px, z: r.z0 + pz },
      { x: r.x1 + px, z: r.z0 + pz },
      { x: r.x1 + px, z: r.z1 + pz },
      { x: r.x0 + px, z: r.z1 + pz },
    ];
    const t = rogi.map((p) => (p.x - s.x) * s.dx + (p.z - s.z) * s.dz);
    if (Math.max(...t) <= 1 || Math.min(...t) >= s.dlugosc - 1) continue;
    const d = rogi.map((p) => (p.x - s.x) * s.nx + (p.z - s.z) * s.nz);
    const min = Math.min(...d);
    // Mebel cały za ścianą (np. po drugiej stronie wnęki) – nie ciągniemy go przez ścianę.
    if (min < 0 && Math.max(...d) > 0) {
      px += -min * s.nx;
      pz += -min * s.nz;
    }
  }
  return { x: Math.round(x + px), z: Math.round(z + pz) };
}

/* ---------- pokój o dowolnym kształcie ---------- */

export const MIN_SCIANA = 20;

/** Czy odcinki ab i cd przecinają się (bez stykania końcami). */
function przecinaja(a: Punkt, b: Punkt, c: Punkt, d: Punkt) {
  const o = (p: Punkt, q: Punkt, r: Punkt) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
  const d1 = o(c, d, a);
  const d2 = o(c, d, b);
  const d3 = o(a, b, c);
  const d4 = o(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

export const poleObrysu = (w: readonly Punkt[]) => Math.abs(w.reduce((s, p, i) => s + p.x * w[(i + 1) % w.length].z - w[(i + 1) % w.length].x * p.z, 0)) / 2;

/** Błędy obrysu (pusta lista = poprawny pokój). */
export function sprawdzObrys(w: readonly Punkt[]): string[] {
  const out: string[] = [];
  if (w.length < 3) return ["Pokój musi mieć co najmniej 3 ściany."];
  if (w.length > MAX_SCIAN_POKOJU) out.push(`Najwyżej ${MAX_SCIAN_POKOJU} ścian.`);
  if (w[0].x !== 0 || w[0].z !== 0) out.push("Pierwszy narożnik musi być w punkcie 0, 0.");
  if (w[1].z !== 0 || w[1].x <= 0) out.push("Ściana A musi biec wzdłuż osi x.");
  if (w.some((p) => p.x < 0 || p.z < 0 || p.x > 3000 || p.z > 3000)) out.push("Narożniki muszą leżeć w zakresie 0–3000 cm.");
  const n = w.length;
  for (let i = 0; i < n; i++) {
    const a = w[i];
    const b = w[(i + 1) % n];
    if (Math.hypot(b.x - a.x, b.z - a.z) < MIN_SCIANA) {
      out.push(`Ściana krótsza niż ${MIN_SCIANA} cm.`);
      break;
    }
  }
  for (let i = 0; i < n && out.length < 3; i++)
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (przecinaja(w[i], w[(i + 1) % n], w[j], w[(j + 1) % n])) {
        out.push("Ściany się przecinają.");
        i = n;
        break;
      }
    }
  if (poleObrysu(w) < 10000) out.push("Pokój jest za mały (min. 1 m²).");
  return Array.from(new Set(out));
}

/** Obrys z prostokątnego pokoju (wymiary pokoju albo ściany A × B / 300 cm). */
export function obrysZProstokata(plan: PlanScian): Punkt[] {
  const sc = scianyProstokata({ ...plan, pomieszczenie: plan.pomieszczenie ?? { szer: Math.max(plan.scianaA, 120), dlug: Math.max(plan.uklad === "L" ? plan.scianaB : 0, 300) } });
  const LA = sc[0].dlugosc;
  const LB = sc.find((x) => x.id === "B")!.dlugosc;
  return [
    { x: 0, z: 0 },
    { x: LA, z: 0 },
    { x: LA, z: LB },
    { x: 0, z: LB },
  ];
}

type ElementyScian = {
  otwory: { sciana: ScianaPokoju; od: number; szer: number }[];
  punkty?: { sciana: ScianaPokoju; od: number }[];
  woda?: { sciana: "A" | "B"; od: number } | null;
};

/**
 * Okna, drzwi, gniazdka i woda po zmianie ścian (podział ściany, nowy kształt, przejście prostokąt ↔ obrys):
 * każdy zostaje w tym samym miejscu w pokoju i dostaje literę i „od” ściany, na której teraz leży.
 * Gdy coś nie leży na żadnej ścianie – komunikat (zmiana nie przechodzi).
 */
export function przeniesNaSciany<T extends ElementyScian>(w: T, stare: readonly Sciana[], nowe: readonly Sciana[]): { wywiad: T } | { blad: string } {
  const naScianie = (s: Sciana, t: number) => ({ x: s.x + s.dx * t, z: s.z + s.dz * t });
  const znajdz = (p: Punkt, q: Punkt) => {
    for (const s of nowe) {
      const tp = (p.x - s.x) * s.dx + (p.z - s.z) * s.dz;
      const tq = (q.x - s.x) * s.dx + (q.z - s.z) * s.dz;
      const dp = Math.abs((p.x - s.x) * s.nx + (p.z - s.z) * s.nz);
      const dq = Math.abs((q.x - s.x) * s.nx + (q.z - s.z) * s.nz);
      if (dp > 1.5 || dq > 1.5) continue;
      const a = Math.min(tp, tq);
      const b = Math.max(tp, tq);
      if (a < -1.5 || b > s.dlugosc + 1.5) continue;
      return { s, od: Math.max(0, Math.min(s.dlugosc - (b - a), Math.round(a))) };
    }
    return null;
  };
  const otwory = [];
  for (const o of w.otwory) {
    const s = stare.find((x) => x.id === o.sciana);
    if (!s) {
      otwory.push(o);
      continue;
    }
    const nowa = znajdz(naScianie(s, o.od), naScianie(s, o.od + o.szer));
    if (!nowa) return { blad: `${"rodzaj" in o && o.rodzaj === "okno" ? "Okno" : "Drzwi"} ze ściany ${o.sciana} nie mają gdzie zostać – przenieś je najpierw.` };
    otwory.push({ ...o, sciana: nowa.s.id, od: nowa.od });
  }
  const punkty = [];
  for (const p of w.punkty ?? []) {
    const s = stare.find((x) => x.id === p.sciana);
    if (!s) {
      punkty.push(p);
      continue;
    }
    const q = naScianie(s, p.od);
    const nowa = znajdz(q, q);
    if (!nowa) return { blad: `Gniazdko ze ściany ${p.sciana} nie ma gdzie zostać – przenieś je najpierw.` };
    punkty.push({ ...p, sciana: nowa.s.id, od: nowa.od });
  }
  let woda = w.woda ?? null;
  if (woda) {
    const s = stare.find((x) => x.id === woda!.sciana);
    if (s) {
      const q = naScianie(s, woda.od);
      const nowa = znajdz(q, q);
      if (!nowa || (nowa.s.id !== "A" && nowa.s.id !== "B")) return { blad: "Podejście wody musi zostać na ścianie A albo B." };
      woda = { sciana: nowa.s.id, od: nowa.od };
    }
  }
  return { wywiad: { ...w, otwory, ...(w.punkty ? { punkty } : {}), ...("woda" in w ? { woda } : {}) } };
}

/** Wymiary pokoju z obrysu (prostokąt opisany) – do kadrowania 3D, rzutu i rysunku. */
export function prostokatObrysu(w: readonly Punkt[]) {
  return { szer: Math.round(Math.max(...w.map((p) => p.x))), dlug: Math.round(Math.max(...w.map((p) => p.z))) };
}

/** Długości ścian A i B do zabudowy z obrysu (B tylko, gdy biegnie wzdłuż osi z). */
export function zabudowaZObrysu(w: readonly Punkt[]) {
  const A = Math.round(w[1].x);
  const ost = w[w.length - 1];
  const B = Math.abs(ost.x) < 0.5 ? Math.round(ost.z) : null;
  return { A, B };
}

/* ---------- dodatkowe ściany ---------- */

const RAD = Math.PI / 180;
type P = { x: number; z: number };

export const normujKat = (k: number) => ((Math.round(k) % 180) + 180) % 180;

/** Końce ściany (oś, środek grubości). */
export function koncowkiSciany(s: ScianaDodatkowa): [P, P] {
  const dx = Math.cos(s.kat * RAD) * (s.dlugosc / 2);
  const dz = Math.sin(s.kat * RAD) * (s.dlugosc / 2);
  return [
    { x: s.x - dx, z: s.z - dz },
    { x: s.x + dx, z: s.z + dz },
  ];
}

/** Cztery narożniki ściany w rzucie. */
export function naroznikiSciany(s: ScianaDodatkowa): P[] {
  const ux = Math.cos(s.kat * RAD);
  const uz = Math.sin(s.kat * RAD);
  const l = s.dlugosc / 2;
  const g = s.grubosc / 2;
  return [
    { x: s.x - ux * l + uz * g, z: s.z - uz * l - ux * g },
    { x: s.x + ux * l + uz * g, z: s.z + uz * l - ux * g },
    { x: s.x + ux * l - uz * g, z: s.z + uz * l + ux * g },
    { x: s.x - ux * l - uz * g, z: s.z - uz * l + ux * g },
  ];
}

/** Ściana nachodzi na prostokąt w rzucie (osie x/z) – test osi rozdzielającej, z luzem [cm]. */
export function scianaNachodzi(s: ScianaDodatkowa, r: { x0: number; z0: number; x1: number; z1: number }, luz = 0.5) {
  const a = naroznikiSciany(s);
  const b: P[] = [
    { x: r.x0, z: r.z0 },
    { x: r.x1, z: r.z0 },
    { x: r.x1, z: r.z1 },
    { x: r.x0, z: r.z1 },
  ];
  const osie: P[] = [
    { x: 1, z: 0 },
    { x: 0, z: 1 },
    { x: Math.cos(s.kat * RAD), z: Math.sin(s.kat * RAD) },
    { x: -Math.sin(s.kat * RAD), z: Math.cos(s.kat * RAD) },
  ];
  for (const o of osie) {
    const pa = a.map((p) => p.x * o.x + p.z * o.z);
    const pb = b.map((p) => p.x * o.x + p.z * o.z);
    if (Math.max(...pa) <= Math.min(...pb) + luz || Math.max(...pb) <= Math.min(...pa) + luz) return false;
  }
  return true;
}

/** Ściana z nowych końców (przeciąganie końca na rzucie): środek, długość i kąt; krok długości i kąta. */
export function scianaZKoncow(s: ScianaDodatkowa, a: P, b: P, krokDl = 5, krokKata = 15): ScianaDodatkowa {
  let kat = Math.atan2(b.z - a.z, b.x - a.x) / RAD;
  kat = Math.round(kat / krokKata) * krokKata;
  const [min, max] = LIMITY_SCIANY.dlugosc;
  const dlugosc = Math.min(max, Math.max(min, Math.round(Math.hypot(b.x - a.x, b.z - a.z) / krokDl) * krokDl));
  // Stały koniec a, drugi koniec w kierunku kąta.
  const x = a.x + (Math.cos(kat * RAD) * dlugosc) / 2;
  const z = a.z + (Math.sin(kat * RAD) * dlugosc) / 2;
  const k = ((kat % 360) + 360) % 360;
  return { ...s, x: Math.round(x), z: Math.round(z), dlugosc, kat: normujKat(k) };
}

export const wysokoscSciany = (s: ScianaDodatkowa, plan: PlanScian) => Math.min(s.wysokosc ?? wysokoscPokoju(plan), wysokoscPokoju(plan));

/** Nowa ściana: w środku pokoju, równoległa do A, 120 cm. */
export function nowaSciana(plan: PlanScian, istniejace: readonly ScianaDodatkowa[]): ScianaDodatkowa {
  const z = zakresPokoju(plan);
  const ids = new Set(istniejace.map((s) => s.id));
  let n = istniejace.length + 1;
  while (ids.has(`s${n}`)) n++;
  const przesun = (istniejace.length % 4) * 30;
  return { id: `s${n}`, x: Math.round((z.x0 + z.x1) / 2), z: Math.round((z.z0 + z.z1) / 2 + przesun), dlugosc: 120, kat: 0, grubosc: GRUBOSC_SCIANY };
}

/** Zasięg pokoju w rzucie (sufit, nowa ściana): ściany pokoju, a gdy nie ma głębokości – 300 cm. */
export function zakresPokoju(plan: PlanScian) {
  if (czyObrys(plan)) {
    const r = prostokatObrysu(plan.sciany!.obrys!);
    return { x0: 0, z0: 0, x1: r.szer, z1: r.dlug };
  }
  const sc = scianyPokojuWszystkie(plan);
  let x1 = 0;
  let z1 = 0;
  for (const s of sc) {
    x1 = Math.max(x1, s.x + s.dx * s.dlugosc);
    z1 = Math.max(z1, s.z + s.dz * s.dlugosc);
  }
  if (plan.pomieszczenie) {
    x1 = Math.max(x1, plan.pomieszczenie.szer);
    z1 = Math.max(z1, plan.pomieszczenie.dlug);
  }
  return { x0: 0, z0: 0, x1: Math.max(x1, 100), z1: z1 > 0 ? z1 : 300 };
}

/** Walidacja plan.sciany z serwera / pliku (rzuca komunikat po polsku). */
export function parseUstawieniaScian(v: unknown): UstawieniaScian | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "object" || Array.isArray(v)) throw new Error("Ściany mają zły format.");
  const o = v as Record<string, unknown>;
  const out: UstawieniaScian = {};
  if (o.kolor !== undefined && o.kolor !== null) {
    if (typeof o.kolor !== "string" || !KOLOR_SCIANY_RE.test(o.kolor)) throw new Error("Kolor ścian: #rrggbb.");
    out.kolor = o.kolor.toLowerCase();
  }
  if (o.obrys !== undefined && o.obrys !== null) {
    if (!Array.isArray(o.obrys) || o.obrys.length < 3 || o.obrys.length > MAX_SCIAN_POKOJU) throw new Error(`Obrys pokoju: od 3 do ${MAX_SCIAN_POKOJU} narożników.`);
    const w = o.obrys.map((p, i) => {
      const q = p as Record<string, unknown>;
      if (!q || typeof q !== "object" || typeof q.x !== "number" || typeof q.z !== "number" || !Number.isFinite(q.x) || !Number.isFinite(q.z)) throw new Error(`Obrys pokoju: narożnik ${i + 1} ma zły format.`);
      return { x: Math.round(q.x * 10) / 10, z: Math.round(q.z * 10) / 10 };
    });
    const bledy = sprawdzObrys(w);
    if (bledy.length) throw new Error(`Obrys pokoju: ${bledy[0]}`);
    out.obrys = w;
  }
  if (o.bez !== undefined && o.bez !== null) {
    if (!Array.isArray(o.bez) || o.bez.some((b) => typeof b !== "string" || b === "A" || !(LITERY_SCIAN as readonly string[]).includes(b))) throw new Error("Usunięte ściany: litery B–P.");
    const bez = Array.from(new Set(o.bez as ScianaUsuwalna[])).sort();
    if (bez.length) out.bez = bez;
  }
  if (o.dodatkowe !== undefined && o.dodatkowe !== null) {
    if (!Array.isArray(o.dodatkowe)) throw new Error("Dodatkowe ściany: lista.");
    if (o.dodatkowe.length > MAX_SCIAN_DODATKOWYCH) throw new Error(`Najwyżej ${MAX_SCIAN_DODATKOWYCH} dodatkowych ścian.`);
    const ids = new Set<string>();
    const lista = o.dodatkowe.map((x, i) => {
      if (!x || typeof x !== "object" || Array.isArray(x)) throw new Error(`Ściana ${i + 1}: zły format.`);
      const w = x as Record<string, unknown>;
      const liczba = (k: string, [min, max]: readonly [number, number]) => {
        const n = w[k];
        if (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max) throw new Error(`Ściana ${i + 1}: ${k} poza zakresem ${min}–${max}.`);
        return Math.round(n * 10) / 10;
      };
      const id = typeof w.id === "string" && /^[\w-]{1,24}$/.test(w.id) && !ids.has(w.id) ? w.id : `s${i + 1}`;
      ids.add(id);
      const kat = w.kat;
      if (typeof kat !== "number" || !Number.isFinite(kat)) throw new Error(`Ściana ${i + 1}: zły kąt.`);
      const s: ScianaDodatkowa = {
        id,
        x: liczba("x", LIMITY_SCIANY.poz),
        z: liczba("z", LIMITY_SCIANY.poz),
        dlugosc: liczba("dlugosc", LIMITY_SCIANY.dlugosc),
        kat: normujKat(kat),
        grubosc: liczba("grubosc", LIMITY_SCIANY.grubosc),
      };
      if (w.wysokosc !== undefined && w.wysokosc !== null) s.wysokosc = liczba("wysokosc", LIMITY_SCIANY.wysokosc);
      if (w.kolor !== undefined && w.kolor !== null) {
        if (typeof w.kolor !== "string" || !KOLOR_SCIANY_RE.test(w.kolor)) throw new Error(`Ściana ${i + 1}: kolor #rrggbb.`);
        s.kolor = w.kolor.toLowerCase();
      }
      return s;
    });
    if (lista.length) out.dodatkowe = lista;
  }
  if (o.koloryScian !== undefined && o.koloryScian !== null) {
    if (typeof o.koloryScian !== "object" || Array.isArray(o.koloryScian)) throw new Error("Kolory ścian: zły format.");
    const k: Partial<Record<ScianaPokoju, string>> = {};
    for (const [id, v] of Object.entries(o.koloryScian as Record<string, unknown>)) {
      if (!(LITERY_SCIAN as readonly string[]).includes(id) || typeof v !== "string" || !KOLOR_SCIANY_RE.test(v)) throw new Error(`Kolor ściany ${id}: #rrggbb.`);
      k[id as ScianaPokoju] = v.toLowerCase();
    }
    if (Object.keys(k).length) out.koloryScian = k;
  }
  for (const [klucz, [min, max], nazwa] of [
    ["grubosci", LIMITY_SCIANY.grubosc, "Grubość"],
    ["wysokosci", LIMITY_SCIANY.wysokosc, "Wysokość"],
  ] as const) {
    const v = o[klucz];
    if (v === undefined || v === null) continue;
    if (typeof v !== "object" || Array.isArray(v)) throw new Error(`${nazwa} ścian: zły format.`);
    const m: Partial<Record<ScianaPokoju, number>> = {};
    for (const [id, n] of Object.entries(v as Record<string, unknown>)) {
      if (!(LITERY_SCIAN as readonly string[]).includes(id) || typeof n !== "number" || !Number.isFinite(n) || n < min || n > max) throw new Error(`${nazwa} ściany ${id}: ${min}–${max} cm.`);
      m[id as ScianaPokoju] = Math.round(n);
    }
    if (Object.keys(m).length) out[klucz] = m;
  }
  if (o.podloga !== undefined && o.podloga !== null) {
    const pd = o.podloga as Record<string, unknown>;
    if (typeof pd !== "object" || Array.isArray(pd) || (pd.rodzaj !== "panele" && pd.rodzaj !== "plytki")) throw new Error("Podłoga: panele albo płytki.");
    if (pd.kolor !== undefined && pd.kolor !== null && (typeof pd.kolor !== "string" || !KOLOR_SCIANY_RE.test(pd.kolor))) throw new Error("Kolor podłogi: #rrggbb.");
    out.podloga = { rodzaj: pd.rodzaj, ...(typeof pd.kolor === "string" ? { kolor: pd.kolor.toLowerCase() } : {}) };
  }
  if (o.sufit !== undefined && o.sufit !== null && o.sufit !== false) {
    const su = o.sufit === true ? {} : o.sufit;
    if (typeof su !== "object" || Array.isArray(su)) throw new Error("Sufit: zły format.");
    const k = (su as Record<string, unknown>).kolor;
    if (k !== undefined && k !== null && (typeof k !== "string" || !KOLOR_SCIANY_RE.test(k))) throw new Error("Kolor sufitu: #rrggbb.");
    out.sufit = typeof k === "string" ? { kolor: k.toLowerCase() } : {};
  }
  return Object.keys(out).length ? out : undefined;
}

/* ---------- łączenie ścian (jak w grach o budowaniu domu) ---------- */

/** Promień przyciągania końca ściany [cm]. */
export const PROMIEN_LACZENIA = 18;

export type CelLaczenia = { p: P; rodzaj: "koniec" | "naroznik" | "sciana" };

/** Najbliższy punkt na odcinku a–b. */
function rzutNaOdcinek(p: P, a: P, b: P): P {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const L2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / L2));
  return { x: a.x + dx * t, z: a.z + dz * t };
}

/**
 * Przyciąganie końca ściany działowej: do końców innych ścianek i narożników pokoju (pierwszeństwo),
 * potem do linii ścian pokoju (wewnętrzna strona) i osi innych ścianek (połączenie w „T”).
 * pomin – indeksy ścianek, które się teraz ruszają. null = nic w zasięgu.
 */
export function przyciagnijKoniec(plan: PlanScian, p: P, pomin: ReadonlySet<number>, promien = PROMIEN_LACZENIA): CelLaczenia | null {
  let best: { c: CelLaczenia; d: number } | null = null;
  const sprobuj = (q: P, rodzaj: CelLaczenia["rodzaj"], kara = 0) => {
    const d = Math.hypot(q.x - p.x, q.z - p.z);
    if (d > promien) return;
    if (!best || d + kara < best.d) best = { c: { p: { x: Math.round(q.x), z: Math.round(q.z) }, rodzaj }, d: d + kara };
  };
  const dodatkowe = plan.sciany?.dodatkowe ?? [];
  dodatkowe.forEach((s, i) => {
    if (pomin.has(i)) return;
    for (const k of koncowkiSciany(s)) sprobuj(k, "koniec");
  });
  const sciany = scianyPokoju(plan);
  for (const s of sciany) {
    sprobuj({ x: s.x, z: s.z }, "naroznik");
    sprobuj({ x: s.x + s.dx * s.dlugosc, z: s.z + s.dz * s.dlugosc }, "naroznik");
  }
  // Linie (kara – narożnik i koniec wygrywają, gdy są blisko).
  for (const s of sciany) sprobuj(rzutNaOdcinek(p, { x: s.x, z: s.z }, { x: s.x + s.dx * s.dlugosc, z: s.z + s.dz * s.dlugosc }), "sciana", 6);
  dodatkowe.forEach((s, i) => {
    if (pomin.has(i)) return;
    const [a, b] = koncowkiSciany(s);
    sprobuj(rzutNaOdcinek(p, a, b), "sciana", 6);
  });
  return (best as { c: CelLaczenia } | null)?.c ?? null;
}

/** Ścianka dokładnie między dwoma punktami (bez zaokrąglania kąta – połączona ściana idzie za narożnikiem). */
export function scianaMiedzy(s: ScianaDodatkowa, a: P, b: P): ScianaDodatkowa {
  const [min, max] = LIMITY_SCIANY.dlugosc;
  const dlugosc = Math.min(max, Math.max(min, Math.round(Math.hypot(b.x - a.x, b.z - a.z))));
  const kat = (Math.atan2(b.z - a.z, b.x - a.x) * 180) / Math.PI;
  return { ...s, x: Math.round((a.x + b.x) / 2), z: Math.round((a.z + b.z) / 2), dlugosc, kat: normujKat(((kat % 360) + 360) % 360) };
}

/**
 * Połączenia końców ścianek: dla ścianki i, koniec 0/1 → lista [j, koniec] ścianek, których koniec leży w tym samym
 * miejscu (≤ 2 cm). Do ruszania połączonych ścian razem i domykania narożników.
 */
export function polaczeniaScianek(dodatkowe: readonly ScianaDodatkowa[], tol = 2): [number, 0 | 1][][][] {
  const konce = dodatkowe.map((s) => koncowkiSciany(s));
  return konce.map((ki, i) =>
    ki.map((p) => {
      const out: [number, 0 | 1][] = [];
      konce.forEach((kj, j) => {
        if (j === i) return;
        kj.forEach((q, e) => {
          if (Math.hypot(q.x - p.x, q.z - p.z) <= tol) out.push([j, e as 0 | 1]);
        });
      });
      return out;
    }),
  );
}

/**
 * Ścianka do rysowania z domkniętymi narożnikami: koniec połączony z inną ścianką wydłuża się o pół grubości,
 * więc narożnik w „L” nie ma szczeliny.
 */
export function scianaZPolaczeniami(s: ScianaDodatkowa, polaczone: readonly [boolean, boolean]): ScianaDodatkowa {
  const ea = polaczone[0] ? s.grubosc / 2 : 0;
  const eb = polaczone[1] ? s.grubosc / 2 : 0;
  if (!ea && !eb) return s;
  const ux = Math.cos(s.kat * RAD);
  const uz = Math.sin(s.kat * RAD);
  return { ...s, dlugosc: s.dlugosc + ea + eb, x: s.x + (ux * (eb - ea)) / 2, z: s.z + (uz * (eb - ea)) / 2 };
}

/**
 * Narożniki ściany pokoju z grubością (na zewnątrz od wewnętrznej strony) – rzut. Koniec, przy którym stoi
 * inna ściana pokoju, idzie skosem (narożnik domknięty), wolny koniec jest prosty.
 */
export function obrysMuru(s: Sciana, g: number, polaczone: readonly [boolean, boolean] = [true, true]): P[] {
  const x2 = s.x + s.dx * s.dlugosc;
  const z2 = s.z + s.dz * s.dlugosc;
  const ea = polaczone[0] ? g : 0;
  const eb = polaczone[1] ? g : 0;
  return [
    { x: s.x, z: s.z },
    { x: x2, z: z2 },
    { x: x2 + s.dx * eb - s.nx * g, z: z2 + s.dz * eb - s.nz * g },
    { x: s.x - s.dx * ea - s.nx * g, z: s.z - s.dz * ea - s.nz * g },
  ];
}

/** Mury ścian pokoju (rzut): ściana, grubość i narożniki z domkniętymi połączeniami. */
export function muryPokoju(plan: PlanScian) {
  const sc = scianyPokoju(plan);
  const konce = sc.map((s) => [{ x: s.x, z: s.z }, { x: s.x + s.dx * s.dlugosc, z: s.z + s.dz * s.dlugosc }]);
  const styka = (p: P, i: number) => konce.some((k, j) => j !== i && k.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 1));
  return sc.map((s, i) => {
    const g = gruboscScianyPokoju(plan, s.id);
    const polaczone: [boolean, boolean] = [styka(konce[i][0], i), styka(konce[i][1], i)];
    return { s, g, polaczone, punkty: obrysMuru(s, g, polaczone) };
  });
}

/** Zasięg w rzucie wszystkiego, co stoi na podłodze: ściany pokoju (z grubością) i ścianki działowe [cm]. */
export function zasiegScian(plan: PlanScian) {
  let x0 = 0;
  let z0 = 0;
  let x1 = 0;
  let z1 = 0;
  const dodaj = (p: P) => {
    x0 = Math.min(x0, p.x);
    z0 = Math.min(z0, p.z);
    x1 = Math.max(x1, p.x);
    z1 = Math.max(z1, p.z);
  };
  for (const m of muryPokoju(plan)) for (const p of m.punkty) dodaj(p);
  for (const sd of plan.sciany?.dodatkowe ?? []) for (const p of naroznikiSciany(sd)) dodaj(p);
  if (plan.pomieszczenie) dodaj({ x: plan.pomieszczenie.szer, z: plan.pomieszczenie.dlug });
  return { x0, z0, x1, z1 };
}

export type RuchScianki = {
  /** Zmienione ścianki: przeciągana i połączone z nią (indeks → nowa ścianka). */
  zmiany: Map<number, ScianaDodatkowa>;
  /** Punkt, do którego koniec się przyciągnął (do podświetlenia); null = bez przyciągania. */
  cel: P | null;
};

/**
 * Ruch ścianki działowej z łączeniem (rzut i 3D):
 *  srodek – przesunięcie (q = nowy środek), koniec ściany, który trafi w zasięg innej ściany, przyciąga się do niej;
 *  a / b  – przeciąganie końca (q = kursor): obrót i długość wokół drugiego końca, koniec przyciąga się do ścian.
 * Ścianki połączone końcem z ruszanym końcem idą za nim (ich drugi koniec stoi). laczenie = false (Alt) – bez przyciągania.
 */
export function ruchScianki(
  plan: PlanScian,
  i: number,
  tryb: "srodek" | "a" | "b",
  q: P,
  { krok = 5, krokKata = 15, laczenie = true }: { krok?: number; krokKata?: number; laczenie?: boolean } = {},
): RuchScianki {
  const lista = plan.sciany?.dodatkowe ?? [];
  const start = lista[i];
  const zmiany = new Map<number, ScianaDodatkowa>();
  if (!start) return { zmiany, cel: null };
  const pol = polaczeniaScianek(lista)[i];
  const [ka, kb] = koncowkiSciany(start);
  // Końce, które się ruszają (0 = a, 1 = b), i ścianki pociągnięte za nimi.
  const ruszane: (0 | 1)[] = tryb === "srodek" ? [0, 1] : [tryb === "a" ? 0 : 1];
  const pomin = new Set<number>([i]);
  for (const e of ruszane) for (const [j] of pol[e]) pomin.add(j);
  let s: ScianaDodatkowa;
  let cel: P | null = null;
  if (tryb === "srodek") {
    s = { ...start, x: Math.round(q.x / krok) * krok, z: Math.round(q.z / krok) * krok };
    if (laczenie) {
      // Koniec najbliżej celu wygrywa; cała ścianka przesuwa się o tyle, ile trzeba.
      let best: { d: number; dx: number; dz: number; p: P } | null = null;
      for (const k of koncowkiSciany(s)) {
        const c = przyciagnijKoniec(plan, k, pomin);
        if (!c) continue;
        const d = Math.hypot(c.p.x - k.x, c.p.z - k.z);
        if (!best || d < best.d) best = { d, dx: c.p.x - k.x, dz: c.p.z - k.z, p: c.p };
      }
      if (best) {
        s = { ...s, x: Math.round(s.x + best.dx), z: Math.round(s.z + best.dz) };
        cel = best.p;
      }
    }
  } else {
    const staly = tryb === "a" ? kb : ka;
    const c = laczenie ? przyciagnijKoniec(plan, q, pomin) : null;
    if (c && Math.hypot(c.p.x - staly.x, c.p.z - staly.z) >= LIMITY_SCIANY.dlugosc[0]) {
      s = scianaMiedzy(start, staly, c.p);
      cel = c.p;
    } else s = scianaZKoncow(start, staly, q, krok, krokKata);
    // scianaMiedzy / scianaZKoncow liczą kierunek od stałego końca – kolejność końców może się odwrócić; nieistotne.
  }
  zmiany.set(i, s);
  // Połączone ścianki: koniec przy ruszanym końcu jedzie za nim, drugi stoi.
  const nk = koncowkiSciany(s);
  const odl = (a: P, b: P) => Math.hypot(a.x - b.x, a.z - b.z);
  for (const e of ruszane) {
    let nowy: P;
    if (tryb === "srodek") nowy = nk[e];
    else {
      // Ruszany koniec = ten dalej od stałego (kierunek ścianki mógł się odwrócić).
      const staly = tryb === "a" ? kb : ka;
      nowy = cel ?? (odl(nk[0], staly) >= odl(nk[1], staly) ? nk[0] : nk[1]);
    }
    for (const [j, ej] of pol[e]) {
      const kj = koncowkiSciany(lista[j]);
      const drugi = kj[ej === 0 ? 1 : 0];
      if (odl(nowy, drugi) < LIMITY_SCIANY.dlugosc[0]) continue;
      zmiany.set(j, scianaMiedzy(lista[j], drugi, nowy));
    }
  }
  return { zmiany, cel };
}

/* ---------- mebel za ścianą ---------- */

type R = { x0: number; z0: number; x1: number; z1: number };

/** Odcinek a–b przechodzi przez wnętrze prostokąta (Liang–Barsky); stykanie się krawędzią się nie liczy. */
function odcinekPrzezProstokat(a: P, b: P, r: R) {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  for (const [p, q] of [
    [-dx, a.x - r.x0],
    [dx, r.x1 - a.x],
    [-dz, a.z - r.z0],
    [dz, r.z1 - a.z],
  ] as const) {
    if (Math.abs(p) < 1e-9) {
      if (q <= 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return false;
  }
  return t1 - t0 > 1e-9;
}

/**
 * Mebel (obrys w rzucie) stoi za ścianą pokoju albo przez nią przechodzi.
 * - żadna ściana pokoju nie może przecinać mebla (stykanie się – mebel przy ścianie – jest w porządku);
 * - pokój zamknięty (obrys albo prostokąt z wymiarami, bez usuniętych ścian): środek mebla w środku pokoju
 *   (pokój w kształcie L – mebel nie stanie w „wyciętym” narożniku);
 * - pokój otwarty (sama ściana A / A i B, otwarta przestrzeń): mebel nie stoi za żadną ścianą na jej długości.
 * Luz 1 cm – zaokrąglenia przy przyciąganiu do ściany.
 */
export function mebelZaSciana(plan: PlanScian, r: R): boolean {
  const L = 1;
  const rr = { x0: r.x0 + L, z0: r.z0 + L, x1: r.x1 - L, z1: r.z1 - L };
  if (rr.x1 <= rr.x0 || rr.z1 <= rr.z0) return false;
  const sc = scianyPokoju(plan);
  for (const s of sc) if (odcinekPrzezProstokat({ x: s.x, z: s.z }, { x: s.x + s.dx * s.dlugosc, z: s.z + s.dz * s.dlugosc }, rr)) return true;
  const zamkniety = sc.length === scianyPokojuWszystkie(plan).length && (czyObrys(plan) || !!plan.pomieszczenie);
  const srodek = { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 };
  if (zamkniety) {
    const w = czyObrys(plan) ? plan.sciany!.obrys! : obrysZProstokata(plan);
    return !wWielokacie(srodek, w);
  }
  // Otwarty pokój: za ścianą = po jej zewnętrznej stronie w zasięgu jej długości.
  const rogi = [
    { x: rr.x0, z: rr.z0 },
    { x: rr.x1, z: rr.z0 },
    { x: rr.x1, z: rr.z1 },
    { x: rr.x0, z: rr.z1 },
  ];
  for (const s of sc) {
    const t = rogi.map((p) => (p.x - s.x) * s.dx + (p.z - s.z) * s.dz);
    if (Math.max(...t) <= 0 || Math.min(...t) >= s.dlugosc) continue;
    if (rogi.some((p, i) => t[i] > 0 && t[i] < s.dlugosc && (p.x - s.x) * s.nx + (p.z - s.z) * s.nz < 0)) return true;
  }
  return false;
}
