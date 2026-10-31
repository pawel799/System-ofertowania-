/*
 * Cennik modułów firmy (KV w przestrzeni firmy: settings:cennik-modulow) i walidacja modułów w ofercie.
 * Ceny modułów liczy zawsze serwer (src/lib/modul.ts) – z wymiarów i cennika firmy.
 */
import {
  cenaPlytyM2,
  DEFAULT_CENNIK,
  JEDNOSTKI,
  LINIA_LIMITS,
  MAX_MODULY,
  MAX_PLYT,
  MAX_POZYCJI,
  modulCena,
  type JednostkaPozycji,
  type ModulCennik,
  type ModulItem,
  type PlytaKorpusu,
  type PozycjaCennika,
} from "../../src/lib/modul";
import { HttpError, type KVNamespace } from "./offers";

export const CENNIK_KEY = "settings:cennik-modulow";

const bad = (m: string) => new HttpError(400, "invalid", m);

export async function getCennik(kv: KVNamespace): Promise<ModulCennik> {
  const raw = await kv.get(CENNIK_KEY);
  return raw ? { ...DEFAULT_CENNIK, ...(JSON.parse(raw) as ModulCennik) } : DEFAULT_CENNIK;
}

const money = (v: unknown, field: string) => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1_000_000) throw bad(`Pole ${field}: liczba od 0 do 1 000 000 zł.`);
  return Math.round(v * 100) / 100;
};

const ID_RE = /^[A-Za-z0-9-]{1,24}$/;
const nazwa = (v: unknown, gdzie: string) => {
  const n = typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 80) : "";
  if (!n) throw bad(`${gdzie}: podaj nazwę.`);
  return n;
};
const liczba = (v: unknown, gdzie: string, min: number, max: number) => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) throw bad(`${gdzie}: liczba od ${min} do ${max}.`);
  return Math.round(v * 100) / 100;
};

function validatePlyty(v: unknown): PlytaKorpusu[] {
  if (!Array.isArray(v) || v.length > MAX_PLYT) throw bad(`Do ${MAX_PLYT} płyt korpusów.`);
  const ids = new Set<string>();
  return v.map((x, i) => {
    if (!x || typeof x !== "object" || Array.isArray(x)) throw bad(`Płyta ${i + 1} ma zły format.`);
    const o = x as Record<string, unknown>;
    const id = typeof o.id === "string" && ID_RE.test(o.id) && !ids.has(o.id) ? o.id : null;
    if (!id) throw bad(`Płyta ${i + 1}: zły albo powtórzony identyfikator.`);
    ids.add(id);
    const n = nazwa(o.nazwa, `Płyta ${i + 1}`);
    return {
      id,
      nazwa: n,
      grubosc: liczba(o.grubosc, `${n} – grubość [mm]`, 8, 40),
      dl: Math.round(liczba(o.dl, `${n} – długość arkusza [mm]`, 500, 5600)),
      szer: Math.round(liczba(o.szer, `${n} – szerokość arkusza [mm]`, 300, 2800)),
      cenaArkusza: liczba(o.cenaArkusza, `${n} – cena za arkusz`, 0, 100_000),
    };
  });
}

function validatePozycje(v: unknown): PozycjaCennika[] {
  if (!Array.isArray(v) || v.length > MAX_POZYCJI) throw bad(`Do ${MAX_POZYCJI} własnych pozycji.`);
  const ids = new Set<string>();
  return v.map((x, i) => {
    if (!x || typeof x !== "object" || Array.isArray(x)) throw bad(`Pozycja ${i + 1} ma zły format.`);
    const o = x as Record<string, unknown>;
    // „w…” to pozycje własne pojedynczej oferty (dodatki.ts) – w cenniku inny przedrostek.
    const id = typeof o.id === "string" && ID_RE.test(o.id) && !o.id.startsWith("w") && !ids.has(o.id) ? o.id : null;
    if (!id) throw bad(`Pozycja ${i + 1}: zły albo powtórzony identyfikator.`);
    ids.add(id);
    const n = nazwa(o.nazwa, `Pozycja ${i + 1}`);
    const jednostka = JEDNOSTKI.includes(o.jednostka as JednostkaPozycji) ? (o.jednostka as JednostkaPozycji) : null;
    if (!jednostka) throw bad(`${n}: nieznana jednostka.`);
    const cena = jednostka === "proc" ? liczba(o.cena, `${n} – procent`, -50, 100) : liczba(o.cena, `${n} – kwota`, -1_000_000, 1_000_000);
    return { id, nazwa: n, cena, jednostka, ...(o.domyslna === true ? { domyslna: true } : {}) };
  });
}

export function validateCennik(v: unknown): ModulCennik {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw bad("Oczekiwano obiektu cennika.");
  const b = v as Record<string, unknown>;
  const plyty = b.plyty === undefined || b.plyty === null ? undefined : validatePlyty(b.plyty);
  const odpadPlyty = b.odpadPlyty === undefined || b.odpadPlyty === null ? 0 : liczba(b.odpadPlyty, "Odpad płyty [%]", 0, 50);
  const plytaDomyslna = plyty?.length ? (plyty.find((p) => p.id === b.plytaDomyslna) ?? plyty[0]).id : undefined;
  const pozycje = b.pozycje === undefined || b.pozycje === null ? undefined : validatePozycje(b.pozycje);
  const domyslna = plyty?.find((p) => p.id === plytaDomyslna);
  return {
    baza: money(b.baza, "baza"),
    plytaM2: money(b.plytaM2, "płyta za m²"),
    frontM2: money(b.frontM2, "front za m²"),
    mb: money(b.mb, "metr bieżący"),
    // Starsze panele nie wysyłają tych pól – wtedy zostaje cena domyślna.
    szuflada: b.szuflada === undefined || b.szuflada === null ? (DEFAULT_CENNIK.szuflada ?? 0) : money(b.szuflada, "szuflada"),
    drazek: b.drazek === undefined || b.drazek === null ? (DEFAULT_CENNIK.drazek ?? 0) : money(b.drazek, "drążek"),
    ...(plyty?.length ? { plyty, plytaDomyslna, odpadPlyty } : {}),
    ...(pozycje?.length ? { pozycje } : {}),
    // Płyty z listy: plytaM2 = cena za m² płyty domyślnej (z arkusza i odpadu) – stare wyliczenia liczą tak samo.
    ...(domyslna ? { plytaM2: cenaPlytyM2(domyslna, odpadPlyty) } : {}),
  };
}

const dim = (v: unknown, k: keyof typeof LINIA_LIMITS, i: number) => {
  const { min, max } = LINIA_LIMITS[k];
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) throw bad(`Moduł ${i + 1}: wymiar ${k} poza zakresem ${min}–${max} cm.`);
  return Math.round(v);
};

export function validateModuly(v: unknown): ModulItem[] | undefined {
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v) || v.length > MAX_MODULY) throw bad(`Do ${MAX_MODULY} modułów w ofercie.`);
  return v.map((m, i) => {
    if (!m || typeof m !== "object" || Array.isArray(m)) throw bad(`Moduł ${i + 1} ma zły format.`);
    const o = m as Record<string, unknown>;
    const nazwa = typeof o.nazwa === "string" ? o.nazwa.replace(/\s+/g, " ").trim().slice(0, 80) : "";
    return { nazwa: nazwa || `Szafka ${i + 1}`, w: dim(o.w, "w", i), h: dim(o.h, "h", i), d: dim(o.d, "d", i) };
  });
}

/** Moduły z ceną z cennika (do strony klienta). */
export const pricedModuly = (list: ModulItem[], c: ModulCennik) => list.map((m) => ({ ...m, cena: modulCena(m, c) }));
