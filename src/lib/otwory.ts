/*
 * Okna i drzwi na ścianach pokoju: przesuwanie (rzut, 3D, pola w kroku „Okna i instalacje”) z zabezpieczeniami.
 * Otwór musi się zmieścić na ścianie, nie może nachodzić na inny otwór, a mebel nie może stać w drzwiach
 * ani zasłaniać okna (słupek, szafka górna na wysokości okna, szafka wyższa niż parapet).
 */
import { rect, rodzajElementu, type ElementKuchni, type PlanKuchni } from "./kuchnia";
import { scianaPoId, scianyPokoju, wysokoscOtworu, wysokoscPokoju, type Sciana, type ScianaPokoju } from "./sciany";
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
  if (e.strefa === "gorna") return { y0: DOL_GORNYCH, y1: DOL_GORNYCH + e.h };
  if (e.strefa === "polka") return { y0: DOL_GORNYCH, y1: DOL_GORNYCH + 72 };
  if (e.strefa === "blat") return r === "bateria" ? { y0: 90, y1: 90 + e.h } : null;
  return { y0: 0, y1: e.h + (e.strefa === "dolna" ? 3 : 0) };
}

/** Odcinek wzdłuż ściany [cm od jej początku], który zajmuje mebel stojący przy tej ścianie; null = nie stoi przy niej. */
export function meblaPrzyScianie(e: ElementKuchni, s: Sciana): { a: number; b: number } | null {
  const r = rect(e);
  const przy =
    s.id === "A" ? r.z0 < PRZY_SCIANIE : s.id === "B" ? r.x0 < PRZY_SCIANIE : s.id === "C" ? r.z1 > s.z - PRZY_SCIANIE : r.x1 > s.x - PRZY_SCIANIE;
  if (!przy) return null;
  return s.dx ? { a: r.x0, b: r.x1 } : { a: r.z0, b: r.z1 };
}

/** Błędy otworu po zmianie (pusta lista = można). i – indeks w plan.wywiad.otwory (dla nowego: -1). */
export function sprawdzOtwor(plan: PlanKuchni, i: number, o: Otwor): string[] {
  const bledy: string[] = [];
  const s = scianaPoId(plan, o.sciana as ScianaPokoju);
  const nazwa = nazwaOtworu(o);
  if (!s) return [`Ściany ${o.sciana} nie ma – ${o.sciana === "C" || o.sciana === "D" ? "podaj wymiary pokoju w kroku „Pomiar”" : "ustaw układ L"}.`];
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

/** Mebel, który po przesunięciu stanąłby w drzwiach albo zasłonił okno – komunikat (null = w porządku). */
export function meblaWOtworze(plan: PlanKuchni, e: ElementKuchni): string | null {
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
