/*
 * Kształt pokoju: przejście prostokąt ↔ obrys o dowolnej liczbie ścian i edycja obrysu (kreator ścian).
 *
 * Zmiany geometrii (przesunięcie narożnika, długość ściany) zostawiają litery ścian – okna, drzwi i gniazdka jadą razem
 * ze swoją ścianą (muszą się na niej zmieścić). Zmiany układu (podział ściany, usunięcie narożnika, gotowy kształt,
 * przejście prostokąt ↔ obrys) przenoszą je po położeniu w pokoju na ścianę, na której teraz leżą (przeniesNaSciany).
 * Po każdej zmianie: wymiary pokoju = prostokąt opisany, ściana A (i B, gdy biegnie wzdłuż osi z) = długości z obrysu.
 */
import type { PlanKuchni } from "./kuchnia";
import {
  czyObrys,
  krawedzieObrysu,
  MIN_SCIANA,
  obrysZProstokata,
  przeniesNaSciany,
  prostokatObrysu,
  scianyObrysu,
  scianyPokojuWszystkie,
  sprawdzObrys,
  zabudowaZObrysu,
  type Punkt,
  type Sciana,
  type ScianaPokoju,
  type ScianaUsuwalna,
  type UstawieniaScian,
} from "./sciany";

export type Wynik = { plan: PlanKuchni } | { blad: string };

/** Nowa litera starej ściany po zmianie układu – ściana, na której leży środek starej (null = jej nie ma). */
function nowaLitera(id: ScianaPokoju, stare: readonly Sciana[], nowe: readonly Sciana[]): ScianaPokoju | null {
  const s = stare.find((x) => x.id === id);
  if (!s) return null;
  const m = { x: s.x + (s.dx * s.dlugosc) / 2, z: s.z + (s.dz * s.dlugosc) / 2 };
  const n = nowe.find((w) => {
    const t = (m.x - w.x) * w.dx + (m.z - w.z) * w.dz;
    return Math.abs((m.x - w.x) * w.nx + (m.z - w.z) * w.nz) < 1.5 && t > 0 && t < w.dlugosc;
  });
  return n?.id ?? null;
}

/** Litery usuniętych ścian po zmianie układu. */
function przeniesBez(bez: readonly ScianaUsuwalna[] | undefined, stare: readonly Sciana[], nowe: readonly Sciana[]) {
  if (!bez?.length) return undefined;
  const out = new Set<ScianaUsuwalna>();
  for (const id of bez) {
    const n = nowaLitera(id, stare, nowe);
    if (n && n !== "A") out.add(n as ScianaUsuwalna);
  }
  return out.size ? Array.from(out).sort() : undefined;
}

/** Kolory (też grubości, wysokości) ścian po zmianie układu (podzielona ściana – obie części dostają wartość starej). */
function przeniesKolory<V>(k: Partial<Record<ScianaPokoju, V>> | undefined, stare: readonly Sciana[], nowe: readonly Sciana[]) {
  if (!k || !Object.keys(k).length) return undefined;
  const out: Partial<Record<ScianaPokoju, V>> = {};
  for (const w of nowe) {
    const m = { x: w.x + (w.dx * w.dlugosc) / 2, z: w.z + (w.dz * w.dlugosc) / 2 };
    const s = stare.find((x) => {
      const t = (m.x - x.x) * x.dx + (m.z - x.z) * x.dz;
      return Math.abs((m.x - x.x) * x.nx + (m.z - x.z) * x.nz) < 1.5 && t > 0 && t < x.dlugosc;
    });
    const kolor = s ? k[s.id] : undefined;
    if (kolor !== undefined) out[w.id] = kolor;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Plan z nowym obrysem (null = prostokąt o wymiarach `prostokat`). */
function zObrysem(
  p: PlanKuchni,
  obrys: Punkt[] | null,
  bez: ScianaUsuwalna[] | undefined,
  prostokat?: { szer: number; dlug: number },
  kolory: UstawieniaScian["koloryScian"] = p.sciany?.koloryScian,
  wymiary: Pick<UstawieniaScian, "grubosci" | "wysokosci"> = { grubosci: p.sciany?.grubosci, wysokosci: p.sciany?.wysokosci },
): PlanKuchni {
  const { obrys: _o, bez: _b, koloryScian: _k, grubosci: _g, wysokosci: _w, ...reszta } = p.sciany ?? {};
  void _o;
  void _b;
  void _k;
  void _g;
  void _w;
  const sciany = {
    ...reszta,
    ...(obrys ? { obrys } : {}),
    ...(bez?.length ? { bez } : {}),
    ...(kolory ? { koloryScian: kolory } : {}),
    ...(wymiary.grubosci && Object.keys(wymiary.grubosci).length ? { grubosci: wymiary.grubosci } : {}),
    ...(wymiary.wysokosci && Object.keys(wymiary.wysokosci).length ? { wysokosci: wymiary.wysokosci } : {}),
  };
  const out: PlanKuchni = { ...p, sciany: Object.keys(sciany).length ? sciany : undefined };
  if (!out.sciany) delete out.sciany;
  if (obrys) {
    const z = zabudowaZObrysu(obrys);
    out.pomieszczenie = prostokatObrysu(obrys);
    out.scianaA = Math.max(80, Math.min(1200, z.A));
    if (z.B !== null) out.scianaB = Math.max(80, Math.min(1200, z.B));
  } else if (prostokat) {
    out.pomieszczenie = prostokat;
    out.scianaA = Math.max(80, Math.min(1200, Math.min(out.scianaA, prostokat.szer)));
  }
  return out;
}

/** Okna, drzwi i gniazdka po zmianie geometrii: każde musi się zmieścić na swojej ścianie. */
function sprawdzZawartosc(p: PlanKuchni, nowe: readonly Sciana[]): string | null {
  for (const o of p.wywiad?.otwory ?? []) {
    const s = nowe.find((x) => x.id === o.sciana);
    if (s && o.od + o.szer > s.dlugosc + 0.5) return `${o.rodzaj === "okno" ? "Okno" : "Drzwi"} nie mieszczą się na ścianie ${o.sciana} (${Math.round(s.dlugosc)} cm).`;
  }
  for (const pk of p.wywiad?.punkty ?? []) {
    const s = nowe.find((x) => x.id === pk.sciana);
    if (s && pk.od > s.dlugosc + 0.5) return `Gniazdko nie mieści się na ścianie ${pk.sciana}.`;
  }
  if (p.wywiad?.woda) {
    const s = nowe.find((x) => x.id === p.wywiad!.woda!.sciana);
    if (s && p.wywiad.woda.od > s.dlugosc + 0.5) return `Podejście wody nie mieści się na ścianie ${s.id}.`;
  }
  return null;
}

/** Nowy obrys. topologia = zmieniła się liczba albo kolejność ścian (przenieś elementy po położeniu). */
export function zastosujObrys(p: PlanKuchni, obrys: Punkt[], topologia: boolean): Wynik {
  const bledy = sprawdzObrys(obrys);
  if (bledy.length) return { blad: bledy[0] };
  const stare = scianyPokojuWszystkie(p);
  const nowe = scianyObrysu(obrys);
  if (!topologia) {
    const blad = sprawdzZawartosc(p, nowe);
    if (blad) return { blad };
    return { plan: zObrysem(p, obrys, p.sciany?.bez) };
  }
  let wywiad = p.wywiad;
  if (wywiad) {
    const w = przeniesNaSciany(wywiad, stare, nowe);
    if ("blad" in w) return w;
    wywiad = w.wywiad;
  }
  const wymiary = { grubosci: przeniesKolory(p.sciany?.grubosci, stare, nowe), wysokosci: przeniesKolory(p.sciany?.wysokosci, stare, nowe) };
  return { plan: { ...zObrysem(p, obrys, przeniesBez(p.sciany?.bez, stare, nowe), undefined, przeniesKolory(p.sciany?.koloryScian, stare, nowe), wymiary), ...(wywiad ? { wywiad } : {}) } };
}

/** Prostokąt → pokój o dowolnym kształcie (te same ściany, okna i drzwi zostają na miejscach). */
export function naObrys(p: PlanKuchni): Wynik {
  if (czyObrys(p)) return { plan: p };
  const baza: PlanKuchni = p.pomieszczenie ? p : { ...p, pomieszczenie: { szer: Math.max(p.scianaA, 120), dlug: Math.max(p.uklad === "L" ? p.scianaB : 0, 300) } };
  return zastosujObrys(baza, obrysZProstokata(baza), true);
}

/** Pokój o dowolnym kształcie → prostokąt opisany (gdy okna, drzwi i gniazdka mają gdzie zostać). */
export function naProstokat(p: PlanKuchni): Wynik {
  if (!czyObrys(p)) return { plan: p };
  const prostokat = prostokatObrysu(p.sciany!.obrys!);
  const stare = scianyPokojuWszystkie(p);
  const cel0 = zObrysem(p, null, undefined, prostokat, undefined, {});
  const nowe = scianyPokojuWszystkie(cel0);
  const kol = przeniesKolory(p.sciany?.koloryScian, stare, nowe);
  const gr = przeniesKolory(p.sciany?.grubosci, stare, nowe);
  const wy = przeniesKolory(p.sciany?.wysokosci, stare, nowe);
  const cel = kol || gr || wy ? { ...cel0, sciany: { ...cel0.sciany, ...(kol ? { koloryScian: kol } : {}), ...(gr ? { grubosci: gr } : {}), ...(wy ? { wysokosci: wy } : {}) } } : cel0;
  let wywiad = p.wywiad;
  if (wywiad) {
    const w = przeniesNaSciany(wywiad, stare, nowe);
    if ("blad" in w) return { blad: w.blad.replace("przenieś je najpierw", "przenieś je na ścianę prostokąta") };
    wywiad = w.wywiad;
  }
  const bez = przeniesBez(p.sciany?.bez, stare, nowe);
  return { plan: { ...cel, ...(bez ? { sciany: { ...cel.sciany, bez } } : {}), ...(wywiad ? { wywiad } : {}) } };
}

/* ---------- operacje na obrysie ---------- */

const krok = (v: number, k: number) => Math.round(v / k) * k;

/** Podział ściany k w połowie (nowy narożnik). */
export function podzielSciane(w: readonly Punkt[], k: number): Punkt[] {
  const [i, j] = krawedzieObrysu(w.length)[k];
  const m = { x: Math.round((w[i].x + w[j].x) / 2), z: Math.round((w[i].z + w[j].z) / 2) };
  const out = [...w];
  if ((i === 0 && j === w.length - 1) || (j === 0 && i === w.length - 1)) out.push(m);
  else out.splice(Math.max(i, j), 0, m);
  return out;
}

/** Koniec ściany k, który można usunąć (scala ścianę z następną); null = nie da się (narożnik zabudowy, trójkąt). */
export function naroznikDoUsuniecia(w: readonly Punkt[], k: number): number | null {
  if (w.length <= 3) return null;
  const [i, j] = krawedzieObrysu(w.length)[k];
  if (j !== 0 && j !== 1) return j;
  if (i !== 0 && i !== 1) return i;
  return null;
}

export function usunNaroznik(w: readonly Punkt[], idx: number): Punkt[] {
  return w.filter((_, i) => i !== idx);
}

/**
 * Usunięcie ściany k z pokoju. Najpierw sąsiednie ściany wydłużają się do przecięcia (np. ścięty narożnik
 * wraca do prostego), a gdy są równoległe albo przecięcie nie pasuje – ściana scala się z sąsiednią (usunięcie
 * narożnika). null = nie da się (ściana A, narożnik zabudowy, trójkąt).
 */
export function usunSciane(w: readonly Punkt[], k: number): Punkt[] | null {
  const n = w.length;
  if (n <= 3) return null;
  const kraw = krawedzieObrysu(n)[k];
  if (!kraw) return null;
  // a → b w kolejności obrysu.
  const [i, j] = kraw;
  const a = (i + 1) % n === j ? i : j;
  const b = (a + 1) % n;
  if (a !== 0 && b !== 0) {
    const P = w[(a - 1 + n) % n];
    const A = w[a];
    const B = w[b];
    const Q = w[(b + 1) % n];
    const d1 = { x: A.x - P.x, z: A.z - P.z };
    const d2 = { x: Q.x - B.x, z: Q.z - B.z };
    const det = d1.x * d2.z - d1.z * d2.x;
    if (Math.abs(det) > 1e-6) {
      const t = ((B.x - P.x) * d2.z - (B.z - P.z) * d2.x) / det;
      // Przecięcie za końcem poprzedniej ściany (t ≥ 1) – sąsiednie ściany się wydłużają, nie skracają.
      const X = { x: Math.round(P.x + d1.x * t), z: Math.round(P.z + d1.z * t) };
      // … i najwyżej o długość usuwanej ściany (inaczej pokój urósłby nie do poznania – wtedy scalanie).
      const L = Math.hypot(B.x - A.x, B.z - A.z);
      if (t >= 1 - 1e-6 && Math.hypot(X.x - A.x, X.z - A.z) <= L + 0.5 && Math.hypot(X.x - B.x, X.z - B.z) <= L + 0.5) {
        if (a === 1) X.z = 0;
        const out = w.map((q, idx) => (idx === a ? X : q)).filter((_, idx) => idx !== b);
        if (!sprawdzObrys(out).length) return out;
      }
    }
  }
  const idx = naroznikDoUsuniecia(w, k);
  return idx === null ? null : usunNaroznik(w, idx);
}

/** Przesunięcie narożnika (v0 stoi, v1 tylko wzdłuż osi x); krok siatki i przyciąganie do pionu / poziomu sąsiadów. */
export function przesunNaroznik(w: readonly Punkt[], idx: number, p: Punkt, k = 5): Punkt[] {
  if (idx === 0) return [...w];
  const n = w.length;
  let x = Math.max(0, krok(p.x, k));
  let z = Math.max(0, krok(p.z, k));
  if (idx === 1) z = 0;
  const sasiedzi = [w[(idx - 1 + n) % n], w[(idx + 1) % n]];
  for (const s of sasiedzi) {
    if (Math.abs(p.x - s.x) < 8) x = s.x;
    if (idx !== 1 && Math.abs(p.z - s.z) < 8) z = s.z;
  }
  if (idx === 1) x = Math.max(MIN_SCIANA, x);
  return w.map((q, i) => (i === idx ? { x, z } : q));
}

/** Nowa długość ściany k: przesuwa koniec ściany wzdłuż niej (albo początek, gdy koniec to narożnik zabudowy). */
export function zmienDlugosc(w: readonly Punkt[], k: number, L: number): Punkt[] | null {
  const [i, j] = krawedzieObrysu(w.length)[k];
  const P = w[i];
  const Q = w[j];
  const d = Math.hypot(Q.x - P.x, Q.z - P.z) || 1;
  const ux = (Q.x - P.x) / d;
  const uz = (Q.z - P.z) / d;
  const out = [...w];
  if (k === 0) out[1] = { x: Math.round(L), z: 0 };
  else if (j !== 0 && j !== 1) out[j] = { x: Math.round((P.x + ux * L) * 10) / 10, z: Math.round((P.z + uz * L) * 10) / 10 };
  else if (i !== 0 && i !== 1) out[i] = { x: Math.round((Q.x - ux * L) * 10) / 10, z: Math.round((Q.z - uz * L) * 10) / 10 };
  else return null;
  return out;
}

export type GotowyKsztalt = "prostokat" | "L" | "sciety" | "wneka" | "T";

export const GOTOWE_KSZTALTY: { id: GotowyKsztalt; nazwa: string }[] = [
  { id: "prostokat", nazwa: "Prostokąt" },
  { id: "L", nazwa: "Litera L" },
  { id: "sciety", nazwa: "Ścięty narożnik" },
  { id: "wneka", nazwa: "Z wnęką" },
  { id: "T", nazwa: "Litera T" },
];

/** Gotowy kształt w prostokącie W × D (cm). */
export function gotowyKsztalt(k: GotowyKsztalt, W: number, D: number): Punkt[] {
  const r = (v: number) => krok(v, 5);
  switch (k) {
    case "prostokat":
      return [
        { x: 0, z: 0 },
        { x: W, z: 0 },
        { x: W, z: D },
        { x: 0, z: D },
      ];
    case "L":
      return [
        { x: 0, z: 0 },
        { x: W, z: 0 },
        { x: W, z: r(D * 0.55) },
        { x: r(W * 0.55), z: r(D * 0.55) },
        { x: r(W * 0.55), z: D },
        { x: 0, z: D },
      ];
    case "sciety": {
      const c = r(Math.min(W, D) * 0.3);
      return [
        { x: 0, z: 0 },
        { x: W, z: 0 },
        { x: W, z: D - c },
        { x: W - c, z: D },
        { x: 0, z: D },
      ];
    }
    case "wneka":
      return [
        { x: 0, z: 0 },
        { x: W, z: 0 },
        { x: W, z: D },
        { x: r(W * 0.65), z: D },
        { x: r(W * 0.65), z: D + 80 },
        { x: r(W * 0.35), z: D + 80 },
        { x: r(W * 0.35), z: D },
        { x: 0, z: D },
      ];
    case "T":
      return [
        { x: 0, z: 0 },
        { x: W, z: 0 },
        { x: W, z: r(D * 0.5) },
        { x: r(W * 0.7), z: r(D * 0.5) },
        { x: r(W * 0.7), z: D },
        { x: r(W * 0.3), z: D },
        { x: r(W * 0.3), z: r(D * 0.5) },
        { x: 0, z: r(D * 0.5) },
      ];
  }
}

/**
 * Przesunięcie ściany k prostopadle o d [cm] (dodatnie = do środka pokoju): oba jej narożniki jadą razem,
 * sąsiednie ściany się wydłużają albo skracają. Ściana przy narożniku zabudowy (A, B) nie rusza narożnika (0, 0) –
 * zamiast niej przesuwa się reszta pokoju (efekt ten sam: pokój rośnie albo maleje). null = nie da się.
 */
export function przesunScianeObrysu(w: readonly Punkt[], k: number, d: number): Punkt[] | null {
  const kraw = krawedzieObrysu(w.length)[k];
  if (!kraw || !d) return kraw ? [...w] : null;
  const [i, j] = kraw;
  const s = scianyObrysu(w)[k];
  const dx = s.nx * d;
  const dz = s.nz * d;
  const r = (v: number) => Math.round(v * 10) / 10;
  if (i !== 0 && j !== 0) {
    // v1 leży na osi x – może jechać tylko wzdłuż x.
    if ((i === 1 || j === 1) && Math.abs(dz) > 0.01) return null;
    return w.map((p, idx) => (idx === i || idx === j ? { x: r(p.x + dx), z: r(p.z + dz) } : p));
  }
  // Ściana z narożnikiem zabudowy: przesuwamy wszystkie pozostałe narożniki w przeciwną stronę.
  // v1 (koniec ściany A) też musi zostać na osi x.
  if (i !== 1 && j !== 1 && Math.abs(dz) > 0.01) return null;
  return w.map((p, idx) => (idx === i || idx === j ? p : { x: r(p.x - dx), z: r(p.z - dz) }));
}

/* ---------- edycja ścian pokoju z rzutu i karty ściany (jak ścianki działowe) ---------- */

/** Zmiana geometrii pokoju: nowy obrys albo wymiary prostokąta / długości ścian A i B. */
export type ZmianaPokoju = { obrys: Punkt[] } | { scianaA?: number; scianaB?: number; pomieszczenie?: { szer: number; dlug: number } };

const ogr = (v: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(v)));

/** Plan po zmianie – bez sprawdzania (podgląd na rzucie w trakcie przeciągania). */
export function podgladZmianyPokoju(p: PlanKuchni, z: ZmianaPokoju): PlanKuchni {
  if ("obrys" in z) return { ...p, sciany: { ...p.sciany, obrys: z.obrys } };
  return {
    ...p,
    ...(z.scianaA !== undefined ? { scianaA: ogr(z.scianaA, 80, 1200) } : {}),
    ...(z.scianaB !== undefined ? { scianaB: ogr(z.scianaB, 80, 1200) } : {}),
    ...(z.pomieszczenie ? { pomieszczenie: { szer: ogr(z.pomieszczenie.szer, 120, 2000), dlug: ogr(z.pomieszczenie.dlug, 120, 2000) } } : {}),
  };
}

/** Zmiana geometrii pokoju ze sprawdzeniem (okna, drzwi i gniazdka muszą się zmieścić na swoich ścianach). */
export function zastosujZmianePokoju(p: PlanKuchni, z: ZmianaPokoju): Wynik {
  if ("obrys" in z) {
    const baza = czyObrys(p) ? { plan: p } : naObrys(p);
    if ("blad" in baza) return baza;
    return zastosujObrys(baza.plan, z.obrys, false);
  }
  const nowy = podgladZmianyPokoju(p, z);
  if (nowy.pomieszczenie) {
    // Zabudowa nie dłuższa niż pokój.
    nowy.scianaA = Math.min(nowy.scianaA, nowy.pomieszczenie.szer);
    if (nowy.uklad === "L") nowy.scianaB = Math.min(nowy.scianaB, nowy.pomieszczenie.dlug);
  }
  const blad = sprawdzZawartosc(nowy, scianyPokojuWszystkie(nowy));
  return blad ? { blad } : { plan: nowy };
}

/** Nowa długość ściany pokoju (karta ściany): obrys, prostokąt albo same ściany A / B. */
export function zmianaDlugosci(p: PlanKuchni, id: ScianaPokoju, L: number): ZmianaPokoju | null {
  if (czyObrys(p)) {
    const w = p.sciany!.obrys!;
    const k = scianyObrysu(w).findIndex((s) => s.id === id);
    const n = k >= 0 ? zmienDlugosc(w, k, L) : null;
    return n ? { obrys: n } : null;
  }
  if (p.pomieszczenie) {
    const { szer, dlug } = p.pomieszczenie;
    return id === "A" || id === "C" ? { pomieszczenie: { szer: L, dlug } } : { pomieszczenie: { szer, dlug: L } };
  }
  return id === "A" ? { scianaA: L } : id === "B" ? { scianaB: L } : null;
}

/** Obrót ściany pokoju o kąt [°] wokół jej narożnika przy ścianie A/B (A i B nie obracają się – na nich stoi zabudowa). */
export function obrotSciany(p: PlanKuchni, id: ScianaPokoju, stopnie: number): ZmianaPokoju | null {
  if (id === "A" || id === "B") return null;
  const w = czyObrys(p) ? p.sciany!.obrys! : p.pomieszczenie ? obrysZProstokata(p) : null;
  if (!w) return null;
  const k = scianyObrysu(w).findIndex((s) => s.id === id);
  if (k < 0) return null;
  const [i, j] = krawedzieObrysu(w.length)[k];
  const ruchomy = j > 1 ? j : i > 1 ? i : null;
  if (ruchomy === null) return null;
  const os = w[ruchomy === j ? i : j];
  const q = w[ruchomy];
  const r = (stopnie * Math.PI) / 180;
  const dx = q.x - os.x;
  const dz = q.z - os.z;
  const nowy = { x: Math.round(os.x + dx * Math.cos(r) - dz * Math.sin(r)), z: Math.round(os.z + dx * Math.sin(r) + dz * Math.cos(r)) };
  return { obrys: w.map((pt, idx) => (idx === ruchomy ? nowy : pt)) };
}

/**
 * Uchwyty ściany pokoju na rzucie: przesunięcie całej ściany (prostopadle) i narożniki na jej końcach.
 * Każdy uchwyt zamienia punkt kursora (cm) na zmianę pokoju. Ściana A i B nie przesuwają się (narożnik zabudowy).
 */
export type UchwytPokoju = { rodzaj: "naroznik" | "sciana"; p: Punkt; ruch: (q: Punkt, krok: number) => ZmianaPokoju };

export function uchwytyScianyPokoju(p: PlanKuchni, id: ScianaPokoju): UchwytPokoju[] {
  const kr = (v: number, k: number) => Math.round(v / k) * k;
  if (czyObrys(p)) {
    const w = p.sciany!.obrys!;
    const sc = scianyObrysu(w);
    const k = sc.findIndex((s) => s.id === id);
    if (k < 0) return [];
    const [i, j] = krawedzieObrysu(w.length)[k];
    const out: UchwytPokoju[] = [];
    for (const idx of [i, j]) if (idx !== 0) out.push({ rodzaj: "naroznik", p: w[idx], ruch: (q, krok) => ({ obrys: przesunNaroznik(w, idx, q, krok) }) });
    const s = sc[k];
    if (przesunScianeObrysu(w, k, 5)) {
      const m = { x: s.x + (s.dx * s.dlugosc) / 2, z: s.z + (s.dz * s.dlugosc) / 2 };
      out.push({
        rodzaj: "sciana",
        p: m,
        ruch: (q, krok) => ({ obrys: przesunScianeObrysu(w, k, kr((q.x - m.x) * s.nx + (q.z - m.z) * s.nz, krok)) ?? [...w] }),
      });
    }
    return out;
  }
  const pom = p.pomieszczenie;
  if (pom) {
    const LA = Math.max(p.scianaA, pom.szer);
    const LB = Math.max(p.uklad === "L" ? p.scianaB : 0, pom.dlug);
    const rog = { x: LA, z: LB };
    const naroznik: UchwytPokoju = { rodzaj: "naroznik", p: rog, ruch: (q, krok) => ({ pomieszczenie: { szer: kr(q.x, krok), dlug: kr(q.z, krok) } }) };
    // A i B: przesunięcie ściany na zewnątrz powiększa pokój (przeciwległa ściana zostaje, zabudowa przy A / B też).
    if (id === "A")
      return [
        { rodzaj: "naroznik", p: { x: LA, z: 0 }, ruch: (q, krok) => ({ pomieszczenie: { szer: kr(q.x, krok), dlug: pom.dlug } }) },
        { rodzaj: "sciana", p: { x: LA / 2, z: 0 }, ruch: (q, krok) => ({ pomieszczenie: { szer: pom.szer, dlug: kr(pom.dlug - q.z, krok) } }) },
      ];
    if (id === "B")
      return [
        { rodzaj: "naroznik", p: { x: 0, z: LB }, ruch: (q, krok) => ({ pomieszczenie: { szer: pom.szer, dlug: kr(q.z, krok) } }) },
        { rodzaj: "sciana", p: { x: 0, z: LB / 2 }, ruch: (q, krok) => ({ pomieszczenie: { szer: kr(pom.szer - q.x, krok), dlug: pom.dlug } }) },
      ];
    if (id === "C") return [naroznik, { rodzaj: "sciana", p: { x: LA / 2, z: LB }, ruch: (q, krok) => ({ pomieszczenie: { szer: pom.szer, dlug: kr(q.z, krok) } }) }];
    if (id === "D") return [naroznik, { rodzaj: "sciana", p: { x: LA, z: LB / 2 }, ruch: (q, krok) => ({ pomieszczenie: { szer: kr(q.x, krok), dlug: pom.dlug } }) }];
    return [];
  }
  if (id === "A") return [{ rodzaj: "naroznik", p: { x: p.scianaA, z: 0 }, ruch: (q, krok) => ({ scianaA: kr(q.x, krok) }) }];
  if (id === "B" && p.uklad === "L") return [{ rodzaj: "naroznik", p: { x: 0, z: p.scianaB }, ruch: (q, krok) => ({ scianaB: kr(q.z, krok) }) }];
  return [];
}
