/*
 * Kolory całego mebla: trzy części, każda z własnym kolorem (próbki z tej samej listy co fronty – płyty i RAL):
 *   front  – „Fronty (drzwi i szuflady)”,
 *   korpus – „Boki i obudowa” (boki, wieniec górny i dolny; w modelach 3D węzeł „Korpus”),
 *   srodek – „Środek (półki i przegrody)” (półki, przegrody, skrzynki szuflad).
 *
 * Domyślnie cały mebel jest w kolorze frontów (boki „jak fronty”, środek „jak boki”).
 * Projekt ma kolory wspólne (front z oferty + plan.kolory), a każdy mebel może mieć własne (element.kolory).
 * Dopłata za kolor liczy się według powierzchni: dopłata próbki × udział jej m² we wszystkich kolorowanych m².
 * Cały projekt w jednym kolorze = dokładnie dopłata próbki (jak dotąd).
 *
 * Bez importów z kuchnia.ts (kuchnia.ts korzysta z tego pliku) – elementy podane strukturalnie.
 */
import { kategoriaWnetrza, wnetrzeDomyslne, zliczWnetrze, type Wnetrze } from "./wnetrze";

export type CzescMebla = "front" | "korpus" | "srodek";
export const CZESCI: readonly CzescMebla[] = ["front", "korpus", "srodek"];

/** Nazwy dla klienta i firmy – bez stolarskiego żargonu. */
export const CZESC_LABEL: Record<CzescMebla, string> = {
  front: "Fronty (drzwi i szuflady)",
  korpus: "Boki i obudowa",
  srodek: "Środek (półki i przegrody)",
};
export const CZESC_KROTKO: Record<CzescMebla, string> = { front: "fronty", korpus: "boki", srodek: "środek" };

/**
 * Kolory wybrane dla mebla albo dla całego projektu; brak pola = dziedziczy (boki jak fronty, środek jak boki).
 * uchwyt – okucia tylko tego mebla (id z listy okuć); brak = okucia oferty.
 */
export type KoloryMebla = { front?: string; korpus?: string; srodek?: string; uchwyt?: string };
/** Wspólne dla projektu (front jest w ofercie, tu boki i środek). */
export type KoloryProjektu = { korpus?: string; srodek?: string };

type ElementKolorow = {
  id: string;
  nazwa?: string;
  rodzaj?: string;
  strefa: string;
  zrodlo?: string;
  modelId?: string;
  w: number;
  h: number;
  d: number;
  wnetrze?: Wnetrze;
  kolory?: KoloryMebla;
};

/**
 * Kolory jednego mebla po dziedziczeniu: własny wybór → wspólny projektu → „jak fronty” (boki) / „jak boki” (środek).
 * Boki „jak fronty” idą za frontem tego mebla, więc mebel z innym frontem ma też inne boki, dopóki ktoś ich nie ustawi.
 */
export function koloryMebla(el: { kolory?: KoloryMebla }, front: string, projekt?: KoloryProjektu | null): Required<Omit<KoloryMebla, "uchwyt">> {
  const f = el.kolory?.front ?? front;
  const k = el.kolory?.korpus ?? projekt?.korpus ?? f;
  const s = el.kolory?.srodek ?? projekt?.srodek ?? k;
  return { front: f, korpus: k, srodek: s };
}

/** Okucia mebla: własne albo okucia oferty. */
export const uchwytMebla = (el: { kolory?: KoloryMebla }, hardware: string) => el.kolory?.uchwyt ?? hardware;

/**
 * Dopłata za okucia, gdy meble mają różne: dopłata × udział frontów (m²) mebli z tymi okuciami.
 * Wszystkie meble z okuciami oferty = dokładnie jej dopłata (jak dotąd).
 */
export function doplataUchwytow(elementy: readonly ElementKolorow[], hardware: string, dopłata: (id: string) => number) {
  const m2 = new Map<string, number>();
  let suma = 0;
  for (const el of elementy) {
    const f = czesciMebla(el).front;
    if (!f) continue;
    const u = uchwytMebla(el, hardware);
    m2.set(u, (m2.get(u) ?? 0) + f);
    suma += f;
  }
  if (!suma) return Math.round(dopłata(hardware));
  return Math.round(Array.from(m2).reduce((s, [id, v]) => s + (dopłata(id) * v) / suma, 0));
}

/** AGD i elementy bez korpusu meblowego. */
const BEZ_KOLOROW = new Set(["zlewozmywak", "bateria", "plyta-indukcja", "plyta-gaz", "okap", "okap-podszafkowy", "lodowka", "mikrofalowka", "blat", "polka", "piekarnik"]);
/** AGD w zabudowie: tylko front meblowy. */
const ZABUDOWA = new Set(["zmywarka", "lodowka-zabudowa"]);

/** Które części mebel ma i ile mają m² (do dopłaty według powierzchni). */
export function czesciMebla(el: ElementKolorow): Record<CzescMebla, number> {
  const rodzaj = el.rodzaj ?? "szafka";
  const w = el.w / 100;
  const h = el.h / 100;
  const d = el.d / 100;
  const zero = { front: 0, korpus: 0, srodek: 0 };
  if (BEZ_KOLOROW.has(rodzaj)) return zero;
  const obudowa = 2 * h * d + 2 * w * d;
  // Zmywarka i lodówka w zabudowie: front meblowy; obudowa AGD zostaje jak w urządzeniu.
  if (ZABUDOWA.has(rodzaj)) return { front: w * h, korpus: 0, srodek: 0 };
  if (el.zrodlo === "model") return { front: w * h, korpus: obudowa, srodek: 0 };
  if (!kategoriaWnetrza(el)) return zero;
  const wn = el.wnetrze ?? wnetrzeDomyslne(el);
  const maFront = !!wn && (wn.front !== "otwarte" || wn.kolumny.some((k) => k.sekcje.some((s) => s.typ === "szuflada")));
  const srodek = (wn ? zliczWnetrze(el, wn).plytaM2 : 0) + w * d;
  return { front: maFront ? w * h : 0, korpus: obudowa, srodek };
}

/** Udział każdej próbki w kolorowanych m² projektu (suma = 1). Pusty projekt → sam front. */
export function udzialyKolorow(elementy: readonly ElementKolorow[], front: string, projekt?: KoloryProjektu | null): Map<string, number> {
  const m2 = new Map<string, number>();
  let suma = 0;
  for (const el of elementy) {
    const pola = czesciMebla(el);
    const kol = koloryMebla(el, front, projekt);
    for (const c of CZESCI) {
      if (!pola[c]) continue;
      m2.set(kol[c], (m2.get(kol[c]) ?? 0) + pola[c]);
      suma += pola[c];
    }
  }
  if (!suma) return new Map([[front, 1]]);
  return new Map(Array.from(m2, ([id, v]) => [id, v / suma]));
}

/** Dopłata za kolory: Σ dopłata próbki × udział (do pełnych złotych). */
export function doplataKolorow(
  elementy: readonly ElementKolorow[],
  front: string,
  projekt: KoloryProjektu | null | undefined,
  dopłata: (id: string) => number,
): { kwota: number; udzialy: { id: string; udzial: number; kwota: number }[] } {
  const udzialy = Array.from(udzialyKolorow(elementy, front, projekt), ([id, udzial]) => ({ id, udzial, kwota: dopłata(id) * udzial }));
  return { kwota: Math.round(udzialy.reduce((s, u) => s + u.kwota, 0)), udzialy };
}

/** Czy projekt ma kolory inne niż jeden wspólny (do opisów: „Kolory: grafit 60%, dąb 40%”). */
export const roznekolory = (udzialy: readonly { udzial: number }[]) => udzialy.length > 1;

/* ---------- walidacja (serwer) ---------- */

const REF_RE = /^[A-Za-z0-9:_.\-]{1,80}$/;

export function parseKoloryMebla(v: unknown, gdzie: string): KoloryMebla | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "object" || Array.isArray(v)) throw new Error(`${gdzie}: kolory mają zły format.`);
  const o = v as Record<string, unknown>;
  const out: KoloryMebla = {};
  for (const c of [...CZESCI, "uchwyt"] as const) {
    if (o[c] === undefined || o[c] === null) continue;
    if (typeof o[c] !== "string" || !REF_RE.test(o[c] as string)) throw new Error(`${gdzie}: zły kolor (${c === "uchwyt" ? "okucia" : CZESC_KROTKO[c]}).`);
    out[c] = o[c] as string;
  }
  return Object.keys(out).length ? out : undefined;
}
