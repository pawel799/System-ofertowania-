/*
 * Ściany pomieszczenia (cm): A i B jak w rzucie (A wzdłuż x przy z = 0, B wzdłuż z przy x = 0), C naprzeciw A, D naprzeciw B.
 * C i D są, gdy podano wymiary pokoju (krok „Pomiar”). Otwory (okna, drzwi) leżą na ścianach – „od” liczone od początku ściany
 * (narożnik przy x = 0 / z = 0). Wspólne dla sceny 3D (ściany z otworami), rzutu, przesuwania otworów i rysunku technicznego.
 *
 * Bez importów z kuchnia.ts – plan podany strukturalnie.
 */

export type ScianaPokoju = "A" | "B" | "C" | "D";
export const SCIANY_POKOJU: readonly ScianaPokoju[] = ["A", "B", "C", "D"];
export const SCIANA_LABEL: Record<ScianaPokoju, string> = { A: "Ściana A", B: "Ściana B", C: "Ściana C (naprzeciw A)", D: "Ściana D (naprzeciw B)" };

/** Domyślna wysokość pomieszczenia [cm], gdy nie podano w pomiarze. */
export const WYSOKOSC_DOMYSLNA = 260;

type PlanScian = {
  uklad: "ciag" | "L";
  scianaA: number;
  scianaB: number;
  pomieszczenie: { szer: number; dlug: number } | null;
  wywiad?: { wysokosc?: number } | null;
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
};

export function wysokoscPokoju(plan: PlanScian) {
  return plan.wywiad?.wysokosc ?? WYSOKOSC_DOMYSLNA;
}

/** Ściany, które są w projekcie: A zawsze, B w L albo przy wymiarach pokoju, C i D przy wymiarach pokoju. */
export function scianyPokoju(plan: PlanScian): Sciana[] {
  const pom = plan.pomieszczenie;
  const LA = Math.max(plan.scianaA, pom?.szer ?? 0);
  const LB = Math.max(plan.uklad === "L" ? plan.scianaB : 0, pom?.dlug ?? 0);
  const out: Sciana[] = [{ id: "A", x: 0, z: 0, dx: 1, dz: 0, dlugosc: LA, nx: 0, nz: 1 }];
  if (plan.uklad === "L" || pom) out.push({ id: "B", x: 0, z: 0, dx: 0, dz: 1, dlugosc: LB, nx: 1, nz: 0 });
  if (pom) {
    out.push({ id: "C", x: 0, z: LB, dx: 1, dz: 0, dlugosc: LA, nx: 0, nz: -1 });
    out.push({ id: "D", x: LA, z: 0, dx: 0, dz: 1, dlugosc: LB, nx: -1, nz: 0 });
  }
  return out;
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
 * Położenie mebla w granicach pokoju: obrys (prostokąt w rzucie, cm) nie wychodzi za ściany, które są w projekcie
 * (A zawsze; B w L albo z wymiarami pokoju; C i D z wymiarami pokoju). Zwraca przesunięcie środka.
 */
export function wGranicachPokoju(plan: PlanScian, r: { x0: number; z0: number; x1: number; z1: number }, x: number, z: number) {
  const sciany = scianyPokoju(plan);
  const jest = (id: ScianaPokoju) => sciany.find((s) => s.id === id);
  let nx = x;
  let nz = z;
  if (r.z0 < 0) nz += -r.z0;
  const B = jest("B");
  if (B && r.x0 < 0) nx += -r.x0;
  const C = jest("C");
  if (C && r.z1 + (nz - z) > C.z) nz -= r.z1 + (nz - z) - C.z;
  const D = jest("D");
  if (D && r.x1 + (nx - x) > D.x) nx -= r.x1 + (nx - x) - D.x;
  return { x: Math.round(nx), z: Math.round(nz) };
}
