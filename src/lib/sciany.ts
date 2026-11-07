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
  /** Kolory pojedynczych ścian pokoju (#rrggbb); ściana bez wpisu ma kolor ścian (kolor ze sceny). */
  koloryScian?: Partial<Record<ScianaPokoju, string>>;
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
  if (o.sufit !== undefined && o.sufit !== null && o.sufit !== false) {
    const su = o.sufit === true ? {} : o.sufit;
    if (typeof su !== "object" || Array.isArray(su)) throw new Error("Sufit: zły format.");
    const k = (su as Record<string, unknown>).kolor;
    if (k !== undefined && k !== null && (typeof k !== "string" || !KOLOR_SCIANY_RE.test(k))) throw new Error("Kolor sufitu: #rrggbb.");
    out.sufit = typeof k === "string" ? { kolor: k.toLowerCase() } : {};
  }
  return Object.keys(out).length ? out : undefined;
}
