/*
 * Kreator kuchni: rzut (ciąg albo L) i lista elementów.
 * Ceny tu nie ma — liczy je serwer z cennika firmy (functions/_lib/kuchnia.ts),
 * tym samym wzorem co szafki parametryczne (src/lib/modul.ts).
 *
 * Układ współrzędnych rzutu, centymetry, środek elementu:
 *   x wzdłuż ściany A (od narożnika w prawo),
 *   z wzdłuż ściany B (od narożnika w głąb pomieszczenia),
 *   obrót 0: front w +z, plecy przy ścianie A (z = 0),
 *   obrót 90: front w +x, plecy przy ścianie B (x = 0).
 */
import { MAX_MODULY, MODUL_LIMITS, sumaModulow, type ModulCennik, type ModulItem } from "./modul";

export type UkladKuchni = "ciag" | "L";
export type Strefa = "dolna" | "gorna" | "wysoka";
export type ZrodloElementu = "modul" | "model";
export type Obrot = 0 | 90 | 180 | 270;
export type Sciana = "A" | "B";

export type ElementKuchni = {
  id: string;
  nazwa: string;
  zrodlo: ZrodloElementu;
  /** Id modelu z R2, gdy zrodlo = "model". */
  modelId?: string;
  strefa: Strefa;
  /** szerokość, wysokość, głębokość [cm] */
  w: number;
  h: number;
  d: number;
  x: number;
  z: number;
  rot: Obrot;
};

export type PlanKuchni = {
  uklad: UkladKuchni;
  /** Długość ściany A [cm]. */
  scianaA: number;
  /** Długość ściany B [cm] (układ L). */
  scianaB: number;
  /** Opcjonalny obrys pomieszczenia [cm]. Nie przycina szafek. */
  pomieszczenie: { szer: number; dlug: number } | null;
  elementy: ElementKuchni[];
};

export const UKLAD_KUCHNI_LABEL: Record<UkladKuchni, string> = {
  ciag: "Ciąg prosty",
  L: "Kształt L",
};

export const STREFA_LABEL: Record<Strefa, string> = {
  dolna: "Dolna",
  gorna: "Górna",
  wysoka: "Słupek",
};

export type PresetModul = {
  id: string;
  nazwa: string;
  strefa: Strefa;
  w: number;
  h: number;
  d: number;
};

/** Szafki oparte o moduł parametryczny — gdy firma nie ma własnych GLB. */
export const PRESETY: PresetModul[] = [
  { id: "dolna-40", nazwa: "Szafka dolna 40", strefa: "dolna", w: 40, h: 72, d: 56 },
  { id: "dolna-60", nazwa: "Szafka dolna 60", strefa: "dolna", w: 60, h: 72, d: 56 },
  { id: "dolna-80", nazwa: "Szafka dolna 80", strefa: "dolna", w: 80, h: 72, d: 56 },
  { id: "zlew-80", nazwa: "Szafka pod zlew 80", strefa: "dolna", w: 80, h: 72, d: 56 },
  { id: "szuflady-45", nazwa: "Szuflady 45", strefa: "dolna", w: 45, h: 72, d: 56 },
  { id: "narozna-90", nazwa: "Szafka narożna 90", strefa: "dolna", w: 90, h: 72, d: 56 },
  { id: "gorna-40", nazwa: "Szafka górna 40", strefa: "gorna", w: 40, h: 72, d: 32 },
  { id: "gorna-60", nazwa: "Szafka górna 60", strefa: "gorna", w: 60, h: 72, d: 32 },
  { id: "gorna-80", nazwa: "Szafka górna 80", strefa: "gorna", w: 80, h: 72, d: 32 },
  { id: "okap-60", nazwa: "Szafka nad okap 60", strefa: "gorna", w: 60, h: 36, d: 32 },
  { id: "slupek-60", nazwa: "Słupek 60", strefa: "wysoka", w: 60, h: 210, d: 56 },
  { id: "piekarnik-60", nazwa: "Słupek piekarnik 60", strefa: "wysoka", w: 60, h: 210, d: 56 },
];

const SCIANA = { min: 80, max: 1200 };
const POMIESZCZENIE = { min: 120, max: 2000 };
const POLOZENIE = { min: -200, max: 3000 };
const OBROTY: readonly Obrot[] = [0, 90, 180, 270];
const STREFY: readonly Strefa[] = ["dolna", "gorna", "wysoka"];
const ZRODLA: readonly ZrodloElementu[] = ["modul", "model"];
const MODEL_ID_RE = /^[A-Za-z0-9]{10,32}$/;
const ID_RE = /^[A-Za-z0-9]{4,16}$/;

export type Rect = { x0: number; z0: number; x1: number; z1: number };

/** Obrys w rzucie. Sąsiednie szafki stykające się krawędzią nie nachodzą. */
export function rect(e: { x: number; z: number; w: number; d: number; rot: number }): Rect {
  const wzdluzX = e.rot % 180 === 0 ? e.w : e.d;
  const wzdluzZ = e.rot % 180 === 0 ? e.d : e.w;
  return { x0: e.x - wzdluzX / 2, z0: e.z - wzdluzZ / 2, x1: e.x + wzdluzX / 2, z1: e.z + wzdluzZ / 2 };
}

export function nachodzi(a: Rect, b: Rect) {
  return a.x0 < b.x1 - 0.01 && b.x0 < a.x1 - 0.01 && a.z0 < b.z1 - 0.01 && b.z0 < a.z1 - 0.01;
}

/** Słupek zajmuje całą wysokość. Górna może stać nad dolną. */
export function konfliktStref(a: Strefa, b: Strefa) {
  if (a === "wysoka" || b === "wysoka") return true;
  return a === b;
}

export function opiszKolizje(plan: PlanKuchni): string | null {
  const list = plan.elementy;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (!konfliktStref(a.strefa, b.strefa)) continue;
      if (nachodzi(rect(a), rect(b))) return `„${a.nazwa}” nachodzi na „${b.nazwa}”. Rozsuń je w rzucie.`;
    }
  }
  return null;
}

export function nastepnaPozycja(plan: PlanKuchni, w: number, d: number, strefa: Strefa, sciana: Sciana) {
  const rot: Obrot = sciana === "B" ? 90 : 0;
  let pos = 0;
  for (let i = 0; i < 80; i++) {
    const kand =
      sciana === "A"
        ? { x: Math.round(pos + w / 2), z: Math.round(d / 2), w, d, rot, strefa }
        : { x: Math.round(d / 2), z: Math.round(pos + w / 2), w, d, rot, strefa };
    const r = rect(kand);
    const blok = plan.elementy.filter((e) => konfliktStref(e.strefa, strefa) && nachodzi(r, rect(e)));
    if (!blok.length) return { x: kand.x, z: kand.z, rot };
    const koniec = Math.max(...blok.map((e) => (sciana === "A" ? rect(e).x1 : rect(e).z1)));
    const dalej = Math.round(koniec);
    pos = dalej <= pos ? pos + 5 : dalej;
  }
  const fallback = 40 + plan.elementy.length * (w + 2);
  return sciana === "A"
    ? { x: Math.round(fallback + w / 2), z: Math.round(d / 2), rot }
    : { x: Math.round(d / 2), z: Math.round(fallback + w / 2), rot };
}

export type NowyElement = {
  nazwa: string;
  strefa: Strefa;
  w: number;
  h: number;
  d: number;
  zrodlo: ZrodloElementu;
  modelId?: string;
};

const ALFABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export function nowyElementId(zajete?: ReadonlySet<string>) {
  const buf = new Uint8Array(8);
  let id = "";
  do {
    crypto.getRandomValues(buf);
    id = Array.from(buf, (b) => ALFABET[b % ALFABET.length]).join("");
  } while (zajete?.has(id));
  return id;
}

export function pustyPlan(uklad: UkladKuchni = "ciag"): PlanKuchni {
  return { uklad, scianaA: 360, scianaB: 280, pomieszczenie: null, elementy: [] };
}

export function dodajElement(plan: PlanKuchni, bazowy: NowyElement, sciana: Sciana): PlanKuchni {
  if (plan.elementy.length >= MAX_MODULY) return plan;
  const gdzie: Sciana = plan.uklad === "L" ? sciana : "A";
  const pos = nastepnaPozycja(plan, bazowy.w, bazowy.d, bazowy.strefa, gdzie);
  const el: ElementKuchni = {
    id: nowyElementId(new Set(plan.elementy.map((e) => e.id))),
    nazwa: bazowy.nazwa.replace(/\s+/g, " ").trim().slice(0, 80) || "Szafka",
    zrodlo: bazowy.zrodlo,
    ...(bazowy.zrodlo === "model" && bazowy.modelId ? { modelId: bazowy.modelId } : {}),
    strefa: bazowy.strefa,
    w: bazowy.w,
    h: bazowy.h,
    d: bazowy.d,
    ...pos,
  };
  const r = rect(el);
  const scianaA = r.x1 > plan.scianaA ? Math.min(SCIANA.max, Math.ceil(r.x1 / 10) * 10) : plan.scianaA;
  const scianaB = r.z1 > plan.scianaB ? Math.min(SCIANA.max, Math.ceil(r.z1 / 10) * 10) : plan.scianaB;
  return { ...plan, scianaA, scianaB, elementy: [...plan.elementy, el] };
}

const presetPoId = (id: string): NowyElement => {
  const p = PRESETY.find((x) => x.id === id);
  if (!p) throw new Error(id);
  return { nazwa: p.nazwa, strefa: p.strefa, w: p.w, h: p.h, d: p.d, zrodlo: "modul" };
};

/** Gotowy układ do pierwszej przymiarki — same szafki parametryczne. */
export function wstawPrzyklad(uklad: UkladKuchni): PlanKuchni {
  const kolejnosc: [string, Sciana][] =
    uklad === "L"
      ? [
          ["dolna-60", "A"],
          ["dolna-60", "A"],
          ["zlew-80", "A"],
          ["dolna-40", "B"],
          ["dolna-60", "B"],
          ["gorna-60", "A"],
          ["gorna-60", "A"],
          ["gorna-80", "A"],
          ["gorna-40", "B"],
          ["gorna-60", "B"],
        ]
      : [
          ["dolna-60", "A"],
          ["zlew-80", "A"],
          ["dolna-60", "A"],
          ["slupek-60", "A"],
          ["gorna-60", "A"],
          ["gorna-60", "A"],
          ["gorna-80", "A"],
        ];
  return kolejnosc.reduce((plan, [id, sciana]) => dodajElement(plan, presetPoId(id), sciana), pustyPlan(uklad));
}

/** Pozycje do cennika: klient nie przysyła ceny, tylko wymiary. */
export function pozycjeKuchni(plan: PlanKuchni): ModulItem[] {
  return plan.elementy.map((e) => ({ nazwa: e.nazwa, w: e.w, h: e.h, d: e.d }));
}

/** Suma netto szafek. Przy niepustej kuchni minimum 1 zł (pole base oferty musi być > 0). */
export function bazaKuchni(plan: PlanKuchni, cennik: ModulCennik) {
  if (!plan.elementy.length) return 0;
  return Math.max(1, sumaModulow(pozycjeKuchni(plan), cennik));
}

export function wystajePozaSciany(plan: PlanKuchni) {
  return plan.elementy.some((e) => {
    const r = rect(e);
    if (r.x0 < -1 || r.x1 > plan.scianaA + 1) return true;
    if (plan.uklad === "L" && (r.z0 < -1 || r.z1 > plan.scianaB + 1)) return true;
    return false;
  });
}

function blad(m: string): never {
  throw new Error(m);
}

function tekst(v: unknown, pole: string, max: number) {
  if (typeof v !== "string") blad(`Pole ${pole} musi być tekstem.`);
  const s = v.replace(/\s+/g, " ").trim();
  if (!s) blad(`Pole ${pole} jest wymagane.`);
  if (s.length > max) blad(`Pole ${pole} jest za długie.`);
  return s;
}

function cm(v: unknown, pole: string, min: number, max: number) {
  if (typeof v !== "number" || !Number.isFinite(v)) blad(`Pole ${pole} musi być liczbą.`);
  const n = Math.round(v);
  if (n < min || n > max) blad(`Pole ${pole}: od ${min} do ${max} cm.`);
  return n;
}

function jedno<T extends string>(v: unknown, lista: readonly T[], pole: string): T {
  if (typeof v !== "string" || !lista.includes(v as T)) blad(`Nieznana wartość pola ${pole}.`);
  return v as T;
}

/** Walidacja planu z panelu. Rzuca Error z polskim komunikatem. Ceny nie przyjmuje. */
export function parseKuchnia(v: unknown): PlanKuchni {
  if (!v || typeof v !== "object" || Array.isArray(v)) blad("Plan kuchni ma zły format.");
  const o = v as Record<string, unknown>;
  const uklad = jedno(o.uklad, ["ciag", "L"] as const, "układ");
  const scianaA = cm(o.scianaA, "ściana A", SCIANA.min, SCIANA.max);
  const scianaB = cm(o.scianaB, "ściana B", SCIANA.min, SCIANA.max);
  let pomieszczenie: PlanKuchni["pomieszczenie"] = null;
  if (o.pomieszczenie !== undefined && o.pomieszczenie !== null) {
    if (typeof o.pomieszczenie !== "object" || Array.isArray(o.pomieszczenie)) blad("Pomieszczenie ma zły format.");
    const p = o.pomieszczenie as Record<string, unknown>;
    pomieszczenie = {
      szer: cm(p.szer, "szerokość pomieszczenia", POMIESZCZENIE.min, POMIESZCZENIE.max),
      dlug: cm(p.dlug, "długość pomieszczenia", POMIESZCZENIE.min, POMIESZCZENIE.max),
    };
  }
  if (!Array.isArray(o.elementy) || o.elementy.length > MAX_MODULY) blad(`W kuchni może być do ${MAX_MODULY} elementów.`);
  const idy = new Set<string>();
  const elementy = o.elementy.map((surowe, i) => {
    if (!surowe || typeof surowe !== "object" || Array.isArray(surowe)) blad(`Element ${i + 1} ma zły format.`);
    const e = surowe as Record<string, unknown>;
    const id = typeof e.id === "string" ? e.id : "";
    if (!ID_RE.test(id)) blad(`Element ${i + 1}: zły identyfikator.`);
    if (idy.has(id)) blad(`Element ${i + 1}: powtórzony identyfikator.`);
    idy.add(id);
    const zrodlo = jedno(e.zrodlo, ZRODLA, `element ${i + 1}`);
    let modelId: string | undefined;
    if (zrodlo === "model") {
      if (typeof e.modelId !== "string" || !MODEL_ID_RE.test(e.modelId)) blad(`Element ${i + 1}: zły model 3D.`);
      modelId = e.modelId;
    }
    const rot = e.rot;
    if (typeof rot !== "number" || !OBROTY.includes(rot as Obrot)) blad(`Element ${i + 1}: obrót musi być 0, 90, 180 albo 270°.`);
    const nazwa = tekst(e.nazwa, `nazwa elementu ${i + 1}`, 80);
    return {
      id,
      nazwa,
      zrodlo,
      ...(modelId ? { modelId } : {}),
      strefa: jedno(e.strefa, STREFY, `strefa elementu ${i + 1}`),
      w: cm(e.w, `szerokość elementu ${i + 1}`, MODUL_LIMITS.w.min, MODUL_LIMITS.w.max),
      h: cm(e.h, `wysokość elementu ${i + 1}`, MODUL_LIMITS.h.min, MODUL_LIMITS.h.max),
      d: cm(e.d, `głębokość elementu ${i + 1}`, MODUL_LIMITS.d.min, MODUL_LIMITS.d.max),
      x: cm(e.x, `pozycja x elementu ${i + 1}`, POLOZENIE.min, POLOZENIE.max),
      z: cm(e.z, `pozycja z elementu ${i + 1}`, POLOZENIE.min, POLOZENIE.max),
      rot: rot as Obrot,
    };
  });
  const plan: PlanKuchni = { uklad, scianaA, scianaB, pomieszczenie, elementy };
  const kolizja = opiszKolizje(plan);
  if (kolizja) blad(kolizja);
  return plan;
}
