/*
 * Szybka oferta i gotowe projekty: kilka parametrów (co, układ, pomieszczenie, AGD, potrzeby) → pełny plan
 * z propozycją mebli (propozycja.ts – zlew przy wodzie, zmywarka obok, słupki na końcu, szafki górne nad dolnymi).
 *
 * rozpoznaj() czyta opis pisany jak do sprzedawcy („kuchnia w L 3,6 x 2,8, zmywarka 45, lodówka wolnostojąca”)
 * i ustawia z niego parametry; resztę doklikuje się w formularzu. Gotowe projekty to te same parametry, nazwane.
 */
import { pustyPlan, type PlanKuchni, type UkladKuchni } from "./kuchnia";
import { ulozPropozycje } from "./propozycja";
import type { TypProjektu } from "./projekt";
import { wywiadDomyslny, type Agd, type MebelSalonu, type Potrzeba, type Wywiad } from "./wywiad";
import { propozycjaPunktow } from "./punkty";

export type ParametrySzybkiej = {
  typ: TypProjektu;
  uklad: UkladKuchni;
  /** Pomieszczenie [cm]: szerokość wzdłuż ściany A, długość wzdłuż ściany B. */
  pokoj: { szer: number; dlug: number };
  /** Wysokość do sufitu [cm]. */
  wysokosc: number;
  /** Długość zabudowy na ścianie A i (w L) B [cm] – domyślnie cała ściana. */
  scianaA: number;
  scianaB: number;
  agd: Agd[];
  gaz: boolean;
  gorne: Wywiad["gorne"];
  drzwiSzafy: Wywiad["drzwiSzafy"];
  potrzeby: Potrzeba[];
  meble: MebelSalonu[];
  umywalka: number;
  slupek: boolean;
};

export const LIMITY_POKOJU = { min: 120, max: 1200 };
export const LIMITY_WYSOKOSCI = { min: 200, max: 400 };

const ogr = (v: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(v)));

/** Typowe wymiary na start dla danego rodzaju projektu. */
export function domyslneSzybkiej(typ: TypProjektu = "kuchnia"): ParametrySzybkiej {
  const w = wywiadDomyslny(typ);
  const pokoj =
    typ === "kuchnia" ? { szer: 360, dlug: 300 } : typ === "szafa" ? { szer: 250, dlug: 300 } : typ === "lazienka" ? { szer: 200, dlug: 250 } : { szer: 400, dlug: 350 };
  return {
    typ,
    uklad: "ciag",
    pokoj,
    wysokosc: w.wysokosc,
    scianaA: pokoj.szer,
    scianaB: pokoj.dlug,
    agd: w.agd,
    gaz: false,
    gorne: w.gorne,
    drzwiSzafy: w.drzwiSzafy,
    potrzeby: w.potrzeby,
    meble: w.meble,
    umywalka: w.umywalka,
    slupek: w.slupek,
  };
}

/** Parametry poprawione do zakresów (zabudowa nie dłuższa niż ściana pokoju). */
export function poprawParametry(p: ParametrySzybkiej): ParametrySzybkiej {
  const pokoj = { szer: ogr(p.pokoj.szer, LIMITY_POKOJU.min, LIMITY_POKOJU.max), dlug: ogr(p.pokoj.dlug, LIMITY_POKOJU.min, LIMITY_POKOJU.max) };
  return {
    ...p,
    uklad: p.typ === "kuchnia" || p.typ === "inne" ? p.uklad : "ciag",
    pokoj,
    wysokosc: ogr(p.wysokosc, LIMITY_WYSOKOSCI.min, LIMITY_WYSOKOSCI.max),
    scianaA: ogr(Math.min(p.scianaA, pokoj.szer), 80, pokoj.szer),
    scianaB: ogr(Math.min(p.scianaB, pokoj.dlug), 80, pokoj.dlug),
  };
}

/** Plan z propozycją mebli dla parametrów (pokój prostokątny, woda przy ścianie A, gniazdka przy AGD). */
export function planSzybkiej(wej: ParametrySzybkiej): PlanKuchni {
  const p = poprawParametry(wej);
  const baza: PlanKuchni = {
    ...pustyPlan(p.uklad),
    scianaA: p.scianaA,
    scianaB: p.uklad === "L" ? p.scianaB : 280,
    pomieszczenie: p.pokoj,
  };
  const w0 = wywiadDomyslny(p.typ);
  const wywiad: Wywiad = {
    ...w0,
    wysokosc: p.wysokosc,
    // Woda pod oknem kuchni zwykle w środku ściany A; w łazience bliżej narożnika.
    woda: p.typ === "kuchnia" ? { sciana: "A", od: Math.round(Math.min(p.scianaA - 60, Math.max(60, p.scianaA * 0.45))) } : w0.woda,
    gaz: p.gaz,
    agd: p.agd,
    gorne: p.gorne,
    drzwiSzafy: p.drzwiSzafy,
    potrzeby: p.potrzeby,
    meble: p.meble,
    umywalka: p.umywalka,
    slupek: p.slupek,
  };
  const plan = ulozPropozycje(p.typ, baza, wywiad);
  return p.typ === "kuchnia" ? { ...plan, wywiad: { ...plan.wywiad!, punkty: propozycjaPunktow(plan) } } : plan;
}

/* ---------- opis słowami → parametry ---------- */

const RODZAJE: [RegExp, TypProjektu, string][] = [
  [/kuchn|aneks/, "kuchnia", "kuchnia"],
  [/garderob|szaf(?!k)|szafa/, "szafa", "szafa"],
  [/łazien|lazien|umywal/, "lazienka", "łazienka"],
  [/komod|rtv|telewiz|salon|sypialn|nocn|rega[łl]/, "komoda", "meble pokojowe"],
];

/** Liczba z opisu w cm: „3,6” albo „3.6 m” → 360, „360” albo „360 cm” → 360. */
function cm(liczba: string, jedn?: string) {
  const v = Number(liczba.replace(",", "."));
  if (!Number.isFinite(v)) return null;
  if (jedn && /^m$|^metr/.test(jedn)) return Math.round(v * 100);
  if (jedn && /^cm/.test(jedn)) return Math.round(v);
  return Math.round(v < 20 ? v * 100 : v);
}

const LICZBA = String.raw`(\d+(?:[.,]\d+)?)\s*(m(?!m)|metr\w*|cm)?`;

/**
 * Rozpoznaje z opisu: rodzaj, układ, wymiary pokoju, długość zabudowy, wysokość, AGD, drzwi szafy i potrzeby.
 * Zwraca nowe parametry i listę rozpoznanych rzeczy (do pokazania pod polem).
 */
export function rozpoznaj(tekst: string, start: ParametrySzybkiej): { p: ParametrySzybkiej; rozpoznane: string[] } {
  // Bez polskich znaków (ł → l, ą → a…): wzorce działają też dla „lodowka”, „zmywarke” pisanych bez ogonków.
  const t = ` ${tekst.toLowerCase().replace(/ł/g, "l").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ")} `;
  const out: string[] = [];
  let p: ParametrySzybkiej = { ...start };
  const rodzaj = RODZAJE.find(([re]) => re.test(t));
  // Inny rodzaj projektu: jego typowe wymiary i wyposażenie (wymiary z opisu nadpiszą je niżej).
  if (rodzaj && rodzaj[1] !== p.typ) p = { ...domyslneSzybkiej(rodzaj[1]), wysokosc: p.wysokosc };
  if (rodzaj) out.push(rodzaj[2]);

  // Układ: „w L”, „narożna” → L; „prosta”, „w linii”, „jednorzędowa” → ciąg.
  if (/\bw\s*(ksztalcie\s*)?(litere\s*)?l\b|naroz?n|\bel\b/.test(t)) {
    p.uklad = "L";
    out.push("układ w L");
  } else if (/prost|w lini|jednorz|ciag/.test(t)) {
    p.uklad = "ciag";
    out.push("ciąg prosty");
  }

  // Pomieszczenie: „3,6 x 2,8”, „360x280 cm”, „3.6 m na 2.8 m”.
  const para = new RegExp(`${LICZBA}\\s*(?:x|×|na|\\*)\\s*${LICZBA}`).exec(t);
  let wymiar: number | null = null;
  if (para) {
    const a = cm(para[1], para[2] ?? para[4]);
    const b = cm(para[3], para[4] ?? para[2]);
    if (a && b) {
      p.pokoj = { szer: a, dlug: b };
      p.scianaA = a;
      p.scianaB = b;
      out.push(`pokój ${a} × ${b} cm`);
    }
  }
  // Długość zabudowy / ściany: „ściana 300”, „zabudowa 3 m”, „szafa 250”, „blat 2,4 m”.
  const zab = new RegExp(`(?:ścian\\w*|scian\\w*|zabudow\\w*|blat\\w*|szaf\\w*|d[łl]ugo[śs][ćc]\\w*)\\s*(?:a\\s*)?(?:ma\\s*)?${LICZBA}`).exec(t);
  if (zab) {
    wymiar = cm(zab[1], zab[2]);
    if (wymiar) {
      p.scianaA = wymiar;
      if (!para) p.pokoj = { ...p.pokoj, szer: Math.max(p.pokoj.szer, wymiar) };
      out.push(`zabudowa ${wymiar} cm`);
    }
  } else if (!para) {
    // Sama liczba z jednostką („kuchnia 3 m”) – długość zabudowy i pokoju.
    const jedna = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(m(?!m)|metr\\w*|cm)\\b`).exec(t);
    const v = jedna ? cm(jedna[1], jedna[2]) : null;
    if (v && v >= 60) {
      p.scianaA = v;
      p.pokoj = { ...p.pokoj, szer: v };
      out.push(`zabudowa ${v} cm`);
    }
  }
  const wys = new RegExp(`(?:wysoko[śs][ćc]\\w*|sufit\\w*|do sufitu)\\s*(?:ma\\s*)?${LICZBA}`).exec(t);
  if (wys) {
    const v = cm(wys[1], wys[2]);
    if (v) {
      p.wysokosc = v;
      out.push(`wysokość ${v} cm`);
    }
  }
  // W L druga ściana: „ściana b 250”.
  const b = new RegExp(`(?:ścian\\w*|scian\\w*)\\s*b\\s*${LICZBA}`).exec(t);
  if (b) {
    const v = cm(b[1], b[2]);
    if (v) {
      p.scianaB = v;
      p.uklad = "L";
      out.push(`ściana B ${v} cm`);
    }
  }

  if (p.typ === "kuchnia") {
    const agd = new Set(p.agd);
    const bez = (re: RegExp) => new RegExp(`bez\\s+(\\w+\\s+)?(?:${re.source})`).test(t);
    const ustaw = (re: RegExp, wl: Agd[], opis: string, wyklucza: Agd[] = []) => {
      if (!re.test(t)) return;
      if (bez(re)) {
        wl.concat(wyklucza).forEach((a) => agd.delete(a));
        out.push(`bez: ${opis.replace(/ (\d+|w .+|pod .+)$/, "")}`);
        return;
      }
      wyklucza.forEach((a) => agd.delete(a));
      wl.forEach((a) => agd.add(a));
      out.push(opis);
    };
    if (/zmywark/.test(t)) {
      const waska = /zmywark\w*\s*(?:na\s*)?45|45\s*(?:cm)?\s*zmywark|w[aą]sk\w*\s*zmywark|zmywark\w*\s*w[aą]sk/.test(t);
      ustaw(/zmywark/, [waska ? "zmywarka-45" : "zmywarka-60"], waska ? "zmywarka 45" : "zmywarka 60", [waska ? "zmywarka-60" : "zmywarka-45"]);
    }
    if (/piekarnik/.test(t)) {
      const dolny = /piekarnik\w*\s*(pod blatem|w szafce dolnej|na dole|pod p[łl]yt)/.test(t);
      ustaw(/piekarnik/, [dolny ? "piekarnik-dolny" : "piekarnik-slupek"], dolny ? "piekarnik pod blatem" : "piekarnik w słupku", [dolny ? "piekarnik-slupek" : "piekarnik-dolny"]);
    }
    if (/lod[óo]wk/.test(t)) {
      const wolna = /wolnostoj|wolno stoj|amerykan|side by side/.test(t);
      ustaw(/lod[óo]wk/, [wolna ? "lodowka-wolnostojaca" : "lodowka-zabudowa"], wolna ? "lodówka wolnostojąca" : "lodówka w zabudowie", [wolna ? "lodowka-zabudowa" : "lodowka-wolnostojaca"]);
    }
    ustaw(/mikrofal/, ["mikrofalowka"], "mikrofalówka");
    ustaw(/okap/, ["okap"], "okap");
    ustaw(/p[łl]yt\w*\s*(grzewcz|indukc|ceramiczn)|indukc/, ["plyta"], "płyta grzewcza");
    if (/gaz/.test(t) && !bez(/gaz/)) {
      p.gaz = true;
      agd.add("plyta");
      out.push("płyta gazowa");
    }
    p.agd = Array.from(agd);
    if (/g[óo]rne\w*\s*(do sufitu)|do sufitu/.test(t)) {
      p.gorne = "sufit";
      out.push("szafki górne do sufitu");
    } else if (/g[óo]rne\w*\s*90|90\s*cm\s*g[óo]rn/.test(t)) {
      p.gorne = "90";
      out.push("szafki górne 90 cm");
    }
  }
  if (p.typ === "szafa") {
    if (/przesuwn/.test(t)) {
      p.drzwiSzafy = "przesuwne";
      out.push("drzwi przesuwne");
    } else if (/uchyln|otwieran|skrzyd/.test(t)) {
      p.drzwiSzafy = "uchylne";
      out.push("drzwi uchylne");
    }
    const potrzeby: [RegExp, Potrzeba, string][] = [
      [/p[łl]aszcz|sukien|d[łl]ugie/, "dlugie", "długie ubrania"],
      [/koszul|marynark|garnitur/, "koszule", "koszule"],
      [/sk[łl]adan|po[śs]ciel|swetr|p[óo][łl]k/, "skladane", "półki"],
      [/szuflad|bielizn/, "szuflady", "szuflady"],
      [/but|obuw/, "buty", "buty"],
    ];
    const zn = potrzeby.filter(([re]) => re.test(t));
    if (zn.length) {
      p.potrzeby = zn.map(([, id]) => id);
      out.push(...zn.map(([, , o]) => o));
    }
  }
  if (p.typ === "komoda") {
    const meble: [RegExp, MebelSalonu, string][] = [
      [/komod/, "komoda", "komoda"],
      [/rtv|telewiz|tv\b/, "rtv", "szafka RTV"],
      [/rega[łl]|ksi[ąa][żz]k/, "regal", "regał"],
      [/nocn/, "nocne", "szafki nocne"],
    ];
    const zn = meble.filter(([re]) => re.test(t));
    if (zn.length) {
      p.meble = zn.map(([, id]) => id);
      out.push(...zn.map(([, , o]) => o));
    }
  }
  if (p.typ === "lazienka") {
    const um = /umywal\w*\s*(\d{2,3})/.exec(t);
    if (um) {
      const v = [60, 80, 100, 120].reduce((a, c) => (Math.abs(c - Number(um[1])) < Math.abs(a - Number(um[1])) ? c : a), 80);
      p.umywalka = v;
      out.push(`umywalka ${v} cm`);
    }
    if (/slup(ek|ka|kiem)/.test(t)) {
      p.slupek = !/bez\s+slupk/.test(t);
      out.push(p.slupek ? "słupek" : "bez słupka");
    }
  }
  return { p: poprawParametry(p), rozpoznane: Array.from(new Set(out)) };
}

/* ---------- gotowe projekty ---------- */

export type GotowyProjekt = { id: string; typ: TypProjektu; nazwa: string; opis: string; parametry: ParametrySzybkiej };

const zDomyslnych = (typ: TypProjektu, z: Partial<ParametrySzybkiej>): ParametrySzybkiej => poprawParametry({ ...domyslneSzybkiej(typ), ...z });

/** Gotowe projekty na start oferty – każdy element poprawisz potem w kreatorze. */
export const GOTOWE_PROJEKTY: GotowyProjekt[] = [
  {
    id: "kuchnia-kawalerka",
    typ: "kuchnia",
    nazwa: "Aneks w kawalerce 240",
    opis: "Ciąg 240 cm: zlew, zmywarka 45, piekarnik pod płytą, okap. Lodówka osobno.",
    parametry: zDomyslnych("kuchnia", { pokoj: { szer: 300, dlug: 250 }, scianaA: 240, agd: ["zmywarka-45", "piekarnik-dolny", "plyta", "okap"] }),
  },
  {
    id: "kuchnia-prosta-300",
    typ: "kuchnia",
    nazwa: "Kuchnia prosta 300",
    opis: "Ciąg 300 cm z piekarnikiem pod płytą, zmywarką 60 i lodówką w zabudowie.",
    parametry: zDomyslnych("kuchnia", { pokoj: { szer: 300, dlug: 280 }, scianaA: 300, agd: ["zmywarka-60", "piekarnik-dolny", "lodowka-zabudowa", "plyta", "okap"] }),
  },
  {
    id: "kuchnia-prosta-400",
    typ: "kuchnia",
    nazwa: "Kuchnia prosta 400",
    opis: "Długi ciąg z dwoma słupkami (lodówka, piekarnik) i mikrofalówką w szafce górnej.",
    parametry: zDomyslnych("kuchnia", { pokoj: { szer: 400, dlug: 300 }, scianaA: 400, agd: ["zmywarka-60", "piekarnik-slupek", "lodowka-zabudowa", "plyta", "okap", "mikrofalowka"] }),
  },
  {
    id: "kuchnia-l-360",
    typ: "kuchnia",
    nazwa: "Kuchnia w L 360 × 260",
    opis: "Narożnik z szafką narożną, słupki na krótszej ścianie, szafki górne 72 cm.",
    parametry: zDomyslnych("kuchnia", { uklad: "L", pokoj: { szer: 360, dlug: 320 }, scianaA: 360, scianaB: 260 }),
  },
  {
    id: "kuchnia-l-duza",
    typ: "kuchnia",
    nazwa: "Duża kuchnia w L do sufitu",
    opis: "L 420 × 320, szafki górne do sufitu, mikrofalówka, dużo szuflad.",
    parametry: zDomyslnych("kuchnia", { uklad: "L", pokoj: { szer: 420, dlug: 380 }, scianaA: 420, scianaB: 320, gorne: "sufit", agd: ["zmywarka-60", "piekarnik-slupek", "lodowka-zabudowa", "plyta", "okap", "mikrofalowka"] }),
  },
  {
    id: "szafa-przesuwna-250",
    typ: "szafa",
    nazwa: "Szafa przesuwna 250",
    opis: "Do sufitu, drzwi przesuwne, drążek i półki na ubrania składane.",
    parametry: zDomyslnych("szafa", { pokoj: { szer: 250, dlug: 300 }, scianaA: 250, drzwiSzafy: "przesuwne", potrzeby: ["dlugie", "skladane"] }),
  },
  {
    id: "garderoba-uchylna-300",
    typ: "szafa",
    nazwa: "Szafa uchylna 300",
    opis: "Trzy moduły po 100 cm: drążki na koszule, szuflady, półki.",
    parametry: zDomyslnych("szafa", { pokoj: { szer: 300, dlug: 300 }, scianaA: 300, drzwiSzafy: "uchylne", potrzeby: ["koszule", "szuflady", "skladane"] }),
  },
  {
    id: "salon-rtv",
    typ: "komoda",
    nazwa: "Ściana RTV z komodą",
    opis: "Szafka RTV 160, komoda 120 i regał.",
    parametry: zDomyslnych("komoda", { pokoj: { szer: 450, dlug: 380 }, scianaA: 450, meble: ["komoda", "rtv", "regal"] }),
  },
  {
    id: "lazienka-80",
    typ: "lazienka",
    nazwa: "Łazienka: umywalka 80 + słupek",
    opis: "Szafka pod umywalkę 80 cm i słupek 40 cm na ręczniki.",
    parametry: zDomyslnych("lazienka", { pokoj: { szer: 220, dlug: 250 }, scianaA: 220, umywalka: 80, slupek: true }),
  },
];

export const gotoweDlaTypu = (typ: TypProjektu) => GOTOWE_PROJEKTY.filter((g) => g.typ === typ || typ === "inne");
export const gotowyPoId = (id: string | null | undefined) => GOTOWE_PROJEKTY.find((g) => g.id === id) ?? null;

/* ---------- przekazanie do kreatora (szybka oferta / gotowy projekt → nowa oferta w kreatorze) ---------- */

export const KLUCZ_SZYBKIEJ = "oprzut:szybka-oferta";

export type SzybkaDoKreatora = { typ: TypProjektu; plan: PlanKuchni; title: string; client: string; contact: string };
