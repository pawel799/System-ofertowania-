/*
 * Okna i drzwi na ścianach pokoju: przesuwanie (rzut, 3D, pola w kroku „Okna i instalacje”) z zabezpieczeniami.
 * Otwór musi się zmieścić na ścianie, nie może nachodzić na inny otwór, a mebel nie może stać w drzwiach
 * ani zasłaniać okna (słupek, szafka górna na wysokości okna, szafka wyższa niż parapet).
 */
import { odPodlogiElementu } from "./bibliotekaModeli";
import { rect, rodzajElementu, WYPOSAZENIE, type ElementKuchni, type PlanKuchni } from "./kuchnia";
import { LIMITY_SCIANY, scianaNachodzi, scianaPoId, scianyPokoju, wysokoscOtworu, wysokoscPokoju, wysokoscSciany, type ScianaDodatkowa, type Sciana, type ScianaPokoju } from "./sciany";
import type { Otwor } from "./wywiad";

/** Dół szafek górnych [cm] – jak Y_GORNA w scenie 3D (components/kuchnia/uklad3d.ts). */
const DOL_GORNYCH = 145;
/** Mebel bliżej ściany niż tyle [cm] „stoi przy niej”. */
const PRZY_SCIANIE = 8;
/** Najmniejszy odstęp między otworami [cm] (ościeże). */
const ODSTEP = 10;

const nazwaOtworu = (o: Otwor) => (o.rodzaj === "okno" ? "Okno" : "Drzwi");

/** Pionowy zasięg mebla [cm od podłogi] – w przybliżeniu jak w 3D. */
export function wysokoscMebla(e: ElementKuchni): { y0: number; y1: number } | null {
  const r = rodzajElementu(e);
  // Dywan i zasłony nie zasłaniają okien ani drzwi; wyposażenie stojące na meblu – jak inne rzeczy na blacie.
  if (r === "dekoracja") return null;
  const odPodlogi = odPodlogiElementu(e);
  if (odPodlogi !== null) return { y0: odPodlogi, y1: odPodlogi + e.h };
  if (WYPOSAZENIE.has(r) && e.strefa !== "gorna" && e.strefa !== "polka") return e.strefa === "blat" ? null : { y0: 0, y1: e.h };
  if (e.strefa === "gorna") return { y0: DOL_GORNYCH, y1: DOL_GORNYCH + e.h };
  if (e.strefa === "polka") return { y0: DOL_GORNYCH, y1: DOL_GORNYCH + 72 };
  if (e.strefa === "blat") return r === "bateria" ? { y0: 90, y1: 90 + e.h } : null;
  return { y0: 0, y1: e.h + (e.strefa === "dolna" ? 3 : 0) };
}

/**
 * Odcinek wzdłuż ściany [cm od jej początku], który zajmuje mebel stojący przy tej ścianie; null = nie stoi przy niej.
 * glebia – najdalszy punkt mebla od ściany (do linii wymiarów przed frontem). Działa dla ścian pod dowolnym kątem.
 */
export function meblaPrzyScianie(e: ElementKuchni, s: Sciana): { a: number; b: number; glebia: number } | null {
  const r = rect(e);
  const rogi = [
    [r.x0, r.z0],
    [r.x1, r.z0],
    [r.x1, r.z1],
    [r.x0, r.z1],
  ];
  const t = rogi.map(([x, z]) => (x - s.x) * s.dx + (z - s.z) * s.dz);
  const d = rogi.map(([x, z]) => (x - s.x) * s.nx + (z - s.z) * s.nz);
  if (Math.min(...d) >= PRZY_SCIANIE || Math.max(...d) <= -PRZY_SCIANIE) return null;
  const a = Math.min(...t);
  const b = Math.max(...t);
  if (b <= 0.5 || a >= s.dlugosc - 0.5) return null;
  return { a, b, glebia: Math.max(...d) };
}

/** Błędy otworu po zmianie (pusta lista = można). i – indeks w plan.wywiad.otwory (dla nowego: -1). */
export function sprawdzOtwor(plan: PlanKuchni, i: number, o: Otwor): string[] {
  const bledy: string[] = [];
  const s = scianaPoId(plan, o.sciana as ScianaPokoju);
  const nazwa = nazwaOtworu(o);
  if (!s) return [`Ściany ${o.sciana} nie ma – ${o.sciana === "B" ? "ustaw układ L albo wymiary pokoju" : "podaj wymiary pokoju w kroku „Pomiar” albo sprawdź kreator ścian"}.`];
  if (o.od < 0 || o.od + o.szer > s.dlugosc) bledy.push(`${nazwa} wychodzi poza ścianę ${s.id} (${s.dlugosc} cm).`);
  const H = wysokoscPokoju(plan);
  const { y0, y1 } = wysokoscOtworu(o, H);
  if (o.rodzaj === "okno" && y1 > H - 5) bledy.push(`Okno sięga sufitu – obniż parapet.`);
  (plan.wywiad?.otwory ?? []).forEach((inny, j) => {
    if (j === i || inny.sciana !== o.sciana) return;
    if (o.od < inny.od + inny.szer + ODSTEP && inny.od < o.od + o.szer + ODSTEP) bledy.push(`${nazwa} nachodzi na ${nazwaOtworu(inny).toLowerCase()} ${j + 1} – między otworami min. ${ODSTEP} cm.`);
  });
  for (const e of plan.elementy) {
    const odc = meblaPrzyScianie(e, s);
    if (!odc || odc.b <= o.od + 0.5 || odc.a >= o.od + o.szer - 0.5) continue;
    const pion = wysokoscMebla(e);
    if (!pion) continue;
    if (o.rodzaj === "drzwi") {
      if (pion.y0 < y1) bledy.push(`W drzwiach stoi „${e.nazwa}”.`);
    } else if (pion.y0 < y1 - 2 && pion.y1 > y0 + 2) {
      bledy.push(`„${e.nazwa}” zasłania okno${e.strefa === "dolna" ? " – szafka jest wyższa niż parapet" : ""}.`);
    }
  }
  return Array.from(new Set(bledy));
}

/** Dodatkowa ściana, na którą wchodzi mebel (niższa ściana nie przeszkadza szafkom wiszącym nad nią). */
export function scianaPodMeblem(plan: PlanKuchni, e: ElementKuchni): { s: ScianaDodatkowa; nr: number } | null {
  const lista = plan.sciany?.dodatkowe ?? [];
  if (!lista.length) return null;
  const pion = wysokoscMebla(e);
  const r = rect(e);
  for (let i = 0; i < lista.length; i++) {
    const s = lista[i];
    if (pion && pion.y0 >= wysokoscSciany(s, plan)) continue;
    if (scianaNachodzi(s, r)) return { s, nr: i + 1 };
  }
  return null;
}

/** Błędy dodatkowej ściany (pusta lista = można): nie może wchodzić na meble ani uciec daleko poza pokój. */
export function sprawdzScianeDodatkowa(plan: PlanKuchni, s: ScianaDodatkowa): string[] {
  const bledy: string[] = [];
  const [min, max] = LIMITY_SCIANY.poz;
  if (s.x < min || s.x > max || s.z < min || s.z > max) bledy.push("Ściana jest za daleko od pokoju.");
  const H = wysokoscSciany(s, plan);
  for (const e of plan.elementy) {
    const pion = wysokoscMebla(e);
    if (pion && pion.y0 >= H) continue;
    if (scianaNachodzi(s, rect(e))) bledy.push(`Ściana wchodzi na „${e.nazwa}”.`);
  }
  return Array.from(new Set(bledy)).slice(0, 3);
}

/** Mebel, który po przesunięciu stanąłby w drzwiach, zasłonił okno albo wszedł w ścianę – komunikat (null = w porządku). */
export function meblaWOtworze(plan: PlanKuchni, e: ElementKuchni): string | null {
  const sc = scianaPodMeblem(plan, e);
  if (sc) return `„${e.nazwa}” wchodzi na ścianę ${sc.nr}.`;
  for (const s of scianyPokoju(plan)) {
    const odc = meblaPrzyScianie(e, s);
    if (!odc) continue;
    const pion = wysokoscMebla(e);
    if (!pion) continue;
    for (const o of plan.wywiad?.otwory ?? []) {
      if (o.sciana !== s.id || odc.b <= o.od + 0.5 || odc.a >= o.od + o.szer - 0.5) continue;
      const { y0, y1 } = wysokoscOtworu(o, wysokoscPokoju(plan));
      if (o.rodzaj === "drzwi" && pion.y0 < y1) return `„${e.nazwa}” stoi w drzwiach na ścianie ${s.id}.`;
      if (o.rodzaj === "okno" && pion.y0 < y1 - 2 && pion.y1 > y0 + 2) return `„${e.nazwa}” zasłania okno na ścianie ${s.id}.`;
    }
  }
  return null;
}

/**
 * Najbliższa ściana dla punktu w rzucie (cm) i położenie otworu na niej (środek pod kursorem, w granicach ściany).
 * krok – zaokrąglenie położenia (5 cm, z Shift 1 cm).
 */
export function otworWPunkcie(plan: PlanKuchni, o: Otwor, x: number, z: number, krok = 5): Otwor {
  let najlepsza: { s: Sciana; t: number; d: number } | null = null;
  for (const s of scianyPokoju(plan)) {
    const t = (x - s.x) * s.dx + (z - s.z) * s.dz;
    const d = Math.abs((x - s.x) * s.nx + (z - s.z) * s.nz);
    const poza = t < -30 ? -30 - t : t > s.dlugosc + 30 ? t - s.dlugosc - 30 : 0;
    const kara = d + poza * 2;
    if (!najlepsza || kara < najlepsza.d) najlepsza = { s, t, d: kara };
  }
  if (!najlepsza) return o;
  const { s, t } = najlepsza;
  const od = Math.min(Math.max(0, Math.round((t - o.szer / 2) / krok) * krok), Math.max(0, s.dlugosc - o.szer));
  return { ...o, sciana: s.id as Otwor["sciana"], od };
}

/** Pierwsze wolne miejsce dla nowego otworu: najpierw na podanej ścianie, potem na pozostałych (krok 10 cm). */
export function wolneMiejsceOtworu(plan: PlanKuchni, o: Otwor): Otwor {
  const sciany = scianyPokoju(plan);
  const kolejnosc = [...sciany.filter((s) => s.id === o.sciana), ...sciany.filter((s) => s.id !== o.sciana)];
  for (const s of kolejnosc) {
    const start = s.id === o.sciana ? o.od : 0;
    for (let k = 0; k <= s.dlugosc; k += 10) {
      const od = (start + k) % Math.max(1, s.dlugosc - o.szer + 1);
      const kand = { ...o, sciana: s.id as Otwor["sciana"], od: Math.round(od) };
      if (kand.od + kand.szer <= s.dlugosc && !sprawdzOtwor(plan, -1, kand).length) return kand;
    }
  }
  return o;
}
