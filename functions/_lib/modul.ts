/*
 * Cennik modułów firmy (KV w przestrzeni firmy: settings:cennik-modulow) i walidacja modułów w ofercie.
 * Ceny modułów liczy zawsze serwer (src/lib/modul.ts) – z wymiarów i cennika firmy.
 */
import { DEFAULT_CENNIK, MAX_MODULY, MODUL_LIMITS, modulCena, type ModulCennik, type ModulItem } from "../../src/lib/modul";
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

export function validateCennik(v: unknown): ModulCennik {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw bad("Oczekiwano obiektu cennika.");
  const b = v as Record<string, unknown>;
  return { baza: money(b.baza, "baza"), plytaM2: money(b.plytaM2, "płyta za m²"), frontM2: money(b.frontM2, "front za m²"), mb: money(b.mb, "metr bieżący") };
}

const dim = (v: unknown, k: keyof typeof MODUL_LIMITS, i: number) => {
  const { min, max } = MODUL_LIMITS[k];
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
