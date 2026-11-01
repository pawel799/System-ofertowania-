/*
 * Kreator krok po kroku – odpowiedzi z pomiaru (pomieszczenie, okna i drzwi, instalacje, AGD, potrzeby)
 * (propozycja układu z tych odpowiedzi: propozycja.ts). Zapis w planie (plan.wywiad), walidacja w parseKuchnia.
 *
 * Pytamy o to, bez czego oferta jest zgadywaniem:
 *   – wymiary pomieszczenia i wysokość do sufitu (szafy do sufitu, szafki górne),
 *   – okna i drzwi na ścianach zabudowy (gdzie nie może być szafek górnych / żadnych),
 *   – przyłącze wody (zlew, zmywarka, umywalka stoją przy nim), gaz czy indukcja,
 *   – AGD do zabudowy (wymiary modułów), wysokość szafek górnych,
 *   – w szafie: drzwi przesuwne czy uchylne i co ma się zmieścić (długie ubrania, koszule, składane, szuflady),
 *   – budżet i termin (do rozmowy, nie do ceny).
 */
import type { TypProjektu } from "./projekt";

/** Ściana zabudowy (jak w kuchnia.ts – tu bez importu, bo kuchnia.ts korzysta z tego pliku). */
type Sciana = "A" | "B";

export type Otwor = {
  rodzaj: "okno" | "drzwi";
  /** A, B – ściany zabudowy; C, D – naprzeciw nich (gdy podano wymiary pokoju, src/lib/sciany.ts). */
  sciana: Sciana | "C" | "D";
  /** Od narożnika (początku ściany) do krawędzi otworu [cm]. */
  od: number;
  szer: number;
  /** Okno: wysokość parapetu od podłogi [cm]. */
  parapet?: number;
};

/** Gniazdka i inne punkty instalacji na ścianach (logika: src/lib/punkty.ts, modele 3D: components/kuchnia/PunktyInstalacji.tsx). */
export type RodzajPunktu = "gniazdko" | "gniazdko-2" | "sila" | "wlacznik" | "swiatlo" | "rtv" | "gaz" | "kratka";

export type PunktInstalacji = {
  rodzaj: RodzajPunktu;
  sciana: Sciana | "C" | "D";
  /** Środek punktu od narożnika (początku ściany) [cm]. */
  od: number;
  /** Środek punktu nad podłogą [cm]. */
  wys: number;
};

/** Nazwa, wymiar puszki / maskownicy [cm] i typowa wysokość montażu [cm]. */
export const PUNKT_INFO: Record<RodzajPunktu, { nazwa: string; krotka: string; szer: number; h: number; wys: number; elektryczny: boolean }> = {
  gniazdko: { nazwa: "Gniazdko 230 V", krotka: "Gniazdko", szer: 8, h: 8, wys: 110, elektryczny: true },
  "gniazdko-2": { nazwa: "Gniazdko podwójne 230 V", krotka: "Podwójne gniazdko", szer: 15, h: 8, wys: 110, elektryczny: true },
  sila: { nazwa: "Gniazdo siłowe 400 V (płyta indukcyjna)", krotka: "Siła 400 V", szer: 10, h: 10, wys: 50, elektryczny: true },
  wlacznik: { nazwa: "Włącznik światła", krotka: "Włącznik", szer: 8, h: 8, wys: 120, elektryczny: true },
  swiatlo: { nazwa: "Punkt świetlny (kinkiet)", krotka: "Światło", szer: 12, h: 12, wys: 210, elektryczny: true },
  rtv: { nazwa: "Gniazdo RTV / internet", krotka: "RTV / LAN", szer: 8, h: 8, wys: 30, elektryczny: true },
  gaz: { nazwa: "Zawór gazu", krotka: "Gaz", szer: 8, h: 12, wys: 50, elektryczny: false },
  kratka: { nazwa: "Kratka wentylacyjna", krotka: "Kratka", szer: 15, h: 15, wys: 230, elektryczny: false },
};
export const RODZAJE_PUNKTOW = Object.keys(PUNKT_INFO) as RodzajPunktu[];
/** Najwięcej punktów instalacji w projekcie. */
export const MAX_PUNKTOW = 40;

export type Agd = "zmywarka-60" | "zmywarka-45" | "piekarnik-slupek" | "piekarnik-dolny" | "lodowka-zabudowa" | "lodowka-wolnostojaca" | "plyta" | "okap" | "mikrofalowka";
export type Potrzeba = "dlugie" | "koszule" | "skladane" | "szuflady" | "buty";
export type MebelSalonu = "komoda" | "rtv" | "regal" | "nocne";

export type Wywiad = {
  /** Wysokość do sufitu [cm]. */
  wysokosc: number;
  otwory: Otwor[];
  woda: { sciana: Sciana; od: number } | null;
  gaz: boolean;
  /** Gniazdka, włączniki, gaz, kratki… (starsze oferty – brak). */
  punkty?: PunktInstalacji[];
  agd: Agd[];
  gorne: "72" | "90" | "sufit";
  drzwiSzafy: "przesuwne" | "uchylne";
  potrzeby: Potrzeba[];
  meble: MebelSalonu[];
  umywalka: number;
  slupek: boolean;
  budzet: number | null;
  termin: string;
  uwagi: string;
};

export const AGD_LABEL: Record<Agd, string> = {
  "zmywarka-60": "Zmywarka 60 cm",
  "zmywarka-45": "Zmywarka 45 cm",
  "piekarnik-slupek": "Piekarnik w słupku",
  "piekarnik-dolny": "Piekarnik pod blatem",
  "lodowka-zabudowa": "Lodówka w zabudowie",
  "lodowka-wolnostojaca": "Lodówka wolnostojąca",
  plyta: "Płyta grzewcza",
  okap: "Okap",
  mikrofalowka: "Mikrofalówka do zabudowy",
};
export const POTRZEBA_LABEL: Record<Potrzeba, string> = {
  dlugie: "Długie ubrania (płaszcze, sukienki)",
  koszule: "Koszule i marynarki",
  skladane: "Ubrania składane, pościel",
  szuflady: "Szuflady (bielizna, akcesoria)",
  buty: "Buty",
};
export const MEBEL_LABEL: Record<MebelSalonu, string> = { komoda: "Komoda", rtv: "Szafka RTV", regal: "Regał", nocne: "2 szafki nocne" };

export const AGD_IDS = Object.keys(AGD_LABEL) as Agd[];
export const POTRZEBY = Object.keys(POTRZEBA_LABEL) as Potrzeba[];
export const MEBLE_SALONU = Object.keys(MEBEL_LABEL) as MebelSalonu[];

export function wywiadDomyslny(typ: TypProjektu = "kuchnia"): Wywiad {
  return {
    wysokosc: 260,
    otwory: [],
    woda: typ === "kuchnia" ? { sciana: "A", od: 120 } : typ === "lazienka" ? { sciana: "A", od: 50 } : null,
    gaz: false,
    agd: typ === "kuchnia" ? ["zmywarka-60", "piekarnik-slupek", "lodowka-zabudowa", "plyta", "okap"] : [],
    gorne: "72",
    drzwiSzafy: "przesuwne",
    potrzeby: ["dlugie", "skladane"],
    meble: ["komoda", "rtv"],
    umywalka: 80,
    slupek: true,
    budzet: null,
    termin: "",
    uwagi: "",
  };
}

/* ---------- walidacja (serwer) ---------- */

export function parseWywiad(v: unknown): Wywiad {
  const zle = (m: string): never => {
    throw new Error(`Wywiad: ${m}`);
  };
  if (!v || typeof v !== "object" || Array.isArray(v)) zle("zły format.");
  const o = v as Record<string, unknown>;
  const liczba = (x: unknown, pole: string, min: number, max: number) => {
    if (typeof x !== "number" || !Number.isFinite(x) || x < min || x > max) zle(`${pole}: od ${min} do ${max}.`);
    return Math.round(x as number);
  };
  const sciana = (x: unknown): Sciana => (x === "A" || x === "B" ? x : zle("ściana A albo B."));
  const lista = <T extends string>(x: unknown, dozwolone: readonly T[], pole: string): T[] => {
    if (!Array.isArray(x) || x.length > 20) zle(`${pole}: lista.`);
    return Array.from(new Set((x as unknown[]).filter((y): y is T => typeof y === "string" && (dozwolone as readonly string[]).includes(y))));
  };
  const tekst = (x: unknown, max: number) => (typeof x === "string" ? x.replace(/\s+/g, " ").trim().slice(0, max) : "");
  if (!Array.isArray(o.otwory) || o.otwory.length > 12) zle("do 12 okien i drzwi.");
  const otwory = (o.otwory as unknown[]).map((x, i) => {
    if (!x || typeof x !== "object") zle(`otwór ${i + 1}: zły format.`);
    const ot = x as Record<string, unknown>;
    const rodzaj = ot.rodzaj === "okno" || ot.rodzaj === "drzwi" ? ot.rodzaj : zle(`otwór ${i + 1}: okno albo drzwi.`);
    return {
      rodzaj,
      sciana: ot.sciana === "C" || ot.sciana === "D" ? ot.sciana : sciana(ot.sciana),
      od: liczba(ot.od, `otwór ${i + 1} – od narożnika`, 0, 2000),
      szer: liczba(ot.szer, `otwór ${i + 1} – szerokość`, 30, 600),
      ...(rodzaj === "okno" && ot.parapet !== undefined && ot.parapet !== null ? { parapet: liczba(ot.parapet, `okno ${i + 1} – parapet`, 0, 250) } : {}),
    } as Otwor;
  });
  let woda: Wywiad["woda"] = null;
  if (o.woda !== null && o.woda !== undefined) {
    const w = o.woda as Record<string, unknown>;
    woda = { sciana: sciana(w.sciana), od: liczba(w.od, "woda – od narożnika", 0, 2000) };
  }
  if (o.punkty !== undefined && (!Array.isArray(o.punkty) || o.punkty.length > MAX_PUNKTOW)) zle(`do ${MAX_PUNKTOW} gniazdek i punktów instalacji.`);
  const punkty = ((o.punkty as unknown[] | undefined) ?? []).map((x, i) => {
    if (!x || typeof x !== "object") zle(`punkt ${i + 1}: zły format.`);
    const pk = x as Record<string, unknown>;
    const rodzaj = typeof pk.rodzaj === "string" && (RODZAJE_PUNKTOW as readonly string[]).includes(pk.rodzaj) ? (pk.rodzaj as RodzajPunktu) : zle(`punkt ${i + 1}: nieznany rodzaj.`);
    return {
      rodzaj,
      sciana: pk.sciana === "C" || pk.sciana === "D" ? pk.sciana : sciana(pk.sciana),
      od: liczba(pk.od, `punkt ${i + 1} – od narożnika`, 0, 2000),
      wys: liczba(pk.wys, `punkt ${i + 1} – wysokość`, 0, 450),
    } as PunktInstalacji;
  });
  const gorne = o.gorne === "90" || o.gorne === "sufit" ? o.gorne : "72";
  return {
    wysokosc: liczba(o.wysokosc, "wysokość pomieszczenia", 180, 450),
    otwory,
    woda,
    gaz: o.gaz === true,
    ...(punkty.length ? { punkty } : {}),
    agd: lista(o.agd, AGD_IDS, "AGD"),
    gorne,
    drzwiSzafy: o.drzwiSzafy === "uchylne" ? "uchylne" : "przesuwne",
    potrzeby: lista(o.potrzeby, POTRZEBY, "potrzeby"),
    meble: lista(o.meble, MEBLE_SALONU, "meble"),
    umywalka: liczba(o.umywalka ?? 80, "szerokość umywalki", 40, 160),
    slupek: o.slupek === true,
    budzet: o.budzet === null || o.budzet === undefined || o.budzet === "" ? null : liczba(o.budzet, "budżet", 0, 10_000_000),
    termin: tekst(o.termin, 80),
    uwagi: tekst(o.uwagi, 1000),
  };
}
