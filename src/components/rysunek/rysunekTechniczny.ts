/*
 * Rysunek techniczny oferty – generowany z planu (bez zapisu, zawsze aktualny): rzut z góry z wymiarami i numerami
 * pozycji, widoki ścian (meble, okna, drzwi, gniazdka) z łańcuchami wymiarów oraz rysunki pojedynczych mebli
 * (widok frontu z podziałem drzwi / szuflad i widok z boku). Czysty SVG jako tekst – trafia do PDF oferty,
 * do okna „Rysunek techniczny” w panelu i na stronę klienta.
 *
 * Jednostki rysunku: centymetry (viewBox w cm, skala dopasowana do kartki). Numery mebli = numery pozycji w PDF.
 */
import { nazwaNaRzucie, rectBazowy, rodzajElementu, type ElementKuchni, type PlanKuchni } from "@/lib/kuchnia";
import { meblaPrzyScianie } from "@/lib/otwory";
import { etykietaSciany, naroznikiSciany, scianyPokoju, wysokoscOtworu, wysokoscPokoju, type Sciana, type ScianaPokoju } from "@/lib/sciany";
import { PLYTA_CM, wnetrzeDomyslne, type Wnetrze } from "@/lib/wnetrze";
import type { PunktInstalacji } from "@/lib/wywiad";
import { yElementu } from "@/components/kuchnia/uklad3d";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
/** Liczba do SVG (0,1 cm). */
const n = (v: number) => String(Math.round(v * 10) / 10);
/** Wymiar w opisie: „60”, „59,4”. */
const cm = (v: number) => String(Math.round(v * 10) / 10).replace(".", ",");

const KRESKA = "#1c1917";
const SZARY = "#78716c";
const AKCENT = "#b45309";

type Pkt = [number, number];

/** Linia wymiarowa (architektoniczna: ukośne kreski na końcach, liczba nad linią). off > 0 – w lewo od kierunku a→b. */
function wymiar(out: string[], a: Pkt, b: Pkt, off: number, tekst: string, fs: number) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy);
  if (L < 0.5) return;
  const ux = dx / L;
  const uy = dy / L;
  const nx = -uy;
  const ny = ux;
  const s = Math.sign(off) || 1;
  const A: Pkt = [a[0] + nx * off, a[1] + ny * off];
  const B: Pkt = [b[0] + nx * off, b[1] + ny * off];
  const t = fs * 0.32;
  out.push(
    `<g class="rys-wym">`,
    `<line x1="${n(a[0] + nx * s * 1.5)}" y1="${n(a[1] + ny * s * 1.5)}" x2="${n(A[0] + nx * s * 2)}" y2="${n(A[1] + ny * s * 2)}" />`,
    `<line x1="${n(b[0] + nx * s * 1.5)}" y1="${n(b[1] + ny * s * 1.5)}" x2="${n(B[0] + nx * s * 2)}" y2="${n(B[1] + ny * s * 2)}" />`,
    `<line x1="${n(A[0])}" y1="${n(A[1])}" x2="${n(B[0])}" y2="${n(B[1])}" />`,
    ...[A, B].map((p) => `<line class="rys-tick" x1="${n(p[0] - (ux + nx) * t)}" y1="${n(p[1] - (uy + ny) * t)}" x2="${n(p[0] + (ux + nx) * t)}" y2="${n(p[1] + (uy + ny) * t)}" />`),
  );
  let kat = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (kat > 90.5 || kat < -89.5) kat += 180;
  // Tekst po zewnętrznej stronie linii (dalej od rysunku).
  const tx = (A[0] + B[0]) / 2 + nx * s * fs * 0.62;
  const ty = (A[1] + B[1]) / 2 + ny * s * fs * 0.62;
  const maly = L < fs * (tekst.length * 0.55 + 0.6);
  out.push(
    `<text x="${n(tx)}" y="${n(ty)}" font-size="${n(maly ? fs * 0.78 : fs)}" text-anchor="middle" dominant-baseline="central" transform="rotate(${n(kat)} ${n(tx)} ${n(ty)})">${esc(tekst)}</text></g>`,
  );
}

/** Łańcuch wymiarów wzdłuż osi: kolejne odcinki między punktami (posortowane, bez powtórek). */
function lancuch(out: string[], punkty: number[], na: (t: number) => Pkt, off: number, fs: number) {
  const p = Array.from(new Set(punkty.map((v) => Math.round(v * 10) / 10))).sort((a, b) => a - b);
  for (let i = 0; i + 1 < p.length; i++) wymiar(out, na(p[i]), na(p[i + 1]), off, cm(p[i + 1] - p[i]), fs);
}

/* ---------- fronty jednego mebla (widok z przodu, cm od lewego dolnego rogu) ---------- */

export type FrontRys = {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  typ: "drzwi" | "szuflada" | "przesuwne" | "wneka" | "polka" | "agd";
  /** Drzwi: zawiasy po lewej. */
  zawiasLewy?: boolean;
  napis?: string;
};

/** Przestrzenie kolumny od dołu (cm) – jak w bryle 3D (MebelParametryczny): płyta między przestrzeniami, nie między szufladami. */
function przestrzenie(kol: Wnetrze["kolumny"][number], H: number) {
  let y = PLYTA_CM;
  const out: { typ: string; y0: number; y1: number; plytaNad: boolean }[] = [];
  kol.sekcje.forEach((s, i) => {
    const y0 = y;
    const y1 = y0 + s.h;
    const nast = kol.sekcje[i + 1];
    const plytaNad = !!nast && !(s.typ === "szuflada" && nast.typ === "szuflada");
    out.push({ typ: s.typ, y0, y1, plytaNad });
    y = plytaNad ? y1 + PLYTA_CM : y1;
  });
  if (out.length) out[out.length - 1].y1 = H - PLYTA_CM;
  return out;
}

/** Podział frontów mebla: drzwi (z zawiasami), szuflady, drzwi przesuwne, otwarte wnęki z półkami; AGD i modele – obrys z nazwą. */
export function frontyElementu(el: ElementKuchni): FrontRys[] {
  const W = el.w;
  const H = el.h;
  const wn = el.wnetrze ?? wnetrzeDomyslne(el);
  if (!wn || !wn.kolumny.length) return [{ x0: 0, x1: W, y0: 0, y1: H, typ: "agd", napis: nazwaNaRzucie(el) || el.nazwa }];
  const T = PLYTA_CM;
  const k = wn.kolumny.length;
  const colW = (W - 2 * T - (k - 1) * T) / k;
  const kolX = (c: number) => T + c * (colW + T);
  const kraniecL = (c: number) => (c === 0 ? 0 : kolX(c) - T / 2);
  const kraniecP = (c: number) => (c === k - 1 ? W : kolX(c) + colW + T / 2);
  const zewnetrzneSzuflady = wn.front !== "przesuwne" && !wn.szufladyZaDrzwiami;
  const out: FrontRys[] = [];
  wn.kolumny.forEach((kol, c) => {
    const prz = przestrzenie(kol, H);
    const fx0 = kraniecL(c);
    const fx1 = kraniecP(c);
    const otwarta = wn.front === "otwarte" || (wn.front === "drzwi" && !!kol.bezFrontu);
    if (zewnetrzneSzuflady)
      prz.forEach((s, i) => {
        if (s.typ !== "szuflada") return;
        const prev = prz[i - 1];
        const next = prz[i + 1];
        const fy0 = !prev ? 0 : prev.plytaNad ? s.y0 - T / 2 : s.y0;
        const fy1 = !next ? H : s.plytaNad ? s.y1 + T / 2 : s.y1;
        out.push({ x0: fx0, x1: fx1, y0: fy0, y1: fy1, typ: "szuflada" });
      });
    if (otwarta) {
      out.push({ x0: kolX(c), x1: kolX(c) + colW, y0: T, y1: H - T, typ: "wneka" });
      prz.forEach((s) => {
        if (s.plytaNad && (s.typ !== "szuflada" || !zewnetrzneSzuflady)) out.push({ x0: kolX(c), x1: kolX(c) + colW, y0: s.y1 + T / 2, y1: s.y1 + T / 2, typ: "polka" });
      });
      return;
    }
    if (wn.front !== "drzwi") return;
    const ciagi: [number, number][] = [];
    if (!zewnetrzneSzuflady) ciagi.push([0, prz.length - 1]);
    else {
      let start = -1;
      prz.forEach((s, i) => {
        if (s.typ !== "szuflada" && start < 0) start = i;
        if ((s.typ === "szuflada" || i === prz.length - 1) && start >= 0) {
          ciagi.push([start, s.typ === "szuflada" ? i - 1 : i]);
          start = -1;
        }
      });
    }
    for (const [a, b] of ciagi) {
      const prev = prz[a - 1];
      const fy0 = a === 0 ? 0 : prev.plytaNad ? prz[a].y0 - T / 2 : prz[a].y0;
      const fy1 = b === prz.length - 1 ? H : prz[b].plytaNad ? prz[b].y1 + T / 2 : prz[b].y1;
      const szer = fx1 - fx0;
      if (szer > 60.1) {
        out.push({ x0: fx0, x1: fx0 + szer / 2, y0: fy0, y1: fy1, typ: "drzwi", zawiasLewy: true });
        out.push({ x0: fx0 + szer / 2, x1: fx1, y0: fy0, y1: fy1, typ: "drzwi", zawiasLewy: false });
      } else out.push({ x0: fx0, x1: fx1, y0: fy0, y1: fy1, typ: "drzwi", zawiasLewy: k === 1 || c < k / 2 });
    }
  });
  if (wn.front === "przesuwne") {
    const p = Math.min(4, Math.max(2, Math.round(W / 100)));
    for (let i = 0; i < p; i++) out.push({ x0: (W / p) * i, x1: (W / p) * (i + 1), y0: 0, y1: H, typ: "przesuwne" });
  }
  return out;
}

/** Fronty mebla jako SVG; (X, Y) – lewy dolny róg mebla na rysunku, oś Y w dół (Y – wysokość). */
function frontySvg(out: string[], el: ElementKuchni, X: number, Ydol: number, fs: number) {
  const W = el.w;
  out.push(`<rect class="rys-mebel" x="${n(X)}" y="${n(Ydol - el.h)}" width="${n(W)}" height="${n(el.h)}" />`);
  for (const f of frontyElementu(el)) {
    const x0 = X + f.x0;
    const x1 = X + f.x1;
    const y0 = Ydol - f.y1;
    const y1 = Ydol - f.y0;
    const g = 0.35;
    if (f.typ === "polka") {
      out.push(`<line class="rys-cienka" x1="${n(x0)}" y1="${n(y0)}" x2="${n(x1)}" y2="${n(y0)}" />`);
      continue;
    }
    if (f.typ === "wneka") {
      out.push(`<rect class="rys-wneka" x="${n(x0)}" y="${n(y0)}" width="${n(x1 - x0)}" height="${n(y1 - y0)}" />`);
      continue;
    }
    out.push(`<rect class="rys-front" x="${n(x0 + g)}" y="${n(y0 + g)}" width="${n(Math.max(0, x1 - x0 - 2 * g))}" height="${n(Math.max(0, y1 - y0 - 2 * g))}" />`);
    if (f.typ === "drzwi") {
      // Symbol otwierania: linie od strony uchwytu zbiegają się przy zawiasach.
      const zx = f.zawiasLewy ? x0 + g : x1 - g;
      const ux = f.zawiasLewy ? x1 - g : x0 + g;
      out.push(`<polyline class="rys-otw" points="${n(ux)},${n(y0 + g)} ${n(zx)},${n((y0 + y1) / 2)} ${n(ux)},${n(y1 - g)}" />`);
    } else if (f.typ === "szuflada") {
      const uw = Math.min(16, (x1 - x0) * 0.4);
      const uy = y0 + Math.min(5, (y1 - y0) * 0.3);
      out.push(`<line class="rys-uchwyt" x1="${n((x0 + x1) / 2 - uw / 2)}" y1="${n(uy)}" x2="${n((x0 + x1) / 2 + uw / 2)}" y2="${n(uy)}" />`);
    } else if (f.typ === "przesuwne") {
      const my = (y0 + y1) / 2;
      out.push(`<line class="rys-otw" x1="${n(x0 + (x1 - x0) * 0.3)}" y1="${n(my)}" x2="${n(x0 + (x1 - x0) * 0.7)}" y2="${n(my)}" />`);
    } else if (f.typ === "agd" && f.napis) {
      out.push(`<line class="rys-otw" x1="${n(x0 + g)}" y1="${n(y0 + g)}" x2="${n(x1 - g)}" y2="${n(y1 - g)}" />`);
      if (x1 - x0 > fs * 2.2 && y1 - y0 > fs * 1.2)
        out.push(`<text class="rys-agd" x="${n((x0 + x1) / 2)}" y="${n((y0 + y1) / 2)}" font-size="${n(Math.min(fs * 0.85, (x1 - x0) / Math.max(4, f.napis.length * 0.6)))}" text-anchor="middle" dominant-baseline="central">${esc(f.napis)}</text>`);
    }
  }
}

/* ---------- rzut z góry ---------- */

const FRONT: Record<number, Pkt> = { 0: [0, 1], 90: [1, 0], 180: [0, -1], 270: [-1, 0] };
const KOLEJNOSC: Record<ElementKuchni["strefa"], number> = { dolna: 0, wysoka: 1, blat: 2, gorna: 3, polka: 4 };

function zasieg(plan: PlanKuchni) {
  let x1 = Math.max(plan.scianaA, plan.pomieszczenie?.szer ?? 0, 60);
  let z1 = Math.max(plan.uklad === "L" ? plan.scianaB : 0, plan.pomieszczenie?.dlug ?? 0, 60);
  for (const e of plan.elementy) {
    const r = rectBazowy(e);
    x1 = Math.max(x1, r.x1);
    z1 = Math.max(z1, r.z1);
  }
  for (const sd of plan.sciany?.dodatkowe ?? [])
    for (const p of naroznikiSciany(sd)) {
      x1 = Math.max(x1, p.x);
      z1 = Math.max(z1, p.z);
    }
  return { x1, z1 };
}

/** Otwory na ścianie w rzucie: przerwa w murze, okno (3 linie), drzwi (skrzydło i łuk). */
function otworyRzut(out: string[], plan: PlanKuchni, s: Sciana, gr: number) {
  const ot = (plan.wywiad?.otwory ?? []).filter((o) => o.sciana === s.id).sort((a, b) => a.od - b.od);
  // Mur (pogrubiony, na zewnątrz pokoju) z przerwami na otwory.
  let t = 0;
  const mur = (a: number, b: number) => {
    if (b - a < 0.5) return;
    const p = [s.x + s.dx * a, s.z + s.dz * a];
    const q = [s.x + s.dx * b, s.z + s.dz * b];
    const xs = [p[0], q[0], q[0] - s.nx * gr, p[0] - s.nx * gr];
    const zs = [p[1], q[1], q[1] - s.nz * gr, p[1] - s.nz * gr];
    out.push(`<polygon class="rys-mur" points="${xs.map((x, i) => `${n(x)},${n(zs[i])}`).join(" ")}" />`);
  };
  for (const o of ot) {
    mur(t, o.od);
    t = Math.max(t, o.od + o.szer);
  }
  mur(t, s.dlugosc);
  for (const o of ot) {
    const a = o.od;
    const b = o.od + o.szer;
    const P = (u: number, w: number): Pkt => [s.x + s.dx * u - s.nx * w, s.z + s.dz * u - s.nz * w];
    if (o.rodzaj === "okno") {
      for (const w of [0, gr / 2, gr]) out.push(`<line class="rys-okno" x1="${n(P(a, w)[0])}" y1="${n(P(a, w)[1])}" x2="${n(P(b, w)[0])}" y2="${n(P(b, w)[1])}" />`);
      out.push(`<line class="rys-cienka" x1="${n(P(a, 0)[0])}" y1="${n(P(a, 0)[1])}" x2="${n(P(a, gr)[0])}" y2="${n(P(a, gr)[1])}" />`);
      out.push(`<line class="rys-cienka" x1="${n(P(b, 0)[0])}" y1="${n(P(b, 0)[1])}" x2="${n(P(b, gr)[0])}" y2="${n(P(b, gr)[1])}" />`);
    } else {
      const p1 = P(a, 0);
      const p2 = P(b, 0);
      const lisc: Pkt = [p1[0] + s.nx * o.szer, p1[1] + s.nz * o.szer];
      const zgodnie = s.dx * s.nz - s.dz * s.nx > 0 ? 0 : 1;
      out.push(`<line class="rys-front" x1="${n(p1[0])}" y1="${n(p1[1])}" x2="${n(lisc[0])}" y2="${n(lisc[1])}" />`);
      out.push(`<path class="rys-otw" d="M${n(p2[0])} ${n(p2[1])} A${n(o.szer)} ${n(o.szer)} 0 0 ${zgodnie} ${n(lisc[0])} ${n(lisc[1])}" />`);
    }
  }
}

/** Symbol punktu instalacji (rzut i widok ściany): kółko z literą. */
const SYMBOL: Record<PunktInstalacji["rodzaj"], string> = { gniazdko: "G", "gniazdko-2": "2G", sila: "400", wlacznik: "W", swiatlo: "Ś", rtv: "TV", gaz: "gaz", kratka: "K" };
function punktSymbol(out: string[], x: number, y: number, p: PunktInstalacji, r: number) {
  out.push(
    `<g class="rys-punkt"><circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" /><text x="${n(x)}" y="${n(y)}" font-size="${n(r * (SYMBOL[p.rodzaj].length > 2 ? 0.8 : 1.05))}" text-anchor="middle" dominant-baseline="central">${SYMBOL[p.rodzaj]}</text></g>`,
  );
}

/** Rzut z góry: ściany z otworami, meble (dolne pełne, górne przerywane), numery pozycji, gniazdka, wymiary. */
export function svgRzutu(plan: PlanKuchni): string {
  const { x1, z1 } = zasieg(plan);
  const fs = Math.min(13, Math.max(6.5, Math.max(x1, z1) / 48));
  const gr = 10;
  const m = fs * 6.2;
  const out: string[] = [];
  const sciany = scianyPokoju(plan);
  if (plan.sciany?.obrys && plan.sciany.obrys.length >= 3) out.push(`<polygon class="rys-pokoj" points="${plan.sciany.obrys.map((p) => `${n(p.x)},${n(p.z)}`).join(" ")}" />`);
  else if (plan.pomieszczenie) out.push(`<rect class="rys-pokoj" x="0" y="0" width="${n(plan.pomieszczenie.szer)}" height="${n(plan.pomieszczenie.dlug)}" />`);
  for (const s of sciany) otworyRzut(out, plan, s, gr);
  // Dodatkowe ściany (działowe, skosy) – mur z numerem i długością.
  (plan.sciany?.dodatkowe ?? []).forEach((sd, i) => {
    out.push(`<polygon class="rys-mur" points="${naroznikiSciany(sd).map((p) => `${n(p.x)},${n(p.z)}`).join(" ")}" />`);
    const kat = sd.kat > 90 ? sd.kat - 180 : sd.kat;
    const ty = sd.z - sd.grubosc / 2 - fs * 0.7;
    out.push(`<text class="rys-opis" x="${n(sd.x)}" y="${n(ty)}" font-size="${n(fs * 0.8)}" text-anchor="middle"${kat ? ` transform="rotate(${n(kat)} ${n(sd.x)} ${n(sd.z)})"` : ""}>ściana ${i + 1} · ${cm(sd.dlugosc)}</text>`);
  });
  const el = plan.elementy.map((e, i) => ({ e, i })).sort((a, b) => KOLEJNOSC[a.e.strefa] - KOLEJNOSC[b.e.strefa]);
  for (const { e } of el) {
    const r = rectBazowy(e);
    const kls = e.strefa === "gorna" ? "rys-gorna" : e.strefa === "polka" ? "rys-polka" : e.strefa === "wysoka" ? "rys-wysoka" : e.strefa === "blat" ? "rys-blat" : "rys-dolna";
    const rot = e.kat ? ` transform="rotate(${n(-e.kat)} ${n(e.x)} ${n(e.z)})"` : "";
    out.push(`<rect class="${kls}" x="${n(r.x0)}" y="${n(r.z0)}" width="${n(r.x1 - r.x0)}" height="${n(r.z1 - r.z0)}"${rot} />`);
    if (e.strefa === "dolna" || e.strefa === "wysoka") {
      // Krawędź frontu.
      const f = FRONT[e.rot] ?? [0, 1];
      const a: Pkt = f[1] ? [r.x0, f[1] > 0 ? r.z1 : r.z0] : [f[0] > 0 ? r.x1 : r.x0, r.z0];
      const b: Pkt = f[1] ? [r.x1, a[1]] : [a[0], r.z1];
      out.push(`<line class="rys-krawedz"${rot} x1="${n(a[0])}" y1="${n(a[1])}" x2="${n(b[0])}" y2="${n(b[1])}" />`);
    }
  }
  // Numery pozycji (jak w tabeli oferty): dolne bliżej frontu, górne bliżej ściany.
  for (const { e, i } of el) {
    const f = FRONT[e.rot] ?? [0, 1];
    const k = e.strefa === "gorna" || e.strefa === "polka" ? 0 : e.strefa === "blat" ? -0.1 : 0.3;
    const cx = e.x + f[0] * e.d * k;
    const cz = e.z + f[1] * e.d * k;
    const r = fs * 0.78;
    out.push(
      `<g class="rys-nr${e.strefa === "gorna" || e.strefa === "polka" ? " rys-nr-g" : ""}"><circle cx="${n(cx)}" cy="${n(cz)}" r="${n(r)}" /><text x="${n(cx)}" y="${n(cz)}" font-size="${n(fs * 0.85)}" text-anchor="middle" dominant-baseline="central">${i + 1}</text></g>`,
    );
  }
  for (const p of plan.wywiad?.punkty ?? []) {
    const s = sciany.find((w) => w.id === p.sciana);
    if (s) punktSymbol(out, s.x + s.dx * p.od + s.nx * fs * 0.6, s.z + s.dz * p.od + s.nz * fs * 0.6, p, fs * 0.55);
  }
  if (plan.wywiad?.woda) {
    const s = sciany.find((w) => w.id === plan.wywiad?.woda?.sciana);
    if (s) out.push(`<circle class="rys-woda" cx="${n(s.x + s.dx * plan.wywiad.woda.od + s.nx * 4)}" cy="${n(s.z + s.dz * plan.wywiad.woda.od + s.nz * 4)}" r="${n(fs * 0.38)}" />`);
  }
  // Wymiary: długości ścian (na zewnątrz muru) i łańcuchy szafek przy ścianach.
  for (const s of sciany) {
    const na = (t: number): Pkt => [s.x + s.dx * t, s.z + s.dz * t];
    // Kierunek „w lewo” od a→b to (−dz, dx); na zewnątrz pokoju = −normalna.
    const lewo = -s.dz * -s.nx + s.dx * -s.nz;
    const zew = (d: number) => d * (lewo >= 0 ? 1 : -1);
    wymiar(out, na(0), na(s.dlugosc), zew(gr + fs * 3.4), `${s.id} · ${cm(s.dlugosc)}`, fs);
    const krawedzie = plan.elementy.flatMap((e) => {
      if (e.strefa !== "dolna" && e.strefa !== "wysoka") return [];
      const o = meblaPrzyScianie(e, s);
      return o ? [o.a, o.b] : [];
    });
    if (krawedzie.length) lancuch(out, [0, s.dlugosc, ...krawedzie], na, zew(gr + fs * 1.4), fs * 0.85);
  }
  const vb = `${n(-m)} ${n(-m)} ${n(x1 + 2 * m)} ${n(z1 + 2 * m)}`;
  return `<svg class="rys-svg" xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="Rzut z góry z wymiarami">${STYL}${out.join("")}</svg>`;
}

/* ---------- widoki ścian ---------- */

/** Ściany, które warto narysować: z meblami, oknami, drzwiami albo gniazdkami. */
export function scianyDoWidoku(plan: PlanKuchni): ScianaPokoju[] {
  return scianyPokoju(plan)
    .filter(
      (s) =>
        plan.elementy.some((e) => meblaPrzyScianie(e, s)) ||
        (plan.wywiad?.otwory ?? []).some((o) => o.sciana === s.id) ||
        (plan.wywiad?.punkty ?? []).some((p) => p.sciana === s.id),
    )
    .map((s) => s.id);
}

/** Widok ściany od środka pokoju: meble z frontami, okna, drzwi, gniazdka; wymiary w poziomie i w pionie. */
export function svgSciany(plan: PlanKuchni, id: ScianaPokoju): string {
  const s = scianyPokoju(plan).find((w) => w.id === id);
  if (!s) return "";
  const H = wysokoscPokoju(plan);
  const L = s.dlugosc;
  const fs = Math.min(12, Math.max(6, Math.max(L, H) / 46));
  // Widok od środka pokoju: ściana, której kierunek × normalna < 0, rysuje się w lustrze (B i C w prostokącie).
  const lustro = !!s && s.dx * s.nz - s.dz * s.nx < 0;
  const X = (t: number) => (lustro ? L - t : t);
  const Y = (y: number) => H - y;
  const out: string[] = [];
  out.push(`<rect class="rys-sciana" x="0" y="0" width="${n(L)}" height="${n(H)}" />`);
  out.push(`<line class="rys-podloga" x1="${n(-8)}" y1="${n(H)}" x2="${n(L + 8)}" y2="${n(H)}" />`);
  for (const o of (plan.wywiad?.otwory ?? []).filter((x) => x.sciana === id)) {
    const { y0, y1 } = wysokoscOtworu(o, H);
    const xa = Math.min(X(o.od), X(o.od + o.szer));
    out.push(`<rect class="rys-otwor" x="${n(xa)}" y="${n(Y(y1))}" width="${n(o.szer)}" height="${n(y1 - y0)}" />`);
    if (o.rodzaj === "okno") {
      out.push(`<line class="rys-cienka" x1="${n(xa + o.szer / 2)}" y1="${n(Y(y1))}" x2="${n(xa + o.szer / 2)}" y2="${n(Y(y0))}" />`);
      out.push(`<line class="rys-cienka" x1="${n(xa - 2)}" y1="${n(Y(y0) + 1.5)}" x2="${n(xa + o.szer + 2)}" y2="${n(Y(y0) + 1.5)}" />`);
    } else out.push(`<polyline class="rys-otw" points="${n(xa)},${n(Y(y1))} ${n(xa + o.szer / 2)},${n(Y(0))} ${n(xa + o.szer)},${n(Y(y1))}" />`);
  }
  const meble = plan.elementy
    .map((e, i) => ({ e, i, o: meblaPrzyScianie(e, s) }))
    .filter((m): m is { e: ElementKuchni; i: number; o: { a: number; b: number; glebia: number } } => !!m.o)
    .sort((a, b) => KOLEJNOSC[a.e.strefa] - KOLEJNOSC[b.e.strefa]);
  const dolne: number[] = [];
  const gorne: number[] = [];
  const poziomy = new Set<number>([0, H]);
  for (const { e, i, o } of meble) {
    const y0 = Math.round(yElementu(e, plan) * 1000) / 10;
    const szer = o.b - o.a;
    const xa = Math.min(X(o.a), X(o.b));
    // Mebel ustawiony bokiem do ściany (szerokość wzdłuż ≠ e.w) – widać bok: sam obrys.
    const bokiem = Math.abs(szer - e.w) > 1 && Math.abs(szer - e.d) <= 1;
    if (e.strefa === "blat") {
      // Płyta, zlewozmywak, bateria – obrys na blacie.
      out.push(`<rect class="rys-blat" x="${n(xa)}" y="${n(Y(y0 + Math.max(2, e.h)))}" width="${n(szer)}" height="${n(Math.max(2, e.h))}" />`);
      continue;
    }
    if (bokiem || e.kat) out.push(`<rect class="rys-mebel" x="${n(xa)}" y="${n(Y(y0 + e.h))}" width="${n(szer)}" height="${n(e.h)}" />`);
    else frontySvg(out, e, xa, Y(y0), fs);
    if (e.strefa === "dolna") {
      // Blat nad szafkami dolnymi (3 cm).
      out.push(`<rect class="rys-blatwierzch" x="${n(xa)}" y="${n(Y(y0 + e.h + 3))}" width="${n(szer)}" height="3" />`);
      poziomy.add(Math.round(e.h + 3));
    }
    if (e.strefa === "gorna" || e.strefa === "polka") {
      gorne.push(o.a, o.b);
      poziomy.add(Math.round(y0));
      poziomy.add(Math.round(y0 + e.h));
    } else {
      dolne.push(o.a, o.b);
      if (e.strefa === "wysoka") poziomy.add(Math.round(y0 + e.h));
    }
    const r = fs * 0.72;
    const cx = xa + szer / 2;
    const cy = Y(y0 + e.h) + r + 2;
    out.push(`<g class="rys-nr"><circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" /><text x="${n(cx)}" y="${n(cy)}" font-size="${n(fs * 0.8)}" text-anchor="middle" dominant-baseline="central">${i + 1}</text></g>`);
  }
  for (const p of (plan.wywiad?.punkty ?? []).filter((x) => x.sciana === id)) {
    punktSymbol(out, X(p.od), Y(p.wys), p, fs * 0.55);
    out.push(`<text class="rys-opis" x="${n(X(p.od) + fs * 0.75)}" y="${n(Y(p.wys) - fs * 0.6)}" font-size="${n(fs * 0.62)}">${p.wys}</text>`);
  }
  // Wymiary: łańcuch szafek dolnych pod podłogą, górnych nad sufitem, długość ściany, poziomy po prawej.
  const naDole = (t: number): Pkt => [X(t), H];
  const naGorze = (t: number): Pkt => [X(t), 0];
  // Dla linii a→b w prawo (lub w lewo przy lustrze) „lewo” wypada w górę albo w dół – off z właściwym znakiem.
  const dol = (d: number) => (lustro ? -d : d);
  if (dolne.length) lancuch(out, [0, L, ...dolne], naDole, dol(fs * 1.6), fs * 0.85);
  if (gorne.length) lancuch(out, [0, L, ...gorne], naGorze, -dol(fs * 1.6), fs * 0.85);
  for (const o of (plan.wywiad?.otwory ?? []).filter((x) => x.sciana === id)) {
    const { y0, y1 } = wysokoscOtworu(o, H);
    if (o.rodzaj === "okno") poziomy.add(y0);
    poziomy.add(y1);
  }
  wymiar(out, naDole(0), naDole(L), dol(fs * 3.6), `${etykietaSciany(plan, id).replace(/ \(.*\)/, "")} · ${cm(L)}`, fs);
  const pion = Array.from(poziomy).filter((v) => v >= 0 && v <= H);
  lancuch(out, pion, (y) => [L, Y(y)], fs * 1.6, fs * 0.85);
  wymiar(out, [L, Y(0)], [L, Y(H)], fs * 4, `wys. ${cm(H)}`, fs * 0.9);
  const m = fs * 6.4;
  const vb = `${n(-m * 0.6)} ${n(-m)} ${n(L + m * 1.8)} ${n(H + 2 * m)}`;
  return `<svg class="rys-svg" xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="Widok ściany ${id}">${STYL}${out.join("")}</svg>`;
}

/* ---------- pojedynczy mebel ---------- */

/** Rysunek mebla: widok z przodu (podział frontów) i z boku, z wymiarami. Blat (płyta, zlew): widok z góry. */
export function svgElementu(el: ElementKuchni): string {
  const out: string[] = [];
  const fs = Math.min(9, Math.max(4.5, Math.max(el.w, el.h) / 18));
  const odstep = fs * 5;
  if (el.strefa === "blat" || el.h < 12) {
    out.push(`<rect class="rys-mebel" x="0" y="0" width="${n(el.w)}" height="${n(el.d)}" />`);
    const r = rodzajElementu(el);
    if (r.startsWith("plyta")) {
      const k = Math.min(el.w, el.d) * 0.17;
      for (const [cx, cy] of [
        [0.28, 0.3],
        [0.72, 0.3],
        [0.28, 0.7],
        [0.72, 0.7],
      ])
        out.push(`<circle class="rys-cienka" cx="${n(el.w * cx)}" cy="${n(el.d * cy)}" r="${n(k)}" />`);
    } else if (r === "zlewozmywak") out.push(`<rect class="rys-front" x="${n(el.w * 0.12)}" y="${n(el.d * 0.15)}" width="${n(el.w * 0.76)}" height="${n(el.d * 0.7)}" rx="3" />`);
    wymiar(out, [0, el.d], [el.w, el.d], fs * 1.6, cm(el.w), fs);
    wymiar(out, [el.w, el.d], [el.w, 0], fs * 1.6, cm(el.d), fs);
    const m = fs * 4.5;
    return `<svg class="rys-svg" xmlns="http://www.w3.org/2000/svg" viewBox="${n(-m)} ${n(-m)} ${n(el.w + 2 * m)} ${n(el.d + 2 * m)}" role="img" aria-label="Widok z góry">${STYL}${out.join("")}</svg>`;
  }
  frontySvg(out, el, 0, el.h, fs);
  // Widok z boku: bok, plecy, front.
  const bx = el.w + odstep;
  out.push(`<rect class="rys-mebel" x="${n(bx)}" y="0" width="${n(el.d)}" height="${n(el.h)}" />`);
  out.push(`<line class="rys-cienka" x1="${n(bx + 1.8)}" y1="0" x2="${n(bx + 1.8)}" y2="${n(el.h)}" />`);
  out.push(`<line class="rys-cienka" x1="${n(bx + el.d - 1.8)}" y1="0" x2="${n(bx + el.d - 1.8)}" y2="${n(el.h)}" />`);
  wymiar(out, [0, el.h], [el.w, el.h], fs * 1.6, cm(el.w), fs);
  wymiar(out, [bx, el.h], [bx + el.d, el.h], fs * 1.6, cm(el.d), fs);
  wymiar(out, [bx + el.d, el.h], [bx + el.d, 0], fs * 1.6, cm(el.h), fs);
  out.push(`<text class="rys-opis" x="${n(el.w / 2)}" y="${n(-fs * 0.9)}" font-size="${n(fs * 0.8)}" text-anchor="middle">przód</text>`);
  out.push(`<text class="rys-opis" x="${n(bx + el.d / 2)}" y="${n(-fs * 0.9)}" font-size="${n(fs * 0.8)}" text-anchor="middle">bok</text>`);
  const m = fs * 4.5;
  return `<svg class="rys-svg" xmlns="http://www.w3.org/2000/svg" viewBox="${n(-m * 0.5)} ${n(-m * 0.9)} ${n(bx + el.d + m * 1.6)} ${n(el.h + m * 1.9)}" role="img" aria-label="Widok z przodu i z boku">${STYL}${out.join("")}</svg>`;
}

/** Style SVG – wewnątrz każdego rysunku (działa w PDF, w oknie i na stronie klienta). */
const STYL = `<style>
.rys-svg text{font-family:"Segoe UI",system-ui,sans-serif;fill:${KRESKA}}
.rys-wym line{stroke:${SZARY};stroke-width:.35}
.rys-wym .rys-tick{stroke:${KRESKA};stroke-width:.6}
.rys-wym text{fill:${KRESKA}}
.rys-pokoj{fill:#faf8f4;stroke:none}
.rys-mur{fill:#3f3b37;stroke:none}
.rys-okno{stroke:#2563a8;stroke-width:.8}
.rys-dolna{fill:#efe9df;stroke:${KRESKA};stroke-width:.8}
.rys-wysoka{fill:#ddd5c8;stroke:${KRESKA};stroke-width:.8}
.rys-blat{fill:#fff;stroke:${KRESKA};stroke-width:.6}
.rys-gorna{fill:none;stroke:${KRESKA};stroke-width:.7;stroke-dasharray:4 2.5}
.rys-polka{fill:none;stroke:${SZARY};stroke-width:.6;stroke-dasharray:1.5 2}
.rys-krawedz{stroke:${KRESKA};stroke-width:2}
.rys-nr circle{fill:#fff;stroke:${KRESKA};stroke-width:.6}
.rys-nr-g circle{stroke-dasharray:2 1.2}
.rys-nr text{font-weight:600}
.rys-punkt circle{fill:#fff;stroke:${AKCENT};stroke-width:.6}
.rys-punkt text{fill:${AKCENT};font-weight:700}
.rys-woda{fill:#2f7fd1}
.rys-sciana{fill:#fbfaf8;stroke:${KRESKA};stroke-width:.9}
.rys-podloga{stroke:${KRESKA};stroke-width:1.6}
.rys-otwor{fill:#e8f0f8;stroke:${KRESKA};stroke-width:.7}
.rys-mebel{fill:#f3eee6;stroke:${KRESKA};stroke-width:.8}
.rys-front{fill:#fff;stroke:${KRESKA};stroke-width:.5}
.rys-wneka{fill:#e7e1d6;stroke:${KRESKA};stroke-width:.4}
.rys-blatwierzch{fill:#cfc6b8;stroke:${KRESKA};stroke-width:.4}
.rys-otw{fill:none;stroke:${SZARY};stroke-width:.4;stroke-dasharray:2 1.4}
.rys-cienka{fill:none;stroke:${SZARY};stroke-width:.4}
.rys-uchwyt{stroke:${KRESKA};stroke-width:1}
.rys-agd{fill:${SZARY}}
.rys-opis{fill:${SZARY}}
</style>`;

/* ---------- arkusz ---------- */

export type MetaRysunku = { firma: string; id: string; tytul: string; data: string };

/**
 * Rysunek techniczny jako fragment HTML (arkusze: rzut, widoki ścian, legenda, tabelka rysunkowa).
 * Klasy „rt-” – style w RT_CSS (PDF i okno rysunku je dołączają).
 */
export function rysunekTechnicznyHtml(plan: PlanKuchni, meta: MetaRysunku): string {
  const tabelka = `<table class="rt-tabelka"><tr><td>${esc(meta.firma)}</td><td>Oferta ${esc(meta.id)}</td><td>${esc(meta.tytul)}</td><td>${esc(meta.data)}</td></tr><tr><td colspan="4">Wymiary w cm · rysunek bez skali · numery = pozycje w ofercie · do weryfikacji pomiarem na miejscu</td></tr></table>`;
  const sciany = scianyDoWidoku(plan);
  const legenda = `<p class="rt-legenda"><span class="rt-l rt-l-d"></span> szafki dolne i słupki <span class="rt-l rt-l-g"></span> szafki górne <span class="rt-l rt-l-k"></span> krawędź frontu${(plan.wywiad?.punkty ?? []).length ? " · G gniazdko, 2G podwójne, 400 siła, W włącznik, Ś światło, TV RTV/LAN, gaz zawór, K kratka" : ""}${plan.wywiad?.woda ? " · ● woda" : ""}</p>`;
  return `<section class="rt-arkusz">
<h2 class="rt-tytul">Rysunek techniczny – rzut z góry</h2>
<div class="rt-rys rt-rzut">${svgRzutu(plan)}</div>
${legenda}
${tabelka}
</section>
${sciany
  .map(
    (id) => `<section class="rt-arkusz rt-sciana">
<h2 class="rt-tytul">Widok ${esc(etykietaSciany(plan, id).replace("Ściana", "ściany"))} – od środka pomieszczenia</h2>
<div class="rt-rys">${svgSciany(plan, id)}</div>
${tabelka}
</section>`,
  )
  .join("\n")}`;
}

export const RT_CSS = `
.rt-arkusz { break-before: page; page-break-before: always; }
.rt-tytul { font-size: 15px; margin: 0 0 8px; }
.rt-rys { border: 1px solid #d6d3d1; padding: 6px; background: #fff; }
.rt-rys svg { display: block; width: 100%; height: auto; max-height: 205mm; }
.rt-sciana .rt-rys svg { max-height: 150mm; }
.rt-legenda { font-size: 11px; color: #57534e; margin: 6px 0; }
.rt-l { display: inline-block; width: 18px; height: 9px; vertical-align: middle; margin: 0 3px 0 8px; border: 1px solid #1c1917; }
.rt-l-d { background: #efe9df; }
.rt-l-g { border-style: dashed; }
.rt-l-k { border: 0; border-bottom: 2px solid #1c1917; height: 0; }
.rt-tabelka { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
.rt-tabelka td { border: 1px solid #a8a29e; padding: 4px 6px; }
`;

/** Samodzielny dokument (okno „Rysunek techniczny”: druk albo zapis do PDF). */
export function rysunekTechnicznyDokument(plan: PlanKuchni, meta: MetaRysunku, drukuj = false): string {
  return `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Rysunek techniczny ${esc(meta.id)}</title>
<style>@page { size: A4 landscape; margin: 10mm; } body { margin: 16px; color: #1c1917; font: 13px/1.45 "Segoe UI", system-ui, sans-serif; } .rt-arkusz:first-child { break-before: auto; page-break-before: auto; } @media screen { .rt-arkusz { margin-bottom: 28px; } }${RT_CSS}</style></head>
<body>${rysunekTechnicznyHtml(plan, meta)}${drukuj ? `<script>window.addEventListener("load", () => setTimeout(() => window.print(), 200));</script>` : ""}</body></html>`;
}
