/*
 * Wersje oferty i akceptacja przez klienta (wspólne dla serwera, panelu i strony klienta).
 *
 * Wersja = skrót tego, co widzi klient: cena, materiały, meble (wymiary, własne kolory, wnętrze), dodatki.
 * Serwer dopisuje nową wersję przy zapisie, gdy oferta ma link dla klienta, a skrót różni się od ostatniej wersji
 * (szkice bez linku nie robią wersji). Akceptacja dotyczy konkretnej wersji – zmiana oferty po akceptacji
 * jest widoczna w panelu i u klienta („zaakceptuj nową wersję”).
 */

export type SkrotElementu = { id: string; nazwa: string; w: number; h: number; d: number; kolory?: string; wnetrze?: string };

export type SkrotOferty = {
  /** Cena bazowa netto (meble + dodatki), jak w ofercie. */
  cena: number;
  front: string;
  blat: string;
  okucia: string;
  /** Boki i środek całego projektu (id próbek), gdy inne niż fronty. */
  kolory?: string;
  elementy: SkrotElementu[];
  dodatki?: string[];
  plyta?: string;
};

export type WersjaOferty = { nr: number; data: string; skrot: SkrotOferty };

export type AkceptacjaOferty = {
  /** Numer zaakceptowanej wersji. */
  wersja: number;
  /** ISO. */
  data: string;
  /** Imię i nazwisko wpisane przez klienta. */
  imie: string;
  /** Kwota netto pokazana klientowi przy akceptacji (null = oferta bez ceny). */
  kwota: number | null;
  /** Kolory / materiały, które klient miał wybrane w podglądzie (gdy inne niż w ofercie). */
  wybor?: string;
};

/** Najwięcej zapamiętanych wersji (starsze odpadają). */
export const MAX_WERSJI = 20;

type OfertaDoSkrotu = {
  base: number;
  front: string;
  countertop: string;
  hardware: string;
  materialy?: { front: { name: string }; countertop: { name: string }; hardware: { name: string } };
  kuchnia?: {
    elementy: { id: string; nazwa: string; w: number; h: number; d: number; kolory?: Record<string, string | undefined>; wnetrze?: unknown }[];
    kolory?: Record<string, string | undefined>;
    dodatki?: { id: string; nazwa?: string; cena?: number; ilosc?: number }[];
    plyta?: string;
  };
  moduly?: { nazwa: string; w: number; h: number; d: number }[];
};

const zKolorami = (k?: Record<string, string | undefined>) => {
  if (!k) return undefined;
  const s = Object.entries(k)
    .filter(([, v]) => v)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([c, v]) => `${c}:${v}`)
    .join(",");
  return s || undefined;
};

/** Skrót oferty do porównywania wersji. */
export function skrotOferty(o: OfertaDoSkrotu): SkrotOferty {
  const elementy: SkrotElementu[] = o.kuchnia?.elementy.length
    ? o.kuchnia.elementy.map((e) => ({
        id: e.id,
        nazwa: e.nazwa,
        w: e.w,
        h: e.h,
        d: e.d,
        ...(zKolorami(e.kolory) ? { kolory: zKolorami(e.kolory) } : {}),
        ...(e.wnetrze ? { wnetrze: JSON.stringify(e.wnetrze) } : {}),
      }))
    : (o.moduly ?? []).map((m, i) => ({ id: `m${i}`, nazwa: m.nazwa, w: m.w, h: m.h, d: m.d }));
  const dodatki = (o.kuchnia?.dodatki ?? []).map((d) => `${d.nazwa ?? d.id}${d.cena !== undefined ? ` ${d.cena}` : ""}${d.ilosc !== undefined ? ` ×${d.ilosc}` : ""}`);
  return {
    cena: Math.round(o.base * 100) / 100,
    front: o.materialy?.front.name ?? o.front,
    blat: o.materialy?.countertop.name ?? o.countertop,
    okucia: o.materialy?.hardware.name ?? o.hardware,
    ...(zKolorami(o.kuchnia?.kolory) ? { kolory: zKolorami(o.kuchnia?.kolory) } : {}),
    elementy,
    ...(dodatki.length ? { dodatki } : {}),
    ...(o.kuchnia?.plyta ? { plyta: o.kuchnia.plyta } : {}),
  };
}

const rowne = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Wersje po zapisie: nowa, gdy skrót się zmienił (pierwsza – gdy oferta dostaje link). */
export function dopiszWersje(wersje: readonly WersjaOferty[] | undefined, skrot: SkrotOferty, data: string): WersjaOferty[] {
  const lista = wersje ?? [];
  const ost = lista[lista.length - 1];
  if (ost && rowne(ost.skrot, skrot)) return [...lista];
  return [...lista, { nr: (ost?.nr ?? 0) + 1, data, skrot }].slice(-MAX_WERSJI);
}

const zl = (n: number) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} zł`;
const wym = (e: SkrotElementu) => `${e.w}×${e.h}×${e.d} cm`;

/** Co się zmieniło między wersjami – krótkie zdania dla panelu i klienta. */
export function roznice(a: SkrotOferty, b: SkrotOferty): string[] {
  const out: string[] = [];
  if (a.cena !== b.cena) out.push(`Cena netto: ${zl(a.cena)} → ${zl(b.cena)}`);
  if (a.front !== b.front) out.push(`Fronty: ${a.front} → ${b.front}`);
  if (a.blat !== b.blat) out.push(`Blat: ${a.blat} → ${b.blat}`);
  if (a.okucia !== b.okucia) out.push(`Okucia: ${a.okucia} → ${b.okucia}`);
  if (a.kolory !== b.kolory) out.push("Zmienione kolory boków lub środka mebli");
  if (a.plyta !== b.plyta) out.push("Zmieniona płyta korpusów");
  const stare = new Map(a.elementy.map((e) => [e.id, e]));
  const nowe = new Map(b.elementy.map((e) => [e.id, e]));
  for (const e of b.elementy) {
    const s = stare.get(e.id);
    if (!s) {
      out.push(`Dodano: ${e.nazwa} (${wym(e)})`);
      continue;
    }
    const zm: string[] = [];
    if (s.nazwa !== e.nazwa) zm.push(`nazwa „${s.nazwa}” → „${e.nazwa}”`);
    if (s.w !== e.w || s.h !== e.h || s.d !== e.d) zm.push(`${wym(s)} → ${wym(e)}`);
    if (s.kolory !== e.kolory) zm.push("kolory");
    if (s.wnetrze !== e.wnetrze) zm.push("wnętrze");
    if (zm.length) out.push(`Zmieniono: ${e.nazwa} – ${zm.join(", ")}`);
  }
  for (const e of a.elementy) if (!nowe.has(e.id)) out.push(`Usunięto: ${e.nazwa} (${wym(e)})`);
  if (!rowne(a.dodatki ?? [], b.dodatki ?? [])) out.push("Zmienione dodatki (transport, montaż, rabat…)");
  return out;
}

/** Ostatnia wersja i zmiany względem poprzedniej. */
export function ostatniaWersja(wersje: readonly WersjaOferty[] | undefined) {
  const lista = wersje ?? [];
  const ost = lista[lista.length - 1] ?? null;
  const poprz = lista[lista.length - 2] ?? null;
  return { wersja: ost, zmiany: ost && poprz ? roznice(poprz.skrot, ost.skrot) : [] };
}

/** Data po polsku: „2 lis 2026, 22:30” (czas polski). */
export function dataPl(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
