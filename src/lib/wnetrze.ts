/*
 * Wnętrze modułu na wymiar: kolumny (przegrody pionowe), w każdej przestrzenie od dołu – półka, szuflada albo drążek –
 * i rodzaj frontu (drzwi uchylne, przesuwne, otwarty regał). Wspólne dla kreatora, sceny 3D, PDF i serwera
 * (walidacja w parseKuchnia, dopłata w cenie elementu).
 *
 * Geometria (cm), jak w bryle 3D: płyta 1,8 cm, boki na całą wysokość, wieniec dolny i górny między bokami.
 *   światło w poziomie  = szerokość − 2 × 1,8;  kolumna = (światło − przegrody × 1,8) / kolumny
 *   światło w pionie    = wysokość − 2 × 1,8;  suma przestrzeni + półki (1,8 cm między przestrzeniami) = światło
 * Między dwiema szufladami nie ma półki (szuflady jadą na prowadnicach jedna nad drugą).
 *
 * Tu nie ma importów z kuchnia.ts (kuchnia.ts korzysta z tego pliku) – rodzaje są podane jako tekst.
 */
import type { ModulCennik } from "./modul";

export const PLYTA_CM = 1.8;

export type TypPrzestrzeni = "polka" | "szuflada" | "drazek";
export type Przestrzen = { typ: TypPrzestrzeni; /** wysokość w świetle [cm] */ h: number };
export type Kolumna = {
  /** Od dołu do góry. */
  sekcje: Przestrzen[];
  /** Kolumna bez drzwi (otwarta wnęka, np. na telewizor albo w garderobie). */
  bezFrontu?: boolean;
};
export type RodzajFrontu = "drzwi" | "przesuwne" | "otwarte";
export type Wnetrze = {
  front: RodzajFrontu;
  kolumny: Kolumna[];
  /** Szafa: szuflady wewnętrzne za drzwiami (bez własnych frontów). */
  szufladyZaDrzwiami?: boolean;
  /** Id gotowego układu, z którego powstało (do podświetlenia w oknie). */
  preset?: string;
};

export const TYPY_PRZESTRZENI: readonly TypPrzestrzeni[] = ["polka", "szuflada", "drazek"];
export const RODZAJE_FRONTU: readonly RodzajFrontu[] = ["drzwi", "przesuwne", "otwarte"];
export const PRZESTRZEN_LABEL: Record<TypPrzestrzeni, string> = { polka: "Półka", szuflada: "Szuflada", drazek: "Drążek" };
export const FRONT_LABEL: Record<RodzajFrontu, string> = { drzwi: "Drzwi uchylne", przesuwne: "Drzwi przesuwne", otwarte: "Bez drzwi (regał)" };

/** Realne granice (cm). Komunikaty mówią, skąd się biorą. */
export const GRANICE = {
  kolumnaMin: 20,
  polkaUgiecie: 80,
  polkaMax: 100,
  przestrzenMin: 10,
  szufladaH: { min: 8, max: 45 },
  szufladaW: { min: 20, max: 110 },
  szufladaD: 30,
  drazekH: 60,
  drazekD: 50,
  drazekW: { min: 30, max: 120 },
  skrzydloMax: 60,
  drzwiWysokie: 230,
  przesuwneW: 100,
  przesuwneD: 55,
  kolumnyMax: 6,
  sekcjeMax: 12,
} as const;

export type Wymiary = { w: number; h: number; d: number };
type ElementWnetrza = Wymiary & { rodzaj?: string; strefa?: string };

export const swiatloW = (w: number) => w - 2 * PLYTA_CM;
export const swiatloH = (h: number) => h - 2 * PLYTA_CM;
export const szerokoscKolumny = (w: number, n: number) => (swiatloW(w) - (n - 1) * PLYTA_CM) / n;

/** Ile płyt (półek) jest w kolumnie: między przestrzeniami, poza parą szuflada–szuflada. */
export function polkiKolumny(k: Kolumna) {
  let n = 0;
  for (let i = 1; i < k.sekcje.length; i++) if (!(k.sekcje[i - 1].typ === "szuflada" && k.sekcje[i].typ === "szuflada")) n++;
  return n;
}

export const sumaKolumny = (k: Kolumna) => k.sekcje.reduce((s, x) => s + x.h, 0) + polkiKolumny(k) * PLYTA_CM;

const zaokr = (n: number) => Math.round(n * 10) / 10;

/**
 * Układa przestrzenie tak, żeby suma zgadzała się ze światłem. `stale` mają podaną wysokość,
 * pozostałe (h = 0) dzielą resztę po równo. Wynik w 0,1 cm; ostatnia elastyczna bierze zaokrąglenie.
 */
export function rozloz(swiatlo: number, sekcje: Przestrzen[]): Przestrzen[] {
  const k: Kolumna = { sekcje };
  const plyty = polkiKolumny(k) * PLYTA_CM;
  const stale = sekcje.filter((s) => s.h > 0).reduce((a, s) => a + s.h, 0);
  const elastyczne = sekcje.filter((s) => s.h <= 0).length;
  if (!elastyczne) {
    // Wszystko podane – różnicę bierze największa przestrzeń.
    const out = sekcje.map((s) => ({ ...s }));
    const roznica = zaokr(swiatlo - plyty - stale);
    if (Math.abs(roznica) > 0.01 && out.length) {
      let i = 0;
      out.forEach((s, j) => (s.h > out[i].h ? (i = j) : null));
      out[i] = { ...out[i], h: zaokr(out[i].h + roznica) };
    }
    return out;
  }
  const reszta = swiatlo - plyty - stale;
  const kazda = zaokr(reszta / elastyczne);
  let ostatnia = -1;
  const out = sekcje.map((s, i) => {
    if (s.h > 0) return { ...s };
    ostatnia = i;
    return { ...s, h: kazda };
  });
  if (ostatnia >= 0) out[ostatnia] = { ...out[ostatnia], h: zaokr(out[ostatnia].h + (reszta - kazda * elastyczne)) };
  return out;
}

/** Kolumna z n przestrzeniami danego typu po równo. */
const rowno = (swiatlo: number, typ: TypPrzestrzeni, n: number): Kolumna => ({
  sekcje: rozloz(swiatlo, Array.from({ length: Math.max(1, n) }, () => ({ typ, h: 0 }))),
});

const kolumny = (w: number, maks: number) => Math.max(1, Math.ceil(swiatloW(w) / maks));

/* ---------- gotowe układy ---------- */

type Kategoria = "dolna" | "gorna" | "slupek" | "szafa" | "przesuwna" | "komoda" | "regal" | "rtv" | "umywalka";

export function kategoriaWnetrza(el: { rodzaj?: string; strefa?: string }): Kategoria | null {
  const r = el.rodzaj ?? "szafka";
  if (r === "szafa") return "szafa";
  if (r === "szafa-przesuwna") return "przesuwna";
  if (r === "komoda") return "komoda";
  if (r === "regal") return "regal";
  if (r === "rtv") return "rtv";
  if (r === "umywalka") return "umywalka";
  if (r === "szafka" || r === "szuflady" || r === "narozna" || r === "zlew") {
    if (el.strefa === "gorna") return "gorna";
    if (el.strefa === "wysoka") return "slupek";
    if (el.strefa === "dolna") return "dolna";
  }
  return null;
}

/** Czy element ma edytowalne wnętrze (moduł parametryczny z korpusem). */
export const maWnetrze = (el: { rodzaj?: string; strefa?: string; zrodlo?: string }) => el.zrodlo !== "model" && kategoriaWnetrza(el) !== null;

export type PresetWnetrza = { id: string; nazwa: string; opis: string; dla: readonly Kategoria[]; zbuduj: (m: Wymiary) => Wnetrze };

const S = swiatloH;

export const PRESETY_WNETRZA: readonly PresetWnetrza[] = [
  { id: "pusta", nazwa: "Bez półek", opis: "Na kosz, zlew, duże garnki", dla: ["dolna", "gorna"], zbuduj: (m) => ({ front: "drzwi", kolumny: [rowno(S(m.h), "polka", 1)] }) },
  { id: "polka-1", nazwa: "1 półka", opis: "Standard szafki", dla: ["dolna", "gorna"], zbuduj: (m) => ({ front: "drzwi", kolumny: [rowno(S(m.h), "polka", 2)] }) },
  { id: "polki-2", nazwa: "2 półki", opis: "Talerze, kubki, przyprawy", dla: ["dolna", "gorna"], zbuduj: (m) => ({ front: "drzwi", kolumny: [rowno(S(m.h), "polka", 3)] }) },
  { id: "szuflady-2", nazwa: "2 szuflady", opis: "Głębokie na garnki", dla: ["dolna", "umywalka"], zbuduj: (m) => ({ front: "drzwi", kolumny: [rowno(S(m.h), "szuflada", 2)] }) },
  { id: "szuflady-3", nazwa: "3 szuflady", opis: "Sztućce, naczynia, garnki", dla: ["dolna", "komoda"], zbuduj: (m) => ({ front: "drzwi", kolumny: Array.from({ length: m.w > 110 ? 2 : 1 }, () => rowno(S(m.h), "szuflada", 3)) }) },
  { id: "szuflady-4", nazwa: "4 szuflady", opis: "Płytkie i średnie", dla: ["dolna", "komoda"], zbuduj: (m) => ({ front: "drzwi", kolumny: Array.from({ length: m.w > 110 ? 2 : 1 }, () => rowno(S(m.h), "szuflada", 4)) }) },
  {
    id: "szuflada-drzwi",
    nazwa: "Szuflada + drzwi",
    opis: "Szuflada na sztućce nad półką",
    dla: ["dolna"],
    zbuduj: (m) => ({ front: "drzwi", kolumny: [{ sekcje: rozloz(S(m.h), [{ typ: "polka", h: 0 }, { typ: "polka", h: 0 }, { typ: "szuflada", h: 14 }]) }] }),
  },
  { id: "slupek-polki", nazwa: "Półki co ok. 35 cm", opis: "Słupek, spiżarnia", dla: ["slupek", "regal"], zbuduj: (m) => ({ front: "drzwi", kolumny: Array.from({ length: kolumny(m.w, 90) }, () => rowno(S(m.h), "polka", Math.max(2, Math.round(S(m.h) / 37)))) }) },
  {
    id: "slupek-cargo",
    nazwa: "2 szuflady + półki",
    opis: "Szuflady na dole, półki wyżej",
    dla: ["slupek"],
    zbuduj: (m) => ({
      front: "drzwi",
      kolumny: [{ sekcje: rozloz(S(m.h), [{ typ: "szuflada", h: 24 }, { typ: "szuflada", h: 24 }, ...Array.from({ length: Math.max(1, Math.round((S(m.h) - 50) / 37)) }, () => ({ typ: "polka" as const, h: 0 }))]) }],
    }),
  },
  {
    id: "szafa-drazek",
    nazwa: "Drążek + półka",
    opis: "Wieszaki, półka na górze",
    dla: ["szafa", "przesuwna"],
    zbuduj: (m) => ({ front: "drzwi", kolumny: Array.from({ length: kolumny(m.w, 100) }, () => ({ sekcje: rozloz(S(m.h), [{ typ: "drazek", h: 0 }, { typ: "polka", h: 38 }]) })) }),
  },
  {
    id: "szafa-pol-na-pol",
    nazwa: "Drążek | półki",
    opis: "Wieszaki i półki na ubrania składane",
    dla: ["szafa", "przesuwna"],
    zbuduj: (m) => {
      const n = Math.max(2, kolumny(m.w, 100));
      return {
        front: "drzwi",
        kolumny: Array.from({ length: n }, (_, i) =>
          i % 2 === 0 ? { sekcje: rozloz(S(m.h), [{ typ: "drazek", h: 0 }, { typ: "polka", h: 38 }]) } : rowno(S(m.h), "polka", Math.max(3, Math.round(S(m.h) / 36))),
        ),
      };
    },
  },
  {
    id: "szafa-szuflady",
    nazwa: "Szuflady + drążek",
    opis: "2 szuflady wewnętrzne, nad nimi wieszaki",
    dla: ["szafa", "przesuwna"],
    zbuduj: (m) => ({
      front: "drzwi",
      szufladyZaDrzwiami: true,
      kolumny: Array.from({ length: kolumny(m.w, 100) }, () => ({
        sekcje: rozloz(S(m.h), [{ typ: "szuflada", h: 18 }, { typ: "szuflada", h: 18 }, { typ: "drazek", h: 0 }, { typ: "polka", h: 36 }]),
      })),
    }),
  },
  {
    id: "szafa-dwa-drazki",
    nazwa: "Dwa drążki",
    opis: "Koszule i spodnie, jeden nad drugim",
    dla: ["szafa", "przesuwna"],
    zbuduj: (m) => ({ front: "drzwi", kolumny: Array.from({ length: kolumny(m.w, 100) }, () => ({ sekcje: rozloz(S(m.h), [{ typ: "drazek", h: 0 }, { typ: "drazek", h: 0 }, { typ: "polka", h: 34 }]) })) }),
  },
  { id: "szafa-polki", nazwa: "Same półki", opis: "Pościel, ręczniki, pudła", dla: ["szafa", "przesuwna"], zbuduj: (m) => ({ front: "drzwi", kolumny: Array.from({ length: kolumny(m.w, 90) }, () => rowno(S(m.h), "polka", Math.max(3, Math.round(S(m.h) / 38)))) }) },
  {
    id: "komoda-2x3",
    nazwa: "2 × 3 szuflady",
    opis: "Dwie kolumny szuflad",
    dla: ["komoda"],
    zbuduj: (m) => ({ front: "drzwi", kolumny: [rowno(S(m.h), "szuflada", 3), rowno(S(m.h), "szuflada", 3)] }),
  },
  {
    id: "komoda-drzwi-szuflady",
    nazwa: "Drzwi | szuflady | drzwi",
    opis: "Szuflady w środku, półki za drzwiami",
    dla: ["komoda"],
    zbuduj: (m) =>
      m.w >= 120
        ? { front: "drzwi", kolumny: [rowno(S(m.h), "polka", 2), rowno(S(m.h), "szuflada", 3), rowno(S(m.h), "polka", 2)] }
        : { front: "drzwi", kolumny: [rowno(S(m.h), "polka", 2), rowno(S(m.h), "szuflada", 3)] },
  },
  {
    id: "nocna",
    nazwa: "Szuflada + wnęka",
    opis: "Szafka nocna: szuflada nad otwartą półką",
    dla: ["komoda", "rtv"],
    zbuduj: (m) => ({ front: "otwarte", kolumny: [{ sekcje: rozloz(S(m.h), [{ typ: "polka", h: 0 }, { typ: "szuflada", h: 14 }]) }] }),
  },
  { id: "regal-30", nazwa: "Półki co 30 cm", opis: "Książki, segregatory", dla: ["regal"], zbuduj: (m) => ({ front: "otwarte", kolumny: Array.from({ length: kolumny(m.w, 80) }, () => rowno(S(m.h), "polka", Math.max(1, Math.round(S(m.h) / 31.8)))) }) },
  { id: "regal-40", nazwa: "Półki co 40 cm", opis: "Pudła, dekoracje", dla: ["regal"], zbuduj: (m) => ({ front: "otwarte", kolumny: Array.from({ length: kolumny(m.w, 80) }, () => rowno(S(m.h), "polka", Math.max(1, Math.round(S(m.h) / 41.8)))) }) },
  {
    id: "regal-szuflady",
    nazwa: "Szuflady na dole",
    opis: "Dwie szuflady, wyżej półki",
    dla: ["regal"],
    zbuduj: (m) => ({
      front: "otwarte",
      kolumny: Array.from({ length: kolumny(m.w, 80) }, () => ({
        sekcje: rozloz(S(m.h), [{ typ: "szuflada", h: 20 }, { typ: "szuflada", h: 20 }, ...Array.from({ length: Math.max(1, Math.round((S(m.h) - 44) / 36)) }, () => ({ typ: "polka" as const, h: 0 }))]),
      })),
    }),
  },
  { id: "rtv-szuflady", nazwa: "Szuflady", opis: "Szerokie szuflady na całej długości", dla: ["rtv"], zbuduj: (m) => ({ front: "drzwi", kolumny: Array.from({ length: kolumny(m.w, 80) }, () => rowno(S(m.h), "szuflada", 1)) }) },
  {
    id: "rtv-wneka",
    nazwa: "Drzwi | wnęka | drzwi",
    opis: "Otwarta wnęka na sprzęt pośrodku",
    dla: ["rtv"],
    zbuduj: (m) => ({ front: "drzwi", kolumny: [rowno(S(m.h), "polka", 1), { ...rowno(S(m.h), "polka", 2), bezFrontu: true }, rowno(S(m.h), "polka", 1)] }),
  },
  { id: "umywalka-drzwi", nazwa: "Drzwi", opis: "Dostęp do syfonu", dla: ["umywalka"], zbuduj: (m) => ({ front: "drzwi", kolumny: [rowno(S(m.h), "polka", 1)] }) },
];

/**
 * Co można włożyć do środka: drążek tylko w szafie (komoda, szafka kuchenna, RTV czy łazienka go nie mają),
 * szuflada nie w szafce wiszącej. Reszta – półki i szuflady.
 */
export function typyPrzestrzeniDla(el: { rodzaj?: string; strefa?: string }): readonly TypPrzestrzeni[] {
  const k = kategoriaWnetrza(el);
  if (k === "szafa" || k === "przesuwna") return TYPY_PRZESTRZENI;
  if (k === "gorna") return ["polka"];
  return ["polka", "szuflada"];
}

export const presetyDla = (el: { rodzaj?: string; strefa?: string }) => {
  const k = kategoriaWnetrza(el);
  return k ? PRESETY_WNETRZA.filter((p) => p.dla.includes(k)) : [];
};

/** Wnętrze z gotowego układu (z id, żeby okno go podświetliło); przesuwne dla szafy przesuwnej. */
export function zPresetu(p: PresetWnetrza, el: ElementWnetrza): Wnetrze {
  const wn = p.zbuduj(el);
  const front: RodzajFrontu = (el.rodzaj ?? "") === "szafa-przesuwna" ? "przesuwne" : wn.front;
  return { ...wn, front, preset: p.id };
}

/**
 * Wnętrze, gdy element go nie zapisał – tak wygląda bryła w 3D i od niego zaczyna okno.
 * Kuchnia zostaje jak dotąd: jedna półka w środku, szuflady 2–3, szafka pod zlew bez półki.
 */
export function wnetrzeDomyslne(el: ElementWnetrza): Wnetrze | null {
  const k = kategoriaWnetrza(el);
  if (!k) return null;
  const r = el.rodzaj ?? "szafka";
  const id =
    r === "szuflady"
      ? el.h >= 60
        ? "szuflady-3"
        : "szuflady-2"
      : r === "zlew"
        ? "pusta"
        : k === "dolna" || k === "gorna"
          ? el.h < 40
            ? "pusta"
            : "polka-1"
          : k === "slupek"
            ? "slupek-polki"
            : k === "szafa" || k === "przesuwna"
              ? el.d >= GRANICE.drazekD
                ? el.w >= 140
                  ? "szafa-pol-na-pol"
                  : "szafa-drazek"
                : "szafa-polki"
              : k === "komoda"
                ? el.h < 60
                  ? "nocna"
                  : el.w >= 150
                    ? "komoda-drzwi-szuflady"
                    : el.w > 110
                      ? "komoda-2x3"
                      : el.h >= 80
                        ? "szuflady-4"
                        : "szuflady-3"
                : k === "regal"
                  ? "regal-30"
                  : k === "rtv"
                    ? el.w >= 150
                      ? "rtv-wneka"
                      : "rtv-szuflady"
                    : "szuflady-2";
  const p = PRESETY_WNETRZA.find((x) => x.id === id);
  return p ? zPresetu(p, el) : null;
}

/* ---------- sprawdzanie realnych wymiarów ---------- */

export type Ocena = { bledy: string[]; ostrzezenia: string[] };

const cm = (n: number) => `${String(zaokr(n)).replace(".", ",")} cm`;

export function sprawdzWnetrze(el: ElementWnetrza, wn: Wnetrze): Ocena {
  const bledy: string[] = [];
  const ostrzezenia: string[] = [];
  const n = wn.kolumny.length;
  if (n < 1 || n > GRANICE.kolumnyMax) {
    bledy.push(`Kolumn może być od 1 do ${GRANICE.kolumnyMax}.`);
    return { bledy, ostrzezenia };
  }
  const kw = szerokoscKolumny(el.w, n);
  const swH = swiatloH(el.h);
  if (kw < GRANICE.kolumnaMin) bledy.push(`Kolumna wychodzi ${cm(kw)} – min. ${GRANICE.kolumnaMin} cm. Zmniejsz liczbę kolumn albo poszerz moduł.`);
  const dozwolone = typyPrzestrzeniDla(el);
  for (const typ of TYPY_PRZESTRZENI) {
    if (dozwolone.includes(typ) || !wn.kolumny.some((k) => k.sekcje.some((s) => s.typ === typ))) continue;
    bledy.push(typ === "drazek" ? "Drążek jest tylko w szafie – tu daj półkę albo szufladę." : "Szafka wisząca nie ma szuflad – daj półkę.");
  }
  if (wn.front === "przesuwne") {
    if (el.w < GRANICE.przesuwneW) bledy.push(`Drzwi przesuwne mają sens od ${GRANICE.przesuwneW} cm szerokości (dwa skrzydła).`);
    if (el.d < GRANICE.przesuwneD) bledy.push(`Drzwi przesuwne zabierają ok. 10 cm głębokości – szafa musi mieć min. ${GRANICE.przesuwneD} cm.`);
  }
  if (wn.front === "drzwi") {
    const skrzydlo = (el.w / n) / (el.w / n > GRANICE.skrzydloMax ? 2 : 1);
    if (skrzydlo > GRANICE.skrzydloMax) bledy.push(`Skrzydło drzwi wychodzi ${cm(skrzydlo)} – max ${GRANICE.skrzydloMax} cm. Dodaj kolumnę.`);
    if (el.h > GRANICE.drzwiWysokie) ostrzezenia.push(`Drzwi wyższe niż ${GRANICE.drzwiWysokie} cm: potrzebne 4–5 zawiasów i płyta 18 mm może się wygiąć – rozważ podział albo nadstawkę.`);
  }
  wn.kolumny.forEach((k, i) => {
    const nr = n > 1 ? `Kolumna ${i + 1}: ` : "";
    if (!k.sekcje.length || k.sekcje.length > GRANICE.sekcjeMax) {
      bledy.push(`${nr}od 1 do ${GRANICE.sekcjeMax} przestrzeni.`);
      return;
    }
    const suma = sumaKolumny(k);
    if (Math.abs(suma - swH) > 1) bledy.push(`${nr}przestrzenie z półkami mają ${cm(suma)}, a w środku jest ${cm(swH)}.`);
    const maPolki = k.sekcje.some((s) => s.typ === "polka") && k.sekcje.length > 1;
    if (maPolki && kw > GRANICE.polkaMax) bledy.push(`${nr}półka szersza niż ${GRANICE.polkaMax} cm się ugnie – dodaj przegrodę (kolumnę).`);
    else if (polkiKolumny(k) >= 2 && k.sekcje.some((s) => s.typ === "polka") && kw > GRANICE.polkaUgiecie) ostrzezenia.push(`${nr}półka ${cm(kw)} – przy ciężkich rzeczach (książki) lepiej do ${GRANICE.polkaUgiecie} cm albo płyta 25 mm.`);
    k.sekcje.forEach((s, j) => {
      const gdzie = `${nr}${PRZESTRZEN_LABEL[s.typ].toLowerCase()} ${j + 1}`;
      if (!Number.isFinite(s.h) || s.h <= 0) {
        bledy.push(`${gdzie}: brak wysokości.`);
        return;
      }
      if (s.typ === "polka" && s.h < GRANICE.przestrzenMin) bledy.push(`${gdzie}: ${cm(s.h)} – między półkami min. ${GRANICE.przestrzenMin} cm.`);
      if (s.typ === "szuflada") {
        if (s.h < GRANICE.szufladaH.min || s.h > GRANICE.szufladaH.max) bledy.push(`${gdzie}: ${cm(s.h)} – szuflada od ${GRANICE.szufladaH.min} do ${GRANICE.szufladaH.max} cm wysokości.`);
        if (kw < GRANICE.szufladaW.min || kw > GRANICE.szufladaW.max) bledy.push(`${gdzie}: szerokość ${cm(kw)} – prowadnice są na ${GRANICE.szufladaW.min}–${GRANICE.szufladaW.max} cm.`);
        if (el.d < GRANICE.szufladaD) bledy.push(`${gdzie}: moduł ma ${el.d} cm głębokości – szuflada potrzebuje min. ${GRANICE.szufladaD} cm (prowadnice 27 cm).`);
      }
      if (s.typ === "drazek") {
        if (s.h < GRANICE.drazekH) bledy.push(`${gdzie}: ${cm(s.h)} – pod drążkiem min. ${GRANICE.drazekH} cm (krótkie ubrania); koszule ok. 100 cm, płaszcze 150 cm.`);
        if (el.d < GRANICE.drazekD) bledy.push(`${gdzie}: na drążek trzeba min. ${GRANICE.drazekD} cm głębokości (wieszak ma ok. 45 cm). Daj półki albo pogłęb szafę.`);
        if (kw < GRANICE.drazekW.min || kw > GRANICE.drazekW.max) bledy.push(`${gdzie}: drążek ${cm(kw)} – od ${GRANICE.drazekW.min} do ${GRANICE.drazekW.max} cm (dłuższy się ugnie).`);
      }
    });
  });
  if ((el.rodzaj ?? "") === "umywalka" && wn.kolumny.some((k) => k.sekcje[k.sekcje.length - 1]?.typ === "szuflada")) {
    ostrzezenia.push("Pod umywalką górna szuflada potrzebuje wycięcia na syfon.");
  }
  return { bledy, ostrzezenia };
}

/* ---------- walidacja z panelu (serwer) ---------- */

/** Struktura z JSON-a; rzuca Error z komunikatem. Sprawdzenie wymiarów robi sprawdzWnetrze. */
export function parseWnetrze(v: unknown, gdzie: string): Wnetrze {
  const zle = (m: string): never => {
    throw new Error(`${gdzie}: ${m}`);
  };
  if (!v || typeof v !== "object" || Array.isArray(v)) zle("wnętrze ma zły format.");
  const o = v as Record<string, unknown>;
  if (!RODZAJE_FRONTU.includes(o.front as RodzajFrontu)) zle("nieznany rodzaj frontu.");
  if (!Array.isArray(o.kolumny) || !o.kolumny.length || o.kolumny.length > GRANICE.kolumnyMax) zle(`od 1 do ${GRANICE.kolumnyMax} kolumn.`);
  const kolumny = (o.kolumny as unknown[]).map((k) => {
    if (!k || typeof k !== "object" || Array.isArray(k)) zle("kolumna ma zły format.");
    const kk = k as Record<string, unknown>;
    if (!Array.isArray(kk.sekcje) || !kk.sekcje.length || kk.sekcje.length > GRANICE.sekcjeMax) zle(`od 1 do ${GRANICE.sekcjeMax} przestrzeni w kolumnie.`);
    const sekcje = (kk.sekcje as unknown[]).map((s) => {
      if (!s || typeof s !== "object" || Array.isArray(s)) zle("przestrzeń ma zły format.");
      const ss = s as Record<string, unknown>;
      if (!TYPY_PRZESTRZENI.includes(ss.typ as TypPrzestrzeni)) zle("nieznany rodzaj przestrzeni.");
      if (typeof ss.h !== "number" || !Number.isFinite(ss.h) || ss.h <= 0 || ss.h > 300) zle("wysokość przestrzeni 0–300 cm.");
      return { typ: ss.typ as TypPrzestrzeni, h: zaokr(ss.h as number) };
    });
    return { sekcje, ...(kk.bezFrontu === true ? { bezFrontu: true } : {}) };
  });
  const preset = typeof o.preset === "string" && /^[a-z0-9-]{1,40}$/.test(o.preset) ? o.preset : undefined;
  return {
    front: o.front as RodzajFrontu,
    kolumny,
    ...(o.szufladyZaDrzwiami === true ? { szufladyZaDrzwiami: true } : {}),
    ...(preset ? { preset } : {}),
  };
}

/**
 * Po zmianie wymiaru modułu: ta sama liczba przestrzeni, szuflady i półki górne zostają, elastyczne dzielą resztę.
 * Gdy po przeliczeniu wnętrze nie ma sensu (np. drążek w płytkiej szafie) – null (wraca układ domyślny).
 */
export function dopasujWnetrze(wn: Wnetrze, el: ElementWnetrza): Wnetrze | null {
  const swH = swiatloH(el.h);
  const kolumny = wn.kolumny.map((k) => {
    // Elastyczne: wszystko poza szufladami i najwyższą półką „na górze” (ona zostaje, jeśli jest mniejsza niż połowa).
    const sekcje = k.sekcje.map((s, i) => ({ ...s, h: s.typ === "szuflada" || (i === k.sekcje.length - 1 && k.sekcje.length > 1 && s.typ === "polka" && s.h < swH / 2) ? s.h : 0 }));
    return { ...k, sekcje: rozloz(swH, sekcje) };
  });
  const out: Wnetrze = { ...wn, kolumny };
  return sprawdzWnetrze(el, out).bledy.length ? null : out;
}

/* ---------- liczenie (cena, opis, PDF) ---------- */

export type Zliczenie = { kolumny: number; polki: number; szuflady: number; drazki: number; przegrody: number; plytaM2: number };

/** Płyta wnętrza ponad standard szafki (standard: jedna półka szer. × gł., jak w modulPowierzchnie). */
export function zliczWnetrze(el: Wymiary, wn: Wnetrze): Zliczenie {
  const n = wn.kolumny.length;
  const kw = szerokoscKolumny(el.w, n) / 100;
  const d = el.d / 100;
  let polki = 0;
  let szuflady = 0;
  let drazki = 0;
  let plyta = (n - 1) * (swiatloH(el.h) / 100) * d;
  for (const k of wn.kolumny) {
    const p = polkiKolumny(k);
    polki += p;
    plyta += p * kw * d;
    for (const s of k.sekcje) {
      if (s.typ === "szuflada") {
        szuflady++;
        // Skrzynka: 2 boki + tył + przód wewnętrzny (wys. ok. 75% frontu), dno HDF pomijamy.
        const hb = Math.min(0.2, (s.h / 100) * 0.75);
        plyta += 2 * (d * 0.85) * hb + 2 * kw * hb;
      }
      if (s.typ === "drazek") drazki++;
    }
  }
  const standard = (el.w / 100) * d;
  return { kolumny: n, polki, szuflady, drazki, przegrody: n - 1, plytaM2: Math.max(0, plyta - standard) };
}

/** Dopłata za wnętrze [zł netto]: płyta ponad standard + prowadnice szuflad + drążki (cennik firmy). */
export function doplataWnetrza(el: Wymiary, wn: Wnetrze | null | undefined, c: ModulCennik, domyslne: { szuflada: number; drazek: number }) {
  if (!wn) return 0;
  const z = zliczWnetrze(el, wn);
  return Math.round(z.plytaM2 * c.plytaM2 + z.szuflady * (c.szuflada ?? domyslne.szuflada) + z.drazki * (c.drazek ?? domyslne.drazek));
}

/** Krótki opis do listy, PDF i właściwości: „2 kolumny · 3 szuflady · drążek · drzwi przesuwne”. */
export function opisWnetrza(wn: Wnetrze): string {
  // Liczymy płyty (półki), nie przestrzenie: między szufladami półki nie ma, półka nad drążkiem jest.
  const z = { polki: 0, szuflady: 0, drazki: 0 };
  for (const k of wn.kolumny) {
    z.polki += polkiKolumny(k);
    for (const s of k.sekcje) {
      if (s.typ === "szuflada") z.szuflady++;
      if (s.typ === "drazek") z.drazki++;
    }
  }
  const czesci: string[] = [];
  if (wn.kolumny.length > 1) czesci.push(`${wn.kolumny.length} kolumny`);
  if (z.polki) czesci.push(z.polki === 1 ? "1 półka" : z.polki < 5 ? `${z.polki} półki` : `${z.polki} półek`);
  if (z.szuflady) czesci.push(z.szuflady === 1 ? "1 szuflada" : z.szuflady < 5 ? `${z.szuflady} szuflady` : `${z.szuflady} szuflad`);
  if (z.drazki) czesci.push(z.drazki === 1 ? "drążek" : `${z.drazki} drążki`);
  if (!z.polki && !z.szuflady && !z.drazki) czesci.push("bez półek");
  const saDrzwi = wn.front !== "drzwi" || wn.szufladyZaDrzwiami || wn.kolumny.some((k) => !k.bezFrontu && k.sekcje.some((x) => x.typ !== "szuflada"));
  if (saDrzwi) czesci.push(wn.front === "otwarte" && z.szuflady ? "bez drzwi" : FRONT_LABEL[wn.front].toLowerCase());
  if (wn.kolumny.some((k) => k.bezFrontu) && wn.front === "drzwi") czesci.push("z otwartą wnęką");
  return czesci.join(" · ");
}
