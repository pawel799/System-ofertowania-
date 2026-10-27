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
import { LINIA_LIMITS, MAX_MODULY, MODUL_LIMITS, modulCena, sumaModulow, type ModulCennik, type ModulItem } from "./modul";

export type UkladKuchni = "ciag" | "L";
export type Strefa = "dolna" | "gorna" | "wysoka" | "blat" | "polka";
export type ZrodloElementu = "modul" | "model";
export type Obrot = 0 | 90 | 180 | 270;
export type Sciana = "A" | "B";

/** Rodzaj bryły. Stare oferty go nie mają — wtedy zostaje szafka. */
export type RodzajElementu =
  | "szafka"
  | "szuflady"
  | "narozna"
  | "zlew"
  | "zlewozmywak"
  | "bateria"
  | "zmywarka"
  | "plyta-indukcja"
  | "plyta-gaz"
  | "piekarnik"
  | "mikrofalowka"
  | "okap"
  | "okap-podszafkowy"
  | "lodowka"
  | "lodowka-zabudowa"
  | "polka"
  | "blat";

export const RODZAJE: readonly RodzajElementu[] = [
  "szafka",
  "szuflady",
  "narozna",
  "zlew",
  "zlewozmywak",
  "bateria",
  "zmywarka",
  "plyta-indukcja",
  "plyta-gaz",
  "piekarnik",
  "mikrofalowka",
  "okap",
  "okap-podszafkowy",
  "lodowka",
  "lodowka-zabudowa",
  "polka",
  "blat",
];

export type ElementKuchni = {
  id: string;
  nazwa: string;
  zrodlo: ZrodloElementu;
  /** Id modelu z R2, gdy zrodlo = "model". */
  modelId?: string;
  strefa: Strefa;
  /** Brak w starszych ofertach = szafka. */
  rodzaj?: RodzajElementu;
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
  blat: "Na blacie",
  polka: "Półka",
};

export const RODZAJ_LABEL: Record<RodzajElementu, string> = {
  szafka: "Szafka",
  szuflady: "Szuflady",
  narozna: "Narożna",
  zlew: "Szafka pod zlew",
  zlewozmywak: "Zlewozmywak",
  bateria: "Bateria",
  zmywarka: "Zmywarka",
  "plyta-indukcja": "Płyta indukcyjna",
  "plyta-gaz": "Płyta gazowa",
  piekarnik: "Piekarnik",
  mikrofalowka: "Mikrofalówka",
  okap: "Okap",
  "okap-podszafkowy": "Okap podszafkowy",
  lodowka: "Lodówka",
  "lodowka-zabudowa": "Zabudowa lodówki",
  polka: "Półka ścienna",
  blat: "Blat",
};

export type GrupaPresetu = "dolne" | "gorne" | "polki" | "slupki" | "agd";

export const GRUPY_PRESETOW: { id: GrupaPresetu; label: string }[] = [
  { id: "dolne", label: "Szafki dolne" },
  { id: "gorne", label: "Szafki górne" },
  { id: "polki", label: "Półki ścienne" },
  { id: "slupki", label: "Słupki" },
  { id: "agd", label: "AGD" },
];

export type PresetModul = {
  id: string;
  nazwa: string;
  grupa: GrupaPresetu;
  strefa: Strefa;
  rodzaj: RodzajElementu;
  w: number;
  h: number;
  d: number;
};

/** Szafki i AGD oparte o bryłę parametryczną — gdy firma nie ma własnych GLB. */
export const PRESETY: PresetModul[] = [
  { id: "dolna-40", nazwa: "Szafka dolna 40", grupa: "dolne", strefa: "dolna", rodzaj: "szafka", w: 40, h: 72, d: 56 },
  { id: "dolna-60", nazwa: "Szafka dolna 60", grupa: "dolne", strefa: "dolna", rodzaj: "szafka", w: 60, h: 72, d: 56 },
  { id: "dolna-80", nazwa: "Szafka dolna 80", grupa: "dolne", strefa: "dolna", rodzaj: "szafka", w: 80, h: 72, d: 56 },
  { id: "szuflady-45", nazwa: "Szuflady 45", grupa: "dolne", strefa: "dolna", rodzaj: "szuflady", w: 45, h: 72, d: 56 },
  { id: "szuflady-60", nazwa: "Szuflady 60", grupa: "dolne", strefa: "dolna", rodzaj: "szuflady", w: 60, h: 72, d: 56 },
  { id: "narozna-90", nazwa: "Szafka narożna 90", grupa: "dolne", strefa: "dolna", rodzaj: "narozna", w: 90, h: 72, d: 90 },
  { id: "zlew-80", nazwa: "Szafka pod zlew 80", grupa: "dolne", strefa: "dolna", rodzaj: "zlew", w: 80, h: 72, d: 56 },
  { id: "gorna-40", nazwa: "Szafka górna 40", grupa: "gorne", strefa: "gorna", rodzaj: "szafka", w: 40, h: 72, d: 32 },
  { id: "gorna-60", nazwa: "Szafka górna 60", grupa: "gorne", strefa: "gorna", rodzaj: "szafka", w: 60, h: 72, d: 32 },
  { id: "gorna-80", nazwa: "Szafka górna 80", grupa: "gorne", strefa: "gorna", rodzaj: "szafka", w: 80, h: 72, d: 32 },
  { id: "nad-okap-60", nazwa: "Szafka nad okap 60", grupa: "gorne", strefa: "gorna", rodzaj: "szafka", w: 60, h: 36, d: 32 },
  { id: "polka-60", nazwa: "Półka ścienna 60", grupa: "polki", strefa: "polka", rodzaj: "polka", w: 60, h: 6, d: 28 },
  { id: "polka-80", nazwa: "Półka ścienna 80", grupa: "polki", strefa: "polka", rodzaj: "polka", w: 80, h: 6, d: 28 },
  { id: "polka-120", nazwa: "Półka ścienna 120", grupa: "polki", strefa: "polka", rodzaj: "polka", w: 120, h: 6, d: 28 },
  { id: "polka-podwojna-80", nazwa: "Półka podwójna 80", grupa: "polki", strefa: "polka", rodzaj: "polka", w: 80, h: 36, d: 28 },
  { id: "slupek-60", nazwa: "Słupek 60", grupa: "slupki", strefa: "wysoka", rodzaj: "szafka", w: 60, h: 210, d: 56 },
  { id: "piekarnik-60", nazwa: "Słupek z piekarnikiem 60", grupa: "slupki", strefa: "wysoka", rodzaj: "piekarnik", w: 60, h: 210, d: 56 },
  { id: "lodowka-zabudowa-60", nazwa: "Zabudowa lodówki 60", grupa: "slupki", strefa: "wysoka", rodzaj: "lodowka-zabudowa", w: 60, h: 210, d: 56 },
  { id: "zmywarka-60", nazwa: "Zmywarka do zabudowy 60", grupa: "agd", strefa: "dolna", rodzaj: "zmywarka", w: 60, h: 72, d: 56 },
  { id: "zmywarka-45", nazwa: "Zmywarka do zabudowy 45", grupa: "agd", strefa: "dolna", rodzaj: "zmywarka", w: 45, h: 72, d: 56 },
  { id: "piekarnik-dolny", nazwa: "Piekarnik pod blatem", grupa: "agd", strefa: "dolna", rodzaj: "piekarnik", w: 60, h: 72, d: 56 },
  { id: "plyta-indukcja-60", nazwa: "Płyta indukcyjna 60", grupa: "agd", strefa: "blat", rodzaj: "plyta-indukcja", w: 60, h: 5, d: 52 },
  { id: "plyta-gaz-60", nazwa: "Płyta gazowa 60", grupa: "agd", strefa: "blat", rodzaj: "plyta-gaz", w: 60, h: 6, d: 52 },
  { id: "lodowka-60", nazwa: "Lodówka wolnostojąca", grupa: "agd", strefa: "wysoka", rodzaj: "lodowka", w: 60, h: 178, d: 62 },
  { id: "mikrofalowka", nazwa: "Mikrofalówka", grupa: "agd", strefa: "blat", rodzaj: "mikrofalowka", w: 60, h: 38, d: 35 },
  { id: "mikrofalowka-zabudowa", nazwa: "Mikrofalówka do zabudowy", grupa: "agd", strefa: "gorna", rodzaj: "mikrofalowka", w: 60, h: 38, d: 35 },
  { id: "okap-komin-60", nazwa: "Okap kominowy 60", grupa: "agd", strefa: "gorna", rodzaj: "okap", w: 60, h: 48, d: 48 },
  { id: "okap-komin-90", nazwa: "Okap kominowy 90", grupa: "agd", strefa: "gorna", rodzaj: "okap", w: 90, h: 48, d: 48 },
  { id: "okap-pod-60", nazwa: "Okap podszafkowy 60", grupa: "agd", strefa: "gorna", rodzaj: "okap-podszafkowy", w: 60, h: 15, d: 48 },
  { id: "zlewozmywak-50", nazwa: "Zlewozmywak", grupa: "agd", strefa: "blat", rodzaj: "zlewozmywak", w: 50, h: 18, d: 40 },
  { id: "bateria", nazwa: "Bateria kuchenna", grupa: "agd", strefa: "blat", rodzaj: "bateria", w: 8, h: 34, d: 14 },
];

const SCIANA = { min: 80, max: 1200 };
const POMIESZCZENIE = { min: 120, max: 2000 };
const POLOZENIE = { min: -200, max: 3000 };
const OBROTY: readonly Obrot[] = [0, 90, 180, 270];
const STREFY: readonly Strefa[] = ["dolna", "gorna", "wysoka", "blat", "polka"];
const ZRODLA: readonly ZrodloElementu[] = ["modul", "model"];
const MODEL_ID_RE = /^[A-Za-z0-9]{10,32}$/;
const ID_RE = /^[A-Za-z0-9]{4,16}$/;
/** Do tej przerwy „Dociągnij rząd” zsuwa szafki. */
const ODSTEP_DOCIAGANIA = 25;
const PRZYCIAGANIE = 4;

type Zakres = { min: number; max: number };
export type LimityWymiarow = { w: Zakres; h: Zakres; d: Zakres };

const zakres = (min: number, max: number): Zakres => ({ min, max });

/** Widełki sensowne dla rodzaju — panel nie pozwoli wyjść poza nie przy edycji. */
export function limityRodzaju(rodzaj: RodzajElementu, strefa: Strefa): LimityWymiarow {
  switch (rodzaj) {
    case "szuflady":
      return { w: zakres(30, 100), h: zakres(55, 92), d: zakres(45, 65) };
    case "narozna":
      return { w: zakres(80, 110), h: zakres(60, 92), d: zakres(80, 110) };
    case "zlew":
      return { w: zakres(50, 120), h: zakres(60, 92), d: zakres(45, 65) };
    case "zlewozmywak":
      return { w: zakres(30, 90), h: zakres(12, 28), d: zakres(30, 55) };
    case "bateria":
      return { w: zakres(4, 16), h: zakres(15, 50), d: zakres(6, 22) };
    case "zmywarka":
      return { w: zakres(45, 60), h: zakres(60, 86), d: zakres(50, 62) };
    case "plyta-indukcja":
    case "plyta-gaz":
      return { w: zakres(28, 90), h: zakres(4, 12), d: zakres(40, 60) };
    case "piekarnik":
      return strefa === "wysoka"
        ? { w: zakres(45, 90), h: zakres(170, 230), d: zakres(50, 65) }
        : { w: zakres(45, 90), h: zakres(55, 90), d: zakres(50, 62) };
    case "mikrofalowka":
      return { w: zakres(40, 70), h: zakres(28, 50), d: zakres(28, 45) };
    case "okap":
      return { w: zakres(45, 120), h: zakres(24, 100), d: zakres(28, 55) };
    case "okap-podszafkowy":
      return { w: zakres(45, 90), h: zakres(10, 28), d: zakres(28, 52) };
    case "lodowka":
      return { w: zakres(50, 100), h: zakres(140, 210), d: zakres(55, 75) };
    case "lodowka-zabudowa":
      return { w: zakres(45, 90), h: zakres(170, 230), d: zakres(50, 65) };
    case "polka":
      return { w: zakres(30, 120), h: zakres(4, 48), d: zakres(12, 40) };
    case "blat":
      return { w: zakres(30, 400), h: zakres(2, 12), d: zakres(30, 160) };
    default:
      if (strefa === "gorna") return { w: zakres(30, 120), h: zakres(28, 110), d: zakres(20, 45) };
      if (strefa === "wysoka") return { w: zakres(30, 100), h: zakres(160, 230), d: zakres(40, 70) };
      if (strefa === "polka") return { w: zakres(30, 120), h: zakres(4, 48), d: zakres(12, 40) };
      return { w: zakres(30, 120), h: zakres(55, 96), d: zakres(40, 70) };
  }
}

function przytnijDoLinii(z: Zakres, key: keyof LimityWymiarow): Zakres {
  const abs = LINIA_LIMITS[key];
  return { min: Math.max(abs.min, z.min), max: Math.min(abs.max, z.max) };
}

/** Zakres przyjęty przy zapisie. Szafka zostaje przy starych limitach, żeby nie odrzucić ofert. */
export function limityZapisu(rodzaj: RodzajElementu, strefa: Strefa): LimityWymiarow {
  if (rodzaj === "szafka") return { w: MODUL_LIMITS.w, h: MODUL_LIMITS.h, d: MODUL_LIMITS.d };
  const typ = limityRodzaju(rodzaj, strefa);
  return { w: przytnijDoLinii(typ.w, "w"), h: przytnijDoLinii(typ.h, "h"), d: przytnijDoLinii(typ.d, "d") };
}

/**
 * Model GLB (biblioteka albo wgrany plik) trzyma realny obrys, także blat 240 cm,
 * płytę o wysokości 1 cm i panel boczny 2 cm. Szafka parametryczna zostaje przy limityRodzaju.
 */
export const MODEL_LIMITS: LimityWymiarow = {
  w: zakres(1, 400),
  h: zakres(1, 280),
  d: zakres(1, 400),
};

export function limityElementu(el: { rodzaj?: RodzajElementu; strefa: Strefa; zrodlo?: ZrodloElementu }): LimityWymiarow {
  if (el.zrodlo === "model") return MODEL_LIMITS;
  return limityRodzaju(el.rodzaj ?? "szafka", el.strefa);
}

export function ograniczWymiar(el: Pick<ElementKuchni, "rodzaj" | "strefa" | "w" | "h" | "d" | "zrodlo">, key: "w" | "h" | "d", value: number) {
  const z = limityElementu(el)[key];
  const n = Math.round(value);
  if (!Number.isFinite(n)) return el[key];
  return Math.min(z.max, Math.max(z.min, n));
}

export function rodzajElementu(el: { rodzaj?: RodzajElementu }): RodzajElementu {
  return el.rodzaj ?? "szafka";
}

/** Krótka nazwa na rzucie (pełne słowo); gdy się nie mieści – skrotElementu. Pusta = szafka (pokazujemy szerokość). */
export function nazwaNaRzucie(el: { rodzaj?: RodzajElementu }): string {
  const NAZWY: Partial<Record<RodzajElementu, string>> = {
    szuflady: "szuflady",
    narozna: "narożna",
    zlew: "pod zlew",
    zlewozmywak: "zlew",
    bateria: "bateria",
    zmywarka: "zmywarka",
    "plyta-indukcja": "indukcja",
    "plyta-gaz": "płyta gaz.",
    piekarnik: "piekarnik",
    mikrofalowka: "mikrofala",
    okap: "okap",
    "okap-podszafkowy": "okap",
    lodowka: "lodówka",
    "lodowka-zabudowa": "lodówka",
    polka: "półka",
    blat: "blat",
  };
  return NAZWY[rodzajElementu(el)] ?? "";
}

export function skrotElementu(el: { rodzaj?: RodzajElementu }): string {
  switch (rodzajElementu(el)) {
    case "zmywarka":
      return "ZM";
    case "piekarnik":
      return "P";
    case "plyta-indukcja":
      return "IND";
    case "plyta-gaz":
      return "GAZ";
    case "lodowka":
    case "lodowka-zabudowa":
      return "L";
    case "mikrofalowka":
      return "MW";
    case "okap":
    case "okap-podszafkowy":
      return "OK";
    case "zlew":
    case "zlewozmywak":
      return "Z";
    case "bateria":
      return "B";
    case "polka":
      return "półka";
    case "blat":
      return "blat";
    case "szuflady":
      return "SZ";
    case "narozna":
      return "N";
    default:
      return "";
  }
}

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

/** Oś, wzdłuż której leży szerokość (front). */
export function osSzerokosci(rot: number): "x" | "z" {
  return rot % 180 === 0 ? "x" : "z";
}

function kraniec(e: { x: number; z: number; w: number; d: number; rot: number }, os: "x" | "z", koniec: "start" | "end") {
  const r = rect(e);
  if (os === "x") return koniec === "start" ? r.x0 : r.x1;
  return koniec === "start" ? r.z0 : r.z1;
}

function nakladPoprzeczny(a: ElementKuchni, b: ElementKuchni, os: "x" | "z") {
  const ra = rect(a);
  const rb = rect(b);
  if (os === "x") return ra.z0 < rb.z1 - 0.5 && rb.z0 < ra.z1 - 0.5;
  return ra.x0 < rb.x1 - 0.5 && rb.x0 < ra.x1 - 0.5;
}

/**
 * Słupek zajmuje całą wysokość. Górna może stać nad dolną.
 * Półka ścienna dzieli pas szafek górnych. Blat leży na szafkach dolnych.
 */
export function konfliktStref(a: Strefa, b: Strefa) {
  if (a === "wysoka" || b === "wysoka") return true;
  if ((a === "polka" && b === "gorna") || (a === "gorna" && b === "polka")) return true;
  if ((a === "polka" || b === "polka") && a !== b) return false;
  if (a === "blat" || b === "blat") return a === b;
  return a === b;
}

export function konfliktElementow(
  a: { strefa: Strefa; rodzaj?: RodzajElementu },
  b: { strefa: Strefa; rodzaj?: RodzajElementu },
) {
  const ar = rodzajElementu(a);
  const br = rodzajElementu(b);
  if ((ar === "bateria" && (br === "zlewozmywak" || br === "zlew")) || (br === "bateria" && (ar === "zlewozmywak" || ar === "zlew"))) {
    return false;
  }
  // Płyta blatu leży pod płytą grzewczą, zlewem i mikrofalówką — nie wypycha ich z rzędu.
  const naBlacie = new Set<RodzajElementu>(["zlewozmywak", "bateria", "plyta-indukcja", "plyta-gaz", "mikrofalowka"]);
  if ((ar === "blat" && naBlacie.has(br)) || (br === "blat" && naBlacie.has(ar))) return false;
  return konfliktStref(a.strefa, b.strefa);
}

export function opiszKolizje(plan: PlanKuchni): string | null {
  const list = plan.elementy;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (!konfliktElementow(a, b)) continue;
      if (nachodzi(rect(a), rect(b))) return `„${a.nazwa}” nachodzi na „${b.nazwa}”. Rozsuń je w rzucie.`;
    }
  }
  return null;
}

function ustawOdStartu(e: ElementKuchni, os: "x" | "z", start: number, w: number): ElementKuchni {
  let center = Math.round(start + w / 2);
  if (center - w / 2 < start - 0.01) center += 1;
  return os === "x" ? { ...e, w, x: center } : { ...e, w, z: center };
}

function ustawGlebokoscOdTylu(e: ElementKuchni, d: number): ElementKuchni {
  const r = rect(e);
  if (e.rot === 0) {
    let z = Math.round(r.z0 + d / 2);
    if (z - d / 2 < r.z0 - 0.01) z += 1;
    return { ...e, d, z };
  }
  if (e.rot === 180) {
    let z = Math.round(r.z1 - d / 2);
    if (z + d / 2 > r.z1 + 0.01) z -= 1;
    return { ...e, d, z };
  }
  if (e.rot === 90) {
    let x = Math.round(r.x0 + d / 2);
    if (x - d / 2 < r.x0 - 0.01) x += 1;
    return { ...e, d, x };
  }
  let x = Math.round(r.x1 - d / 2);
  if (x + d / 2 > r.x1 + 0.01) x -= 1;
  return { ...e, d, x };
}

function dopasujSciany(plan: PlanKuchni): PlanKuchni {
  let scianaA = plan.scianaA;
  let scianaB = plan.scianaB;
  for (const e of plan.elementy) {
    const r = rect(e);
    if (r.x1 > scianaA) scianaA = Math.min(SCIANA.max, Math.ceil(r.x1 / 10) * 10);
    if (r.z1 > scianaB) scianaB = Math.min(SCIANA.max, Math.ceil(r.z1 / 10) * 10);
  }
  if (scianaA === plan.scianaA && scianaB === plan.scianaB) return plan;
  return { ...plan, scianaA, scianaB };
}

/**
 * Zmiana szerokości trzyma lewą krawędź i przesuwa dalsze szafki tego rzędu,
 * żeby styk albo przerwa zostały takie same. Głębokość rośnie od ściany.
 * Kolizja z czymś spoza rzędu odrzuca zmianę (null).
 */
export function zmienWymiar(plan: PlanKuchni, id: string, key: "w" | "h" | "d", value: number): PlanKuchni | null {
  const el = plan.elementy.find((e) => e.id === id);
  if (!el) return null;
  const v = ograniczWymiar(el, key, value);
  if (key === "h") {
    if (v === el.h) return plan;
    return { ...plan, elementy: plan.elementy.map((e) => (e.id === id ? { ...e, h: v } : e)) };
  }
  const narozna = rodzajElementu(el) === "narozna";
  const nowaSzer = key === "w" || narozna ? v : el.w;
  const nowaGl = key === "d" || narozna ? v : el.d;
  if (nowaSzer === el.w && nowaGl === el.d) return plan;

  const os = osSzerokosci(el.rot);
  const placed = new Map<string, ElementKuchni>();
  // Najpierw szerokość (stara głębokość zostaje, żeby tylna krawędź była liczona od ściany).
  let pierwszy = ustawOdStartu(el, os, kraniec(el, os, "start"), nowaSzer);
  if (key === "d" || narozna) pierwszy = ustawGlebokoscOdTylu(pierwszy, nowaGl);
  placed.set(el.id, pierwszy);
  // Dalsze elementy tego samego rzędu — też górne, blat i słupek — jadą o tę samą różnicę,
  // żeby styk przy ścianie został. Sama głębokość nikogo nie przesuwa.
  if (key !== "d" || narozna) {
    const staryKoniec = kraniec(el, os, "end");
    const delta = kraniec(pierwszy, os, "end") - staryKoniec;
    if (Math.abs(delta) > 0.01) {
      for (const e of plan.elementy) {
        if (e.id === el.id || osSzerokosci(e.rot) !== os || !nakladPoprzeczny(el, e, os)) continue;
        if (kraniec(e, os, "start") < staryKoniec - 0.8) continue;
        placed.set(e.id, ustawOdStartu(e, os, kraniec(e, os, "start") + delta, e.w));
      }
    }
  }
  const plan2 = dopasujSciany({ ...plan, elementy: plan.elementy.map((e) => placed.get(e.id) ?? e) });
  if (opiszKolizje(plan2)) return null;
  return plan2;
}

/** Cały rząd: szafki w tę i w drugą stronę, dopóki przerwa nie przekroczy progu. */
function rzadElementu(plan: PlanKuchni, el: ElementKuchni, maxPrzerwa: number) {
  const os = osSzerokosci(el.rot);
  const wszyscy = plan.elementy
    .filter((e) => e.strefa === el.strefa && osSzerokosci(e.rot) === os && nakladPoprzeczny(el, e, os))
    .sort((a, b) => kraniec(a, os, "start") - kraniec(b, os, "start"));
  const grupy: ElementKuchni[][] = [];
  for (const e of wszyscy) {
    const ostatnia = grupy[grupy.length - 1];
    const poprzedni = ostatnia?.[ostatnia.length - 1];
    const przerwa = poprzedni ? kraniec(e, os, "start") - kraniec(poprzedni, os, "end") : 0;
    if (!ostatnia || !poprzedni || przerwa > maxPrzerwa || !nakladPoprzeczny(poprzedni, e, os)) grupy.push([e]);
    else ostatnia.push(e);
  }
  return grupy.find((g) => g.some((e) => e.id === el.id)) ?? [el];
}

/** Zsuwa rząd zaznaczonej szafki (przerwy do 25 cm) do stiku, bez zmiany wymiarów. */
export function dociagnijRzad(plan: PlanKuchni, id: string): PlanKuchni | null {
  const el = plan.elementy.find((e) => e.id === id);
  if (!el) return null;
  const os = osSzerokosci(el.rot);
  const lancuch = rzadElementu(plan, el, ODSTEP_DOCIAGANIA);
  if (lancuch.length < 2) return plan;
  const placed = new Map<string, ElementKuchni>();
  let cursor = kraniec(lancuch[0], os, "start");
  for (const e of lancuch) {
    const pol = ustawOdStartu(e, os, cursor, e.w);
    placed.set(e.id, pol);
    cursor = kraniec(pol, os, "end");
  }
  const plan2 = dopasujSciany({ ...plan, elementy: plan.elementy.map((e) => placed.get(e.id) ?? e) });
  if (opiszKolizje(plan2)) return null;
  return plan2;
}

export function dlugoscRzedu(plan: PlanKuchni, id: string): number | null {
  const el = plan.elementy.find((e) => e.id === id);
  if (!el) return null;
  const os = osSzerokosci(el.rot);
  const lancuch = rzadElementu(plan, el, ODSTEP_DOCIAGANIA);
  const od = Math.min(...lancuch.map((e) => kraniec(e, os, "start")));
  const dok = Math.max(...lancuch.map((e) => kraniec(e, os, "end")));
  return Math.round(dok - od);
}

/** Długość zabudowy danej strefy przy ścianie (cm), albo null gdy pusto. */
export function zasiegNaScianie(plan: PlanKuchni, strefa: Strefa, sciana: Sciana): { od: number; do: number } | null {
  const filtr = plan.elementy.filter((e) => {
    if (e.strefa !== strefa) return false;
    const r = rect(e);
    if (sciana === "A") return e.rot % 180 === 0 && r.z0 < 24;
    return (e.rot === 90 || e.rot === 270) && r.x0 < 24;
  });
  if (!filtr.length) return null;
  const os: "x" | "z" = sciana === "A" ? "x" : "z";
  return {
    od: Math.min(...filtr.map((e) => kraniec(e, os, "start"))),
    do: Math.max(...filtr.map((e) => kraniec(e, os, "end"))),
  };
}

function najblizszy(krawedzie: [number, number], cele: number[]) {
  let best: number | null = null;
  for (const c of cele) {
    for (const edge of krawedzie) {
      const d = c - edge;
      if (Math.abs(d) <= PRZYCIAGANIE && (best === null || Math.abs(d) < Math.abs(best))) best = d;
    }
  }
  return best ?? 0;
}

/** Przyciąga krawędź do ściany albo do sąsiedniego modułu tej samej kolizji (do 4 cm). */
export function przyciagnij(plan: PlanKuchni, el: ElementKuchni, x: number, z: number) {
  const kand = { ...el, x, z };
  const r = rect(kand);
  const celeX = [0, plan.scianaA];
  const celeZ = [0];
  if (plan.uklad === "L") celeZ.push(plan.scianaB);
  for (const inny of plan.elementy) {
    if (inny.id === el.id || !konfliktElementow(el, inny)) continue;
    const o = rect(inny);
    celeX.push(o.x0, o.x1);
    celeZ.push(o.z0, o.z1);
  }
  return {
    x: Math.round(x + najblizszy([r.x0, r.x1], celeX)),
    z: Math.round(z + najblizszy([r.z0, r.z1], celeZ)),
  };
}

export function nastepnaPozycja(
  plan: PlanKuchni,
  w: number,
  d: number,
  strefa: Strefa,
  sciana: Sciana,
  rodzaj: RodzajElementu = "szafka",
) {
  const rot: Obrot = sciana === "B" ? 90 : 0;
  let pos = 0;
  for (let i = 0; i < 80; i++) {
    const kand =
      sciana === "A"
        ? { x: Math.round(pos + w / 2), z: Math.round(d / 2), w, d, rot, strefa, rodzaj }
        : { x: Math.round(d / 2), z: Math.round(pos + w / 2), w, d, rot, strefa, rodzaj };
    const r = rect(kand);
    const blok = plan.elementy.filter((e) => konfliktElementow(kand, e) && nachodzi(r, rect(e)));
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
  rodzaj?: RodzajElementu;
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
  const rodzaj = bazowy.rodzaj ?? "szafka";
  const pos = nastepnaPozycja(plan, bazowy.w, bazowy.d, bazowy.strefa, gdzie, rodzaj);
  const el: ElementKuchni = {
    id: nowyElementId(new Set(plan.elementy.map((e) => e.id))),
    nazwa: bazowy.nazwa.replace(/\s+/g, " ").trim().slice(0, 80) || "Szafka",
    zrodlo: bazowy.zrodlo,
    ...(bazowy.zrodlo === "model" && bazowy.modelId ? { modelId: bazowy.modelId } : {}),
    strefa: bazowy.strefa,
    rodzaj,
    w: bazowy.w,
    h: bazowy.h,
    d: bazowy.d,
    ...pos,
  };
  return dopasujSciany({ ...plan, elementy: [...plan.elementy, el] });
}

const presetPoId = (id: string): NowyElement => {
  const p = PRESETY.find((x) => x.id === id);
  if (!p) throw new Error(id);
  return { nazwa: p.nazwa, strefa: p.strefa, rodzaj: p.rodzaj, w: p.w, h: p.h, d: p.d, zrodlo: "modul" };
};

function doloz(plan: PlanKuchni, bazowy: NowyElement, x: number, z: number, rot: Obrot): PlanKuchni {
  if (plan.elementy.length >= MAX_MODULY) return plan;
  const el: ElementKuchni = {
    id: nowyElementId(new Set(plan.elementy.map((e) => e.id))),
    nazwa: bazowy.nazwa,
    zrodlo: bazowy.zrodlo,
    strefa: bazowy.strefa,
    rodzaj: bazowy.rodzaj ?? "szafka",
    w: bazowy.w,
    h: bazowy.h,
    d: bazowy.d,
    x,
    z,
    rot,
  };
  const proba = { ...plan, elementy: [...plan.elementy, el] };
  if (opiszKolizje(proba)) return plan;
  return dopasujSciany(proba);
}

/** Gotowy układ do pierwszej przymiarki — szafki, AGD i półka. */
export function wstawPrzyklad(uklad: UkladKuchni): PlanKuchni {
  const kolejnosc: [string, Sciana][] =
    uklad === "L"
      ? [
          ["dolna-60", "A"],
          ["zlew-80", "A"],
          ["zmywarka-60", "A"],
          ["dolna-40", "B"],
          ["dolna-60", "B"],
          ["gorna-60", "A"],
          ["okap-komin-60", "A"],
          ["gorna-40", "A"],
          ["gorna-40", "B"],
          ["gorna-60", "B"],
          ["polka-80", "B"],
        ]
      : [
          ["dolna-60", "A"],
          ["zlew-80", "A"],
          ["zmywarka-60", "A"],
          ["dolna-60", "A"],
          ["piekarnik-60", "A"],
          ["gorna-60", "A"],
          ["gorna-60", "A"],
          ["okap-komin-60", "A"],
          ["gorna-60", "A"],
          ["polka-80", "A"],
        ];
  const plan = kolejnosc.reduce((acc, [id, sciana]) => dodajElement(acc, presetPoId(id), sciana), pustyPlan(uklad));
  const podPlyte = [...plan.elementy].reverse().find((e) => e.strefa === "dolna" && rodzajElementu(e) === "szafka");
  if (!podPlyte) return plan;
  return doloz(plan, presetPoId("plyta-indukcja-60"), podPlyte.x, podPlyte.z, podPlyte.rot);
}

/**
 * Urządzenia, które nie wchodzą do ceny zabudowy (strona klienta: „Bez AGD”).
 * Zabudowy AGD – słupek z piekarnikiem, piekarnik pod blatem, zmywarka do zabudowy, zabudowa lodówki,
 * szafka pod zlew – są meblem (korpus, front), więc liczą się jak szafka.
 */
export const URZADZENIA_POZA_WYCENA: ReadonlySet<RodzajElementu> = new Set<RodzajElementu>([
  "zlewozmywak",
  "bateria",
  "plyta-indukcja",
  "plyta-gaz",
  "mikrofalowka",
  "okap",
  "okap-podszafkowy",
  "lodowka",
]);

export const wycenianyElement = (el: { rodzaj?: RodzajElementu }) => !URZADZENIA_POZA_WYCENA.has(rodzajElementu(el));

/** Cena netto elementu z cennika modułów; null = urządzenie AGD poza wyceną. */
export function cenaElementu(el: { rodzaj?: RodzajElementu; w: number; h: number; d: number }, cennik: ModulCennik): number | null {
  return wycenianyElement(el) ? modulCena(el, cennik) : null;
}

/** Pozycje do cennika: klient nie przysyła ceny, tylko wymiary. Bez urządzeń AGD. */
export function pozycjeKuchni(plan: PlanKuchni): ModulItem[] {
  return plan.elementy.filter(wycenianyElement).map((e) => ({ nazwa: e.nazwa, w: e.w, h: e.h, d: e.d }));
}

/** Suma netto zabudowy (bez AGD). Przy niepustej kuchni minimum 1 zł (pole base oferty musi być > 0). */
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
    const strefa = jedno(e.strefa, STREFY, `strefa elementu ${i + 1}`);
    const rodzaj: RodzajElementu =
      e.rodzaj === undefined || e.rodzaj === null ? "szafka" : jedno(e.rodzaj, RODZAJE, `rodzaj elementu ${i + 1}`);
    const lim = zrodlo === "model" ? MODEL_LIMITS : limityZapisu(rodzaj, strefa);
    return {
      id,
      nazwa,
      zrodlo,
      ...(modelId ? { modelId } : {}),
      strefa,
      rodzaj,
      w: cm(e.w, `szerokość elementu ${i + 1}`, lim.w.min, lim.w.max),
      h: cm(e.h, `wysokość elementu ${i + 1}`, lim.h.min, lim.h.max),
      d: cm(e.d, `głębokość elementu ${i + 1}`, lim.d.min, lim.d.max),
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
