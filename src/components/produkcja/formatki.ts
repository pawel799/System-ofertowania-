/*
 * Formatki do produkcji z projektu kreatora: lista elementów do cięcia z płyty, okleina, okucia i blaty.
 *
 * Geometria jak w bryle 3D (MebelParametryczny) i na rysunku technicznym (frontyElementu), w milimetrach:
 *   płyta korpusu 18 mm, boki na całą wysokość, wieńce między bokami, plecy HDF 3 mm nakładane,
 *   przegrody i półki w kolumnach z wnetrze.ts, fronty z podziału z rysunku minus szczelina.
 * Wymiary formatki: `dl` – wzdłuż słojów (dla płyt bez słojów dłuższy bok, rozkrój może obracać), `szer` – w poprzek.
 * Okleina: d1, d2 – krawędzie długości `dl`; s1, s2 – krawędzie długości `szer`. Wymiary są gotowe (z okleiną).
 *
 * Materiał każdej części (fronty, boki, środek) podaje wywołujący – kreator zna katalog firmy i kolory mebli.
 */
import { MEBLE, rect, rodzajElementu, WYPOSAZENIE, type ElementKuchni, type PlanKuchni } from "@/lib/kuchnia";
import { wnetrzeDomyslne, type Wnetrze } from "@/lib/wnetrze";
import type { CzescMebla } from "@/lib/kolory";
import { frontyElementu } from "../rysunek/rysunekTechniczny";

export type Okleina = { d1: boolean; d2: boolean; s1: boolean; s2: boolean };
export const BEZ_OKLEINY: Okleina = { d1: false, d2: false, s1: false, s2: false };
const DOOKOLA: Okleina = { d1: true, d2: true, s1: true, s2: true };
const PRZOD: Okleina = { d1: true, d2: false, s1: false, s2: false };

export type RodzajMaterialu = "plyta" | "hdf";

export type MaterialFormatki = {
  /** Klucz grupy w rozkroju (ten sam materiał = te same arkusze). */
  klucz: string;
  nazwa: string;
  /** Grubość w mm (do opisu i CSV). */
  grubosc: number;
  /** Płyta ze słojami – formatki nie obracają się na arkuszu. */
  sloje: boolean;
  rodzaj: RodzajMaterialu;
};

export type Formatka = {
  id: string;
  /** „3. Szafka dolna 60” – numer jak w pozycjach oferty. */
  mebel: string;
  element: string;
  material: string;
  dl: number;
  szer: number;
  ilosc: number;
  okleina: Okleina;
  uwagi?: string;
};

export type Blat = { mebel: string; dl: number; szer: number; uwagi?: string };
export type Okucie = { nazwa: string; ilosc: number; jednostka: "szt." | "kpl." | "mm" };

export type ListaFormatek = {
  formatki: Formatka[];
  materialy: MaterialFormatki[];
  blaty: Blat[];
  blatNazwa: string;
  okucia: Okucie[];
  /** Pozycje bez formatek: modele 3D i urządzenia AGD. */
  pominiete: { mebel: string; powod: string }[];
};

export type UstawieniaFormatek = {
  /** Szczelina między frontami [mm] – front = pole minus szczelina. */
  szczelina: number;
  /** Skrzynki szuflad: z płyty (boki, przód, tył, dno HDF) albo systemowe (tylko fronty). */
  szuflady: "plyta" | "systemowe";
  /** Plecy z HDF nakładane (minus 2 mm z każdej strony) albo bez pleców (np. regał przy ścianie). */
  plecy: "hdf" | "brak";
  /** Nawis blatu nad frontami [mm]. */
  nawisBlatu: number;
};

export const USTAWIENIA_DOMYSLNE: UstawieniaFormatek = { szczelina: 3, szuflady: "plyta", plecy: "hdf", nawisBlatu: 20 };

export type ZrodloMaterialow = {
  /** Materiał części mebla (front, boki, środek). */
  material: (el: ElementKuchni, czesc: CzescMebla) => MaterialFormatki;
  /** Uchwyty tego mebla: nazwa do zestawienia; bez = bezuchwytowe (push-to-open). */
  uchwyt?: (el: ElementKuchni) => { nazwa: string; bez: boolean };
  /** Nazwa blatu z oferty. */
  blat?: string;
};

export const HDF: MaterialFormatki = { klucz: "hdf-3", nazwa: "HDF 3 mm biały", grubosc: 3, sloje: false, rodzaj: "hdf" };

/** Płyta 18 mm – tak liczy bryła 3D i wnetrze.ts (PLYTA_CM). */
const T = 18;
const PLECY = 3;

/** Nazwa wskazuje na dekor drewna – słoje trzeba trzymać. */
export const DREWNO_RE = /d[aą]b|orzech|jesion|buk|sosn|olch|wi[aą]z|akacj|tek|drewn|wood|oak|walnut|ash|beech|pine|fornir|okleina natur/i;

const mm = (cm: number) => Math.round(cm * 10);
const zaokr = (n: number) => Math.round(n);

type Zbieracz = {
  dodaj: (mebel: string, element: string, mat: MaterialFormatki, dl: number, szer: number, okl: Okleina, ilosc?: number, uwagi?: string) => void;
  okucie: (nazwa: string, ilosc: number, jednostka?: Okucie["jednostka"]) => void;
};

function zbieracz(materialy: Map<string, MaterialFormatki>, formatki: Formatka[], okucia: Map<string, Okucie>): Zbieracz {
  return {
    dodaj(mebel, element, mat, dl, szer, okl, ilosc = 1, uwagi) {
      if (dl <= 0 || szer <= 0 || ilosc <= 0) return;
      if (!materialy.has(mat.klucz)) materialy.set(mat.klucz, mat);
      const d = zaokr(dl);
      const s = zaokr(szer);
      const tak = formatki.find(
        (f) =>
          f.mebel === mebel &&
          f.element === element &&
          f.material === mat.klucz &&
          f.dl === d &&
          f.szer === s &&
          f.uwagi === uwagi &&
          f.okleina.d1 === okl.d1 &&
          f.okleina.d2 === okl.d2 &&
          f.okleina.s1 === okl.s1 &&
          f.okleina.s2 === okl.s2,
      );
      if (tak) tak.ilosc += ilosc;
      else formatki.push({ id: `f${formatki.length + 1}`, mebel, element, material: mat.klucz, dl: d, szer: s, ilosc, okleina: { ...okl }, ...(uwagi ? { uwagi } : {}) });
    },
    okucie(nazwa, ilosc, jednostka = "szt.") {
      if (ilosc <= 0) return;
      const o = okucia.get(nazwa);
      if (o) o.ilosc += ilosc;
      else okucia.set(nazwa, { nazwa, ilosc, jednostka });
    },
  };
}

/** Zawiasy na skrzydło wg wysokości (jak w katalogach producentów). */
export const zawiasyNaDrzwi = (h: number) => (h <= 900 ? 2 : h <= 1600 ? 3 : h <= 2000 ? 4 : 5);

/** Długość prowadnicy szuflady [mm] z głębokości korpusu: najbliższa mniejsza pełna 50-tka. */
export const prowadnica = (dKorpusu: number) => Math.max(250, Math.min(650, Math.floor((dKorpusu - 40) / 50) * 50));

/** Przestrzenie kolumny od dołu (mm) – jak przestrzenie() w bryle 3D. */
function przestrzenie(kol: Wnetrze["kolumny"][number], H: number) {
  let y = T;
  const out: { typ: string; y0: number; y1: number; plytaNad: boolean }[] = [];
  kol.sekcje.forEach((s, i) => {
    const y0 = y;
    const y1 = y0 + s.h * 10;
    const nast = kol.sekcje[i + 1];
    const plytaNad = !!nast && !(s.typ === "szuflada" && nast.typ === "szuflada");
    out.push({ typ: s.typ, y0, y1, plytaNad });
    y = plytaNad ? y1 + T : y1;
  });
  if (out.length) out[out.length - 1].y1 = H - T;
  return out;
}

/** Korpus: boki, wieńce (zlew – listwy), plecy. */
function korpus(z: Zbieracz, mebel: string, W: number, H: number, D: number, mat: MaterialFormatki, u: UstawieniaFormatek, zlew = false) {
  const g = D - (u.plecy === "hdf" ? PLECY : 0);
  z.dodaj(mebel, "Bok", mat, H, g, PRZOD, 2);
  z.dodaj(mebel, "Wieniec dolny", mat, W - 2 * T, g, PRZOD);
  if (zlew) z.dodaj(mebel, "Listwa górna", mat, W - 2 * T, 100, PRZOD, 2, "zamiast wieńca – pod zlewem");
  else z.dodaj(mebel, "Wieniec górny", mat, W - 2 * T, g, PRZOD);
  if (u.plecy === "hdf") z.dodaj(mebel, "Plecy", HDF, H - 4, W - 4, BEZ_OKLEINY, 1, "nakładane");
}

function front(z: Zbieracz, mebel: string, element: string, mat: MaterialFormatki, wys: number, szer: number, u: UstawieniaFormatek, uwagi?: string) {
  z.dodaj(mebel, element, mat, wys - u.szczelina, szer - u.szczelina, DOOKOLA, 1, uwagi);
}

/** Moduł na wymiar z wnętrzem (szafki, szuflady, narożna, pod zlew, szafy, komody, regały…). */
function parametryczny(z: Zbieracz, mebel: string, el: ElementKuchni, mat: (c: CzescMebla) => MaterialFormatki, u: UstawieniaFormatek, uchwyt: { nazwa: string; bez: boolean } | null) {
  const wn = el.wnetrze ?? wnetrzeDomyslne(el);
  if (!wn) return false;
  const W = mm(el.w);
  const H = mm(el.h);
  const D = mm(el.d);
  const g = D - (u.plecy === "hdf" ? PLECY : 0);
  const mK = mat("korpus");
  const mS = mat("srodek");
  const mF = mat("front");
  korpus(z, mebel, W, H, D, mK, u, rodzajElementu(el) === "zlew");
  const n = wn.kolumny.length;
  const colW = (W - 2 * T - (n - 1) * T) / n;
  if (n > 1) z.dodaj(mebel, "Przegroda", mS, H - 2 * T, g - 10, PRZOD, n - 1);
  const zewnetrzneSzuflady = wn.front !== "przesuwne" && !wn.szufladyZaDrzwiami;
  for (const kol of wn.kolumny) {
    const prz = przestrzenie(kol, H);
    for (const s of prz) {
      if (s.plytaNad) {
        z.dodaj(mebel, "Półka", mS, colW, g - 20, PRZOD);
        z.okucie("Podpórki półek", 4);
      }
      if (s.typ === "drazek") z.okucie(`Drążek ${zaokr(colW)} mm z uchwytami`, 1, "kpl.");
      if (s.typ === "szuflada") {
        const bd = prowadnica(g);
        z.okucie(`Prowadnice ${bd} mm`, 1, "kpl.");
        if (u.szuflady === "plyta") {
          const hb = Math.max(50, Math.min(220, Math.round((s.y1 - s.y0) * 0.78)));
          const bw = colW - 26;
          z.dodaj(mebel, "Szuflada – bok", mS, bd, hb, PRZOD, 2);
          z.dodaj(mebel, "Szuflada – przód/tył", mS, bw - 2 * T, hb, PRZOD, 2);
          z.dodaj(mebel, "Szuflada – dno", HDF, bd, bw, BEZ_OKLEINY);
        }
        if (!zewnetrzneSzuflady) z.okucie("Szuflada wewnętrzna (za drzwiami)", 1);
      }
    }
  }
  // Fronty: podział jak na rysunku technicznym (cm → mm).
  const fronty = frontyElementu(el);
  const zFrontem = fronty.filter((f) => f.typ === "drzwi" || f.typ === "szuflada" || f.typ === "przesuwne");
  for (const f of zFrontem) {
    const wys = mm(f.y1 - f.y0);
    const szer = mm(f.x1 - f.x0);
    if (f.typ === "przesuwne") {
      z.dodaj(mebel, "Drzwi przesuwne – wypełnienie", mF, H - 20, szer + 20, DOOKOLA, 1, "wymiar wg systemu drzwi");
      continue;
    }
    front(z, mebel, f.typ === "drzwi" ? "Front – drzwi" : "Front – szuflada", mF, wys, szer, u);
    if (f.typ === "drzwi") z.okucie("Zawiasy puszkowe z prowadnikami", zawiasyNaDrzwi(wys));
  }
  const przesuwne = zFrontem.filter((f) => f.typ === "przesuwne").length;
  if (przesuwne) z.okucie(`System drzwi przesuwnych (${przesuwne} skrz.) na szer. ${W} mm`, 1, "kpl.");
  if (uchwyt && !uchwyt.bez) z.okucie(`Uchwyty: ${uchwyt.nazwa}`, zFrontem.length);
  if (uchwyt?.bez) z.okucie("Push-to-open / bez uchwytów", zFrontem.filter((f) => f.typ !== "przesuwne").length);
  return true;
}

/** Słupek albo szafka z piekarnikiem: korpus, półki pod i nad piekarnikiem, fronty nad i pod (proporcje jak w 3D). */
function piekarnik(z: Zbieracz, mebel: string, el: ElementKuchni, mat: (c: CzescMebla) => MaterialFormatki, u: UstawieniaFormatek, uchwyt: { nazwa: string; bez: boolean } | null) {
  const W = mm(el.w);
  const H = mm(el.h);
  const D = mm(el.d);
  const g = D - (u.plecy === "hdf" ? PLECY : 0);
  korpus(z, mebel, W, H, D, mat("korpus"), u);
  const wysoki = el.strefa === "wysoka";
  z.dodaj(mebel, "Półka pod piekarnik", mat("srodek"), W - 2 * T, g - 20, PRZOD, 1, "pełna głębokość – nośna");
  let frontow = 0;
  if (wysoki) {
    const od = Math.round(H * 0.16);
    const doo = Math.round(H * 0.52);
    z.dodaj(mebel, "Półka nad piekarnikiem", mat("srodek"), W - 2 * T, g - 20, PRZOD);
    front(z, mebel, "Front – dół (szuflada)", mat("front"), od, W, u);
    front(z, mebel, "Front – góra (drzwi)", mat("front"), H - doo, W, u);
    z.okucie(`Prowadnice ${prowadnica(g)} mm`, 1, "kpl.");
    z.okucie("Zawiasy puszkowe z prowadnikami", zawiasyNaDrzwi(H - doo));
    frontow = 2;
  }
  if (uchwyt && !uchwyt.bez && frontow) z.okucie(`Uchwyty: ${uchwyt.nazwa}`, frontow);
  z.okucie("Piekarnik – wnęka 560–568 mm, sprawdź instrukcję AGD", 1);
}

/** Zabudowa lodówki / zmywarki: korpus (lodówka) i fronty mocowane do urządzenia. */
function zabudowaAgd(z: Zbieracz, mebel: string, el: ElementKuchni, mat: (c: CzescMebla) => MaterialFormatki, u: UstawieniaFormatek, uchwyt: { nazwa: string; bez: boolean } | null) {
  const W = mm(el.w);
  const H = mm(el.h);
  const D = mm(el.d);
  const r = rodzajElementu(el);
  if (r === "lodowka-zabudowa") {
    korpus(z, mebel, W, H, D, mat("korpus"), u);
    front(z, mebel, "Front lodówki", mat("front"), H, W, u, "podział wg instrukcji lodówki (zwykle 2 fronty)");
    z.okucie("Prowadnice frontu lodówki (kpl. z AGD)", 1, "kpl.");
  } else {
    front(z, mebel, "Front zmywarki", mat("front"), H, W, u, "mocowanie wg instrukcji zmywarki");
  }
  if (uchwyt && !uchwyt.bez) z.okucie(`Uchwyty: ${uchwyt.nazwa}`, 1);
}

const NOZKI = new Set(["szafka", "szuflady", "narozna", "zlew", "piekarnik", "lodowka-zabudowa"]);

/** Blaty: ciągi szafek dolnych wzdłuż ścian (sklejone, gdy stykają się), głębokość + nawis. */
function blatyPlanu(plan: PlanKuchni, u: UstawieniaFormatek, numer: Map<string, string>): Blat[] {
  const out: Blat[] = [];
  const dolne = plan.elementy.filter((e) => e.strefa === "dolna" && !MEBLE.has(rodzajElementu(e)) && !WYPOSAZENIE.has(rodzajElementu(e)));
  type Odc = { a0: number; a1: number; d: number; nazwy: string[] };
  const ciagi = new Map<string, Odc[]>();
  for (const e of dolne) {
    const r = rect(e);
    const wzdluzX = e.rot % 180 === 0;
    const klucz = wzdluzX ? `x:${Math.round(e.rot === 0 ? r.z0 : r.z1)}` : `z:${Math.round(e.rot === 90 ? r.x0 : r.x1)}`;
    const lista = ciagi.get(klucz) ?? [];
    lista.push({ a0: wzdluzX ? r.x0 : r.z0, a1: wzdluzX ? r.x1 : r.z1, d: e.d, nazwy: [numer.get(e.id) ?? e.nazwa] });
    ciagi.set(klucz, lista);
  }
  for (const [, lista] of Array.from(ciagi.entries()).sort(([a], [b]) => a.localeCompare(b))) {
    lista.sort((a, b) => a.a0 - b.a0);
    const sklejone: Odc[] = [];
    for (const o of lista) {
      const ost = sklejone[sklejone.length - 1];
      if (ost && o.a0 <= ost.a1 + 1) {
        ost.a1 = Math.max(ost.a1, o.a1);
        ost.d = Math.max(ost.d, o.d);
        ost.nazwy.push(...o.nazwy);
      } else sklejone.push({ ...o, nazwy: [...o.nazwy] });
    }
    for (const o of sklejone) {
      const nr = o.nazwy.map((x) => x.split(".")[0]).join(", ");
      out.push({ mebel: o.nazwy.length > 1 ? `nad poz. ${nr}` : o.nazwy[0], dl: mm(o.a1 - o.a0), szer: mm(o.d) + u.nawisBlatu });
    }
  }
  // Osobne elementy „blat” (np. wyspa, nadstawka).
  for (const e of plan.elementy) if (rodzajElementu(e) === "blat") out.push({ mebel: numer.get(e.id) ?? e.nazwa, dl: mm(e.w), szer: mm(e.d) });
  // L / U: blaty z dwóch ścian spotykają się w narożniku – długości liczone po szafkach, łączenie do ustalenia.
  const kierunki = new Set(Array.from(ciagi.keys()).map((k) => k[0]));
  if (kierunki.size > 1) out.forEach((b) => (b.uwagi = "narożnik – dolicz zakładkę na łączenie blatów"));
  return out;
}

/** Lista formatek z planu. */
export function formatkiProjektu(plan: PlanKuchni, zrodlo: ZrodloMaterialow, u: UstawieniaFormatek = USTAWIENIA_DOMYSLNE): ListaFormatek {
  const materialy = new Map<string, MaterialFormatki>();
  const formatki: Formatka[] = [];
  const okucia = new Map<string, Okucie>();
  const pominiete: ListaFormatek["pominiete"] = [];
  const z = zbieracz(materialy, formatki, okucia);
  const numer = new Map(plan.elementy.map((e, i) => [e.id, `${i + 1}. ${e.nazwa}`]));
  for (const el of plan.elementy) {
    const mebel = numer.get(el.id)!;
    const r = rodzajElementu(el);
    const mat = (c: CzescMebla) => zrodlo.material(el, c);
    const uchwyt = zrodlo.uchwyt?.(el) ?? null;
    if (el.zrodlo === "model") {
      pominiete.push({ mebel, powod: WYPOSAZENIE.has(r) ? "wyposażenie – nie jest meblem do wykonania" : "gotowy model 3D – formatki z modelu (zakładka „Z modelu 3D”)" });
      continue;
    }
    if (r === "piekarnik") piekarnik(z, mebel, el, mat, u, uchwyt);
    else if (r === "lodowka-zabudowa" || r === "zmywarka") zabudowaAgd(z, mebel, el, mat, u, uchwyt);
    else if (r === "blat") continue;
    else if (!parametryczny(z, mebel, el, mat, u, uchwyt)) {
      pominiete.push({ mebel, powod: "urządzenie / dodatek – bez formatek" });
      continue;
    }
    if (NOZKI.has(r) && (el.strefa === "dolna" || el.strefa === "wysoka") && !MEBLE.has(r)) z.okucie("Nóżki meblowe 100 mm", el.w > 90 ? 6 : 4);
    if (el.strefa === "gorna" && r !== "okap" && r !== "okap-podszafkowy") z.okucie("Zawieszki szafek górnych", 2);
  }
  return {
    formatki,
    materialy: Array.from(materialy.values()),
    blaty: blatyPlanu(plan, u, numer),
    blatNazwa: zrodlo.blat ?? "Blat",
    okucia: Array.from(okucia.values()),
    pominiete,
  };
}

/* ---------- podsumowania ---------- */

/** Okleina w metrach bieżących dla jednej formatki (z ilością). */
export const okleinaMb = (f: Pick<Formatka, "dl" | "szer" | "ilosc" | "okleina">) =>
  (((f.okleina.d1 ? f.dl : 0) + (f.okleina.d2 ? f.dl : 0) + (f.okleina.s1 ? f.szer : 0) + (f.okleina.s2 ? f.szer : 0)) * f.ilosc) / 1000;

export type PodsumowanieMaterialu = { material: MaterialFormatki; sztuk: number; m2: number; okleinaMb: number };

export function podsumowanie(lista: Pick<ListaFormatek, "formatki" | "materialy">): PodsumowanieMaterialu[] {
  return lista.materialy.map((m) => {
    const f = lista.formatki.filter((x) => x.material === m.klucz);
    return {
      material: m,
      sztuk: f.reduce((s, x) => s + x.ilosc, 0),
      m2: f.reduce((s, x) => s + (x.dl * x.szer * x.ilosc) / 1e6, 0),
      okleinaMb: f.reduce((s, x) => s + okleinaMb(x), 0),
    };
  });
}

/** Blaty na płyty handlowe (domyślnie 4100 mm): pierwszy pasujący, od najdłuższych; dłuższe niż płyta – łączenie. */
export function blatyNaPlyty(blaty: readonly Blat[], dlPlyty = 4100) {
  const plyty: { reszta: number; kawalki: Blat[] }[] = [];
  const lacz: Blat[] = [];
  for (const b of [...blaty].sort((a, c) => c.dl - a.dl)) {
    if (b.dl > dlPlyty) {
      lacz.push(b);
      plyty.push({ reszta: 0, kawalki: [b] });
      continue;
    }
    const p = plyty.find((x) => x.reszta >= b.dl + 4);
    if (p) {
      p.reszta -= b.dl + 4;
      p.kawalki.push(b);
    } else plyty.push({ reszta: dlPlyty - b.dl, kawalki: [b] });
  }
  return { plyty: plyty.length + lacz.reduce((s, b) => s + Math.ceil(b.dl / dlPlyty) - 1, 0), lacz };
}
