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

/** Ściany pokoju, które można usunąć (otwarta przestrzeń). A zostaje zawsze – od niej liczy się zabudowa. */
export type ScianaUsuwalna = "B" | "C" | "D";

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
};

/** Ustawienia ścian w planie (plan.sciany): kolor, usunięte ściany pokoju, dodatkowe ściany, sufit. */
export type UstawieniaScian = {
  kolor?: string;
  bez?: ScianaUsuwalna[];
  dodatkowe?: ScianaDodatkowa[];
  /** Sufit w 3D (na wysokości pokoju); kolor domyślnie biały. */
  sufit?: { kolor?: string };
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
  const bez = plan.sciany?.bez;
  if (!bez?.length) return out;
  return out.filter((s) => s.id === "A" || (s.id === "B" && plan.uklad === "L") || !bez.includes(s.id as ScianaUsuwalna));
}

/** Ściany pokoju, które da się mieć (przed usunięciem) – do listy „jest / otwarta przestrzeń”. */
export function scianyPokojuWszystkie(plan: PlanScian): Sciana[] {
  return scianyPokoju({ ...plan, sciany: null });
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
  if (o.bez !== undefined && o.bez !== null) {
    if (!Array.isArray(o.bez) || o.bez.some((b) => b !== "B" && b !== "C" && b !== "D")) throw new Error("Usunięte ściany: tylko B, C, D.");
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
      return s;
    });
    if (lista.length) out.dodatkowe = lista;
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
